-- Stanbax chat synchronization migration
-- Run once in the Supabase SQL Editor after schema.sql / SETUP_ALL.sql.
-- Chat payloads use the existing school_state table and Stanbax session checks;
-- no Supabase service-role key is exposed to browsers.

-- Publish shared state so the anonymous Supabase client receives changes only
-- for rows already readable under the existing school_state RLS policies.
ALTER TABLE public.school_state REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'school_state'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.school_state;
  END IF;
END;
$$;

-- Anonymous visitors keep a random access token in their own browser. Only a
-- SHA-256 digest is stored here; browser roles cannot read this table.
CREATE TABLE IF NOT EXISTS public.visitor_chat_credentials (
  visitor_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.visitor_chat_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_chat_credentials FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.visitor_chat_credentials FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.merge_chat_json_array(p_existing JSONB, p_incoming JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions, pg_temp AS $$
  WITH candidates AS (
    SELECT e.value AS item, e.ordinality AS ord, 0 AS source
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_existing) = 'array' THEN p_existing ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS e(value, ordinality)
    UNION ALL
    SELECT i.value AS item, i.ordinality AS ord, 1 AS source
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_incoming) = 'array' THEN p_incoming ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS i(value, ordinality)
  ), keyed AS (
    SELECT item, ord, source,
           COALESCE(NULLIF(item->>'id', ''), '__no_id__' || source::text || ':' || ord::text) AS item_key
    FROM candidates
  ), picked AS (
    SELECT DISTINCT ON (item_key) item, ord, source
    FROM keyed
    ORDER BY item_key, source DESC, ord DESC
  )
  SELECT COALESCE(
    jsonb_agg(item ORDER BY COALESCE(NULLIF(item->>'timestamp', ''), NULLIF(item->>'createdAt', ''), ''), source, ord),
    '[]'::jsonb
  )
  FROM picked;
$$;

CREATE OR REPLACE FUNCTION public.jsonb_array_replace_at(p_array JSONB, p_index INTEGER, p_value JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public, extensions, pg_temp AS $$
  SELECT COALESCE(
    jsonb_agg(CASE WHEN (item.ordinality - 1) = p_index THEN p_value ELSE item.value END ORDER BY item.ordinality),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(p_array) = 'array' THEN p_array ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS item(value, ordinality);
$$;

CREATE OR REPLACE FUNCTION public.merge_visitor_conversation_arrays(p_existing JSONB, p_incoming JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_result JSONB := CASE WHEN jsonb_typeof(p_existing) = 'array' THEN p_existing ELSE '[]'::jsonb END;
  v_conversation JSONB;
  v_existing JSONB;
  v_merged JSONB;
  v_messages JSONB;
  v_index INTEGER;
BEGIN
  IF jsonb_typeof(p_incoming) <> 'array' THEN
    RETURN v_result;
  END IF;

  FOR v_conversation IN SELECT value FROM jsonb_array_elements(p_incoming)
  LOOP
    IF COALESCE(v_conversation->>'visitorId', '') = '' THEN CONTINUE; END IF;

    SELECT (entry.ordinality - 1)::INTEGER, entry.value
      INTO v_index, v_existing
      FROM jsonb_array_elements(v_result) WITH ORDINALITY AS entry(value, ordinality)
     WHERE entry.value->>'visitorId' = v_conversation->>'visitorId'
     LIMIT 1;

    IF v_index IS NOT NULL THEN
      v_messages := public.merge_chat_json_array(v_existing->'messages', v_conversation->'messages');
      v_merged := v_existing || v_conversation;
      v_merged := jsonb_set(v_merged, '{messages}', v_messages, true);
      v_result := public.jsonb_array_replace_at(v_result, v_index, v_merged);
    ELSE
      v_conversation := jsonb_set(
        v_conversation,
        '{messages}',
        public.merge_chat_json_array('[]'::jsonb, v_conversation->'messages'),
        true
      );
      v_result := v_result || jsonb_build_array(v_conversation);
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$;

-- Preserve messages and consultation requests when two devices submit stale
-- snapshots close together. Visitor conversations merge at conversation and
-- message ID level so a concurrent visitor reply is not erased by a staff reply.
CREATE OR REPLACE FUNCTION public.merge_school_chat_state_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
BEGIN
  IF NEW.key = 'stanbax_chat_messages' THEN
    NEW.data := public.merge_chat_json_array(OLD.data, NEW.data);
  ELSIF NEW.key = 'stanbax_parent_consultations' THEN
    NEW.data := public.merge_chat_json_array(OLD.data, NEW.data);
  ELSIF NEW.key = 'stanbax_visitor_conversations' THEN
    NEW.data := public.merge_visitor_conversation_arrays(OLD.data, NEW.data);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS school_state_merge_chat_arrays ON public.school_state;
CREATE TRIGGER school_state_merge_chat_arrays
BEFORE UPDATE OF data ON public.school_state
FOR EACH ROW
EXECUTE FUNCTION public.merge_school_chat_state_before_update();

-- Anonymous landing-page writes are constrained to visitor-authored messages.
-- Staff replies require the application's verified session and role policies.
CREATE OR REPLACE FUNCTION public.submit_public_visitor_chat_message(
  p_visitor_id TEXT,
  p_access_token TEXT,
  p_message JSONB,
  p_visitor_info JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_data JSONB;
  v_conversation JSONB;
  v_message JSONB;
  v_info JSONB := CASE WHEN jsonb_typeof(p_visitor_info) = 'object' THEN p_visitor_info ELSE '{}'::jsonb END;
  v_index INTEGER;
  v_id TEXT := trim(COALESCE(p_visitor_id, ''));
  v_access_token TEXT := trim(COALESCE(p_access_token, ''));
  v_token_hash TEXT;
  v_saved_hash TEXT;
  v_message_id TEXT := trim(COALESCE(p_message->>'id', ''));
  v_name TEXT;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF v_id = '' OR length(v_id) > 160 OR v_id !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Invalid visitor chat identifier.');
  END IF;
  IF length(v_access_token) < 32 OR length(v_access_token) > 256 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'A valid private visitor chat token is required.');
  END IF;
  IF jsonb_typeof(p_message) <> 'object'
     OR COALESCE(p_message->>'sender', '') <> 'visitor'
     OR v_message_id = '' OR length(v_message_id) > 180 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Only a valid visitor-authored message can be submitted.');
  END IF;
  IF length(COALESCE(p_message->>'content', '')) > 5000 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Chat message is too long.');
  END IF;
  IF length(COALESCE(v_info->>'name', p_message->>'senderName', 'Visitor')) > 120
     OR length(COALESCE(v_info->>'phone', '')) > 80
     OR length(COALESCE(v_info->>'email', '')) > 254 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Visitor details exceed the allowed length.');
  END IF;

  INSERT INTO public.school_state (key, data, is_public, updated_by, updated_at)
  VALUES ('stanbax_visitor_conversations', '[]'::jsonb, true, 'public_visitor', v_now)
  ON CONFLICT (key) DO NOTHING;
  SELECT data INTO v_data
    FROM public.school_state
   WHERE key = 'stanbax_visitor_conversations'
   FOR UPDATE;
  IF jsonb_typeof(v_data) <> 'array' THEN v_data := '[]'::jsonb; END IF;

  v_token_hash := encode(digest(v_access_token, 'sha256'), 'hex');
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_data) AS existing(value)
    WHERE existing.value->>'visitorId' = v_id
  ) THEN
    INSERT INTO public.visitor_chat_credentials (visitor_id, token_hash)
    VALUES (v_id, v_token_hash)
    ON CONFLICT (visitor_id) DO NOTHING;
  END IF;
  SELECT token_hash INTO v_saved_hash
    FROM public.visitor_chat_credentials
   WHERE visitor_id = v_id
   FOR UPDATE;
  IF v_saved_hash IS NULL OR v_saved_hash <> v_token_hash THEN
    RETURN jsonb_build_object('ok', false, 'message', 'This visitor chat is not available from this browser. Start a new chat to continue securely.');
  END IF;

  SELECT (entry.ordinality - 1)::INTEGER, entry.value
    INTO v_index, v_conversation
    FROM jsonb_array_elements(v_data) WITH ORDINALITY AS entry(value, ordinality)
   WHERE entry.value->>'visitorId' = v_id
   LIMIT 1;

  IF v_index IS NOT NULL AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(v_conversation->'messages', '[]'::jsonb)) AS msg(value)
    WHERE msg.value->>'id' = v_message_id
  ) THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'message', 'Message already stored.');
  END IF;

  v_name := COALESCE(NULLIF(trim(v_info->>'name'), ''), NULLIF(trim(p_message->>'senderName'), ''), 'Visitor');
  v_message := (p_message - 'isAiResponse' - 'isAppointmentNotice' - 'appointmentData'
                         - 'isTransferNotice' - 'transferData' - 'isPinned'
                         - 'flaggedByAdmin' - 'deletedByAdmin')
    || jsonb_build_object(
      'id', v_message_id,
      'sender', 'visitor',
      'senderName', v_name,
      'content', COALESCE(p_message->>'content', ''),
      'timestamp', COALESCE(NULLIF(p_message->>'timestamp', ''), v_now::text),
      'status', 'delivered',
      'deliveredAt', COALESCE(NULLIF(p_message->>'deliveredAt', ''), v_now::text)
    );

  IF v_index IS NOT NULL THEN
    v_conversation := v_conversation || jsonb_build_object(
      'visitorName', v_name,
      'visitorPhone', COALESCE(NULLIF(v_info->>'phone', ''), v_conversation->>'visitorPhone'),
      'visitorEmail', COALESCE(NULLIF(v_info->>'email', ''), v_conversation->>'visitorEmail'),
      'lastMessageAt', v_now::text,
      'unreadByAdmin', true,
      'status', 'waiting_rep',
      'messages', COALESCE(v_conversation->'messages', '[]'::jsonb) || jsonb_build_array(v_message)
    );
    v_data := public.jsonb_array_replace_at(v_data, v_index, v_conversation);
  ELSE
    v_conversation := jsonb_build_object(
      'visitorId', v_id,
      'queryCode', 'STX-' || upper(right(v_id, 5)),
      'visitorName', v_name,
      'visitorPhone', NULLIF(v_info->>'phone', ''),
      'visitorEmail', NULLIF(v_info->>'email', ''),
      'visitorCategory', COALESCE(NULLIF(v_info->>'category', ''), 'Prospective Parent'),
      'createdAt', v_now::text,
      'lastMessageAt', v_now::text,
      'status', 'waiting_rep',
      'unreadByAdmin', true,
      'messages', jsonb_build_array(v_message)
    );
    v_data := jsonb_build_array(v_conversation) || v_data;
  END IF;

  UPDATE public.school_state
     SET data = v_data, is_public = true, updated_by = 'public_visitor', updated_at = v_now
   WHERE key = 'stanbax_visitor_conversations';

  RETURN jsonb_build_object('ok', true, 'message', 'Visitor message stored in Supabase.', 'conversation', v_conversation);
END;
$$;

-- Merge representative/admin updates under a verified staff session.
CREATE OR REPLACE FUNCTION public.merge_authenticated_visitor_conversations(p_conversations JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_current JSONB;
  v_merged JSONB;
  v_role TEXT := public.session_role();
  v_ref TEXT := public.session_ref_id();
BEGIN
  IF NOT public.valid_session() OR NOT public.can_write_state_key('stanbax_visitor_conversations') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Access denied: a verified school staff session is required.');
  END IF;
  IF jsonb_typeof(p_conversations) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Visitor conversations must be an array.');
  END IF;

  INSERT INTO public.school_state (key, data, is_public, updated_by, updated_at)
  VALUES ('stanbax_visitor_conversations', '[]'::jsonb, true, v_ref, now())
  ON CONFLICT (key) DO NOTHING;
  SELECT data INTO v_current FROM public.school_state WHERE key = 'stanbax_visitor_conversations' FOR UPDATE;
  v_merged := public.merge_visitor_conversation_arrays(v_current, p_conversations);

  UPDATE public.school_state
     SET data = v_merged, is_public = true, updated_by = v_ref, updated_at = now()
   WHERE key = 'stanbax_visitor_conversations';

  RETURN jsonb_build_object('ok', true, 'role', v_role, 'count', jsonb_array_length(v_merged));
END;
$$;

-- Typing indicators are ephemeral and public; representative indicators
-- require a verified staff session, visitor indicators do not.
CREATE OR REPLACE FUNCTION public.sync_chat_typing_status(
  p_visitor_id TEXT,
  p_sender TEXT,
  p_is_typing BOOLEAN,
  p_sender_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_data JSONB;
  v_entry JSONB;
  v_id TEXT := trim(COALESCE(p_visitor_id, ''));
  v_name TEXT := left(trim(COALESCE(p_sender_name, '')), 120);
BEGIN
  IF v_id = '' OR length(v_id) > 160 OR v_id !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Invalid chat identifier.');
  END IF;
  IF p_sender NOT IN ('visitor', 'representative') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Invalid typing role.');
  END IF;
  IF p_sender = 'representative' AND (
    NOT public.valid_session() OR public.session_role() NOT IN ('admin', 'proprietress', 'headmistress', 'moderator', 'tutor')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'A verified staff session is required.');
  END IF;

  INSERT INTO public.school_state (key, data, is_public, updated_by, updated_at)
  VALUES ('stanbax_chat_typing', '{}'::jsonb, true, COALESCE(public.session_ref_id(), 'public_visitor'), now())
  ON CONFLICT (key) DO NOTHING;
  SELECT data INTO v_data FROM public.school_state WHERE key = 'stanbax_chat_typing' FOR UPDATE;
  IF jsonb_typeof(v_data) <> 'object' THEN v_data := '{}'::jsonb; END IF;
  v_entry := COALESCE(v_data->v_id, '{}'::jsonb);

  IF p_sender = 'visitor' THEN
    v_entry := v_entry || jsonb_build_object('isVisitorTyping', COALESCE(p_is_typing, false));
    IF COALESCE(p_is_typing, false) THEN
      v_entry := v_entry || jsonb_build_object('visitorName', NULLIF(v_name, ''));
    ELSE
      v_entry := v_entry - 'visitorName';
    END IF;
  ELSE
    v_entry := v_entry || jsonb_build_object('isRepTyping', COALESCE(p_is_typing, false));
    IF COALESCE(p_is_typing, false) THEN
      v_entry := v_entry || jsonb_build_object('repName', NULLIF(v_name, ''));
    ELSE
      v_entry := v_entry - 'repName';
    END IF;
  END IF;

  v_data := v_data || jsonb_build_object(v_id, v_entry);
  UPDATE public.school_state
     SET data = v_data, is_public = true, updated_by = COALESCE(public.session_ref_id(), 'public_visitor'), updated_at = now()
   WHERE key = 'stanbax_chat_typing';
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Read receipts are private to a verified Stanbax session and are fetched by
-- authenticated polling; Supabase Realtime does not recognize custom session headers.
CREATE OR REPLACE FUNCTION public.sync_chat_read_receipt(p_user_key TEXT, p_user_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_data JSONB;
  v_actor TEXT := public.session_ref_id();
  v_key TEXT := trim(COALESCE(p_user_key, ''));
BEGIN
  IF NOT public.valid_session() OR v_actor IS NULL OR lower(v_actor) <> lower(v_key) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Only the signed-in user can synchronize their read receipts.');
  END IF;
  IF jsonb_typeof(p_user_data) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Read receipt data must be an object.');
  END IF;

  INSERT INTO public.school_state (key, data, is_public, updated_by, updated_at)
  VALUES ('stanbax_chat_read_timestamps', '{}'::jsonb, false, v_actor, now())
  ON CONFLICT (key) DO NOTHING;
  SELECT data INTO v_data FROM public.school_state WHERE key = 'stanbax_chat_read_timestamps' FOR UPDATE;
  IF jsonb_typeof(v_data) <> 'object' THEN v_data := '{}'::jsonb; END IF;
  v_data := v_data || jsonb_build_object(v_key, p_user_data);
  UPDATE public.school_state
     SET data = v_data, is_public = false, updated_by = v_actor, updated_at = now()
   WHERE key = 'stanbax_chat_read_timestamps';
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_visitor_chat_message(TEXT, TEXT, JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_authenticated_visitor_conversations(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_chat_typing_status(TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_chat_read_receipt(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_visitor_chat_message(TEXT, TEXT, JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_authenticated_visitor_conversations(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_chat_typing_status(TEXT, TEXT, BOOLEAN, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_chat_read_receipt(TEXT, JSONB) TO anon, authenticated;

COMMENT ON FUNCTION public.submit_public_visitor_chat_message(TEXT, TEXT, JSONB, JSONB)
  IS 'Append a constrained visitor-authored message to the public school visitor chat collection.';
COMMENT ON FUNCTION public.merge_authenticated_visitor_conversations(JSONB)
  IS 'Merge visitor chat snapshots for a verified school staff session without dropping concurrent messages.';
