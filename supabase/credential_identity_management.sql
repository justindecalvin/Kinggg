-- ===========================================================================
-- STANBAX SCHOOLS — Credential Identity Management (Rename & Delete)
-- Paste into Supabase Dashboard → SQL Editor → Run once. Safe to re-run.
--
-- Fixes two problems reported from the Admin Credentials Vault:
--   1. Deleted accounts (tutors, moderators, etc.) "came back", because the
--      app called public.delete_credential(...) while that RPC did not exist
--      in the database — every vault delete silently failed server-side.
--   2. Hardcoded personal logins (mrs.adediran, mrs.bello, adebisi.bello,
--      kehinde.badmus) were seeded as credential aliases, so those people
--      could always sign in even after profile edits.
--
-- Supabase is the sole source of truth: names/aliases live ONLY in
-- public.credentials. Nothing here reads or writes browser localStorage.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. RENAME: admin updates a credential's login identifier and/or aliases
--    (Canonical identifier of protected executive rows stays stable;
--     display names for those live in school_state profiles.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rename_credential(
  p_identifier     TEXT,                 -- current canonical identifier (or ref_id)
  p_new_identifier TEXT DEFAULT NULL,    -- new canonical login id (optional)
  p_new_aliases    TEXT[] DEFAULT NULL,  -- full replacement alias list (optional)
  p_ref_id         TEXT DEFAULT NULL)    -- app ref id fallback (optional)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_actor_ref  TEXT := public.session_ref_id();
  v_actor_role TEXT := public.session_role();
  v_target     RECORD;
  v_new_id     TEXT;
  v_canonical_locked BOOLEAN := FALSE;
BEGIN
  IF NOT public.is_admin() THEN
    INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
    VALUES ('SECURITY_VIOLATION_UNAUTHORIZED_CREDENTIAL_RENAME', 'credentials', v_actor_ref, v_actor_role,
            jsonb_build_object('attempted_identifier', p_identifier));
    RETURN jsonb_build_object('ok', false, 'message', 'Access denied: Only administrators may rename credentials.');
  END IF;

  SELECT * INTO v_target
    FROM public.credentials
   WHERE lower(identifier) = lower(trim(p_identifier))
      OR lower(ref_id)     = lower(trim(COALESCE(p_ref_id, '')))
   ORDER BY (lower(identifier) = lower(trim(p_identifier))) DESC NULLS LAST
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Credential not found.');
  END IF;

  v_new_id := lower(trim(COALESCE(NULLIF(p_new_identifier, ''), v_target.identifier)));

  IF v_new_id <> v_target.identifier AND EXISTS (
       SELECT 1 FROM public.credentials
        WHERE lower(identifier) = v_new_id AND id <> v_target.id) THEN
    RETURN jsonb_build_object('ok', false, 'message',
      'Another account already uses that login identifier. Choose a different one.');
  END IF;

  -- Protected executive rows keep their canonical identifier (role-level
  -- login such as 'admin' / 'proprietress'); their aliases may still change.
  IF v_target.role IN ('admin', 'proprietress') AND v_new_id <> v_target.identifier THEN
    v_new_id := v_target.identifier;
    v_canonical_locked := TRUE;
  END IF;

  UPDATE public.credentials
     SET identifier = v_new_id,
         aliases    = COALESCE(p_new_aliases, aliases),
         updated_at = now()
   WHERE id = v_target.id;

  UPDATE public.user_roles
     SET identifier = v_new_id,
         updated_at = now()
   WHERE lower(identifier) = lower(v_target.identifier);

  INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
  VALUES ('CREDENTIAL_RENAMED', 'credentials', v_actor_ref, v_actor_role,
          jsonb_build_object('old_identifier', v_target.identifier,
                             'new_identifier', v_new_id,
                             'aliases_replaced', (p_new_aliases IS NOT NULL),
                             'canonical_locked', v_canonical_locked));

  IF v_canonical_locked THEN
    RETURN jsonb_build_object('ok', true, 'message',
      'Aliases updated. The master login identifier for this executive role stays fixed; aliases now control every accepted login name.');
  END IF;
  RETURN jsonb_build_object('ok', true, 'message', 'Credential updated. New logins take effect immediately.');
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. DELETE: real, permanent deletion (this RPC was missing entirely)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_credential(
  p_identifier TEXT,
  p_ref_id     TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_actor_ref  TEXT := public.session_ref_id();
  v_actor_role TEXT := public.session_role();
  v_target     RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
    VALUES ('SECURITY_VIOLATION_UNAUTHORIZED_CREDENTIAL_DELETE', 'credentials', v_actor_ref, v_actor_role,
            jsonb_build_object('attempted_identifier', p_identifier));
    RETURN jsonb_build_object('ok', false, 'message', 'Access denied: Only administrators may delete credentials.');
  END IF;

  SELECT * INTO v_target
    FROM public.credentials
   WHERE lower(identifier) = lower(trim(p_identifier))
      OR lower(ref_id)     = lower(trim(COALESCE(p_ref_id, '')))
   ORDER BY (lower(identifier) = lower(trim(p_identifier))) DESC NULLS LAST
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'message', 'Credential already absent — nothing to delete.');
  END IF;

  -- Master executive accounts are protected: their login lives at role level.
  IF v_target.role IN ('admin', 'proprietress') THEN
    INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
    VALUES ('CREDENTIAL_DELETE_BLOCKED_PROTECTED', 'credentials', v_actor_ref, v_actor_role,
            jsonb_build_object('identifier', v_target.identifier, 'role', v_target.role));
    RETURN jsonb_build_object('ok', false, 'message',
      'Protected executive account — it cannot be deleted from the vault. Rename its aliases or change its password instead.');
  END IF;

  DELETE FROM public.sessions
   WHERE role = v_target.role
     AND ref_id IS NOT DISTINCT FROM v_target.ref_id;

  DELETE FROM public.user_roles
   WHERE lower(identifier) = lower(v_target.identifier)
      OR session_ref_id IS NOT DISTINCT FROM v_target.ref_id;

  DELETE FROM public.credentials WHERE id = v_target.id;

  INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
  VALUES ('CREDENTIAL_DELETED', 'credentials', v_actor_ref, v_actor_role,
          jsonb_build_object('identifier', v_target.identifier,
                             'role', v_target.role,
                             'ref_id', v_target.ref_id));

  RETURN jsonb_build_object('ok', true, 'message', 'Credential deleted permanently from the database.');
END;
$$;

REVOKE ALL ON FUNCTION public.rename_credential(TEXT, TEXT, TEXT[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rename_credential(TEXT, TEXT, TEXT[], TEXT) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_credential(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_credential(TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. ONE-TIME CLEANUP: strip hardcoded personal-name aliases so removed
--    people can never sign in through a seeded name again
-- ---------------------------------------------------------------------------
UPDATE public.credentials
   SET aliases = array_remove(array_remove(array_remove(array_remove(
                  aliases, 'mrs.adediran'), 'mrs.bello'), 'adebisi.bello'), 'kehinde.badmus')
 WHERE aliases && ARRAY['mrs.adediran', 'mrs.bello', 'adebisi.bello', 'kehinde.badmus']::text[];

-- Re-assert the canonical, role-generic alias lists (idempotent)
UPDATE public.credentials
   SET aliases = ARRAY['head_mistress', 'hm', 'hm@stanbaxschools.edu.ng', 'headmistress@stanbaxschools.edu.ng']
 WHERE identifier = 'headmistress';

UPDATE public.credentials
   SET aliases = ARRAY['proprietress@stanbaxschools.edu.ng']
 WHERE identifier = 'proprietress';

UPDATE public.credentials
   SET aliases = ARRAY['mod', 'moderator@stanbaxschools.edu.ng', 'chatmod']
 WHERE identifier = 'moderator';

INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
VALUES ('CREDENTIAL_ALIAS_CLEANUP', 'credentials', 'system', 'admin',
        jsonb_build_object('removed_aliases', ARRAY['mrs.adediran', 'mrs.bello', 'adebisi.bello', 'kehinde.badmus']));
