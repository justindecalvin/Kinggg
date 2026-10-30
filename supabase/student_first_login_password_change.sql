-- Stanbax: require each student to replace their temporary password on first sign-in.
-- Run once in Supabase Dashboard → SQL Editor after the main schema.
-- Existing student credentials are flagged exactly once; students created later are
-- flagged by the updated credential RPCs below.
-- Plaintext passwords are never written to school_state or browser storage. The
-- Admin-facing student profile receives a masked status and passwordChangedAt date.

BEGIN;

ALTER TABLE public.credentials
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.credentials
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.kinggg_feature_migrations (
  migration_name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
REVOKE ALL ON public.kinggg_feature_migrations FROM PUBLIC, anon, authenticated;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.kinggg_feature_migrations
     WHERE migration_name = 'student_first_login_password_change_v1'
  ) THEN
    -- There was no reliable first-login history before this migration, so each
    -- existing student account is asked once to change the password it currently has.
    UPDATE public.credentials
       SET must_change_password = true
     WHERE role = 'student';

    -- Student records are a public-readable app state key. Remove historic
    -- plaintext password fields before any browser hydrates this row.
    UPDATE public.school_state
       SET data = (
         SELECT jsonb_agg(
           jsonb_set(elem, '{password}', to_jsonb('[Change on first login]'::text), true)
         )
         FROM jsonb_array_elements(data) AS elem
       ),
       updated_at = now()
     WHERE key = 'stanbax_students' AND jsonb_typeof(data) = 'array';

    INSERT INTO public.kinggg_feature_migrations (migration_name)
    VALUES ('student_first_login_password_change_v1');
  END IF;
END;
$migration$;

-- Student sessions remain valid for this one password-change RPC, but cannot use
-- ordinary session-protected operations until the required change is completed.
CREATE OR REPLACE FUNCTION public.valid_session()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.sessions s
     WHERE s.token = public.request_session_token()
       AND s.expires_at > now()
       AND NOT (
         s.role = 'student'
         AND EXISTS (
           SELECT 1 FROM public.credentials c
            WHERE c.role = 'student'
              AND c.ref_id = s.ref_id
              AND c.must_change_password
         )
       )
  );
$$;

-- The browser calls this after login/reload. It reveals no password or account data.
CREATE OR REPLACE FUNCTION public.get_password_change_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_role TEXT;
  v_ref TEXT;
  v_required BOOLEAN := false;
BEGIN
  SELECT s.role, s.ref_id INTO v_role, v_ref
    FROM public.sessions s
   WHERE s.token = public.request_session_token()
     AND s.expires_at > now()
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Session expired. Sign in again.');
  END IF;

  IF v_role = 'student' THEN
    SELECT c.must_change_password INTO v_required
      FROM public.credentials c
     WHERE c.role = 'student' AND c.ref_id = v_ref
     LIMIT 1;
  END IF;

  RETURN jsonb_build_object('ok', true, 'role', v_role,
                            'required', COALESCE(v_required, false));
END;
$$;

-- A student can use this only with the session created by a successful login.
-- Server-side checks prevent changing another student's account or skipping the gate.
CREATE OR REPLACE FUNCTION public.complete_first_login_password_change(
  p_new_password TEXT,
  p_confirm_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_role TEXT;
  v_ref TEXT;
  v_now TIMESTAMPTZ := now();
  c RECORD;
  clean_new_password TEXT := trim(COALESCE(p_new_password, ''));
  clean_confirm_password TEXT := trim(COALESCE(p_confirm_password, ''));
BEGIN
  SELECT s.role, s.ref_id INTO v_role, v_ref
    FROM public.sessions s
   WHERE s.token = public.request_session_token()
     AND s.expires_at > now()
   LIMIT 1;
  IF NOT FOUND OR v_role <> 'student' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'A valid student session is required.');
  END IF;

  SELECT * INTO c FROM public.credentials
   WHERE role = 'student' AND ref_id = v_ref
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Student credential record not found.');
  END IF;
  IF NOT c.must_change_password THEN
    RETURN jsonb_build_object('ok', false, 'message', 'No first-login password change is pending.');
  END IF;
  IF length(clean_new_password) < 8 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Use a password with at least 8 characters.');
  END IF;
  IF clean_new_password <> clean_confirm_password THEN
    RETURN jsonb_build_object('ok', false, 'message', 'The passwords do not match.');
  END IF;
  IF c.password_hash = crypt(clean_new_password, c.password_hash) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Choose a password different from your temporary password.');
  END IF;

  UPDATE public.credentials
     SET password_hash = crypt(clean_new_password, gen_salt('bf')),
         must_change_password = false,
         password_changed_at = v_now,
         updated_at = v_now
   WHERE id = c.id;

  -- Keep the Admin dashboard's shared student record in sync without exposing
  -- the new password. The only credential value stored there is a non-secret mask.
  UPDATE public.school_state
     SET data = (
       SELECT jsonb_agg(
         CASE WHEN lower(COALESCE(elem->>'id', '')) = lower(v_ref)
                    OR lower(COALESCE(elem->>'regNumber', '')) = lower(c.identifier)
              THEN jsonb_set(
                     jsonb_set(
                       jsonb_set(elem, '{password}', to_jsonb('[Changed by student]'::text), true),
                       '{passwordChangedAt}', to_jsonb(v_now), true),
                     '{updatedAt}', to_jsonb(v_now), true)
              ELSE elem END
       )
       FROM jsonb_array_elements(data) AS elem
     ),
     updated_at = v_now
   WHERE key = 'stanbax_students' AND jsonb_typeof(data) = 'array';

  INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
  VALUES ('STUDENT_FIRST_PASSWORD_CHANGED', 'credentials', v_ref, 'student',
          jsonb_build_object('identifier', c.identifier, 'changed_at', v_now));
  RETURN jsonb_build_object('ok', true, 'message', 'Password updated successfully.');
END;
$$;

-- New and re-provisioned student accounts always require a change at first login.
CREATE OR REPLACE FUNCTION public.create_credential(
  p_identifier TEXT, p_password TEXT, p_role TEXT, p_ref_id TEXT, p_aliases TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_actor_ref TEXT := public.session_ref_id();
  v_actor_role TEXT := public.session_role();
BEGIN
  IF NOT public.is_admin() THEN
    INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
    VALUES ('SECURITY_VIOLATION_UNAUTHORIZED_ACCOUNT_CREATION', 'credentials', v_actor_ref, v_actor_role,
            jsonb_build_object('attempted_identifier', p_identifier, 'attempted_role', p_role));
    RETURN jsonb_build_object('ok', false, 'message', 'Access denied: Only administrators may provision or modify credentials.');
  END IF;

  INSERT INTO public.credentials
    (identifier, aliases, password_hash, role, ref_id, must_change_password, password_changed_at, updated_at)
  VALUES
    (lower(trim(p_identifier)), p_aliases, crypt(p_password, gen_salt('bf')), p_role, p_ref_id,
     p_role = 'student', NULL, now())
  ON CONFLICT (identifier) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        aliases = EXCLUDED.aliases,
        role = EXCLUDED.role,
        ref_id = EXCLUDED.ref_id,
        must_change_password = EXCLUDED.must_change_password,
        password_changed_at = NULL,
        updated_at = now();

  INSERT INTO public.user_roles (session_ref_id, identifier, role)
  VALUES (p_ref_id, lower(trim(p_identifier)), p_role);
  INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
  VALUES ('CREDENTIAL_PROVISIONED', 'credentials', v_actor_ref, v_actor_role,
          jsonb_build_object('identifier', p_identifier, 'role', p_role, 'ref_id', p_ref_id));
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_student_credential(
  p_identifier TEXT,
  p_password TEXT,
  p_ref_id TEXT,
  p_aliases TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  clean_id TEXT := lower(trim(p_identifier));
  clean_ref TEXT := trim(p_ref_id);
  clean_pass TEXT := trim(p_password);
BEGIN
  IF clean_id = '' OR clean_pass = '' OR clean_ref = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Registration credentials incomplete.');
  END IF;
  INSERT INTO public.credentials
    (identifier, aliases, password_hash, role, ref_id, must_change_password, password_changed_at, updated_at)
  VALUES (clean_id, p_aliases, crypt(clean_pass, gen_salt('bf')), 'student', clean_ref, true, NULL, now())
  ON CONFLICT (identifier) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        aliases = EXCLUDED.aliases,
        role = 'student',
        ref_id = EXCLUDED.ref_id,
        must_change_password = true,
        password_changed_at = NULL,
        updated_at = now();
  INSERT INTO public.user_roles (session_ref_id, identifier, role)
  VALUES (clean_ref, clean_id, 'student');
  INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
  VALUES ('STUDENT_CREDENTIAL_REGISTERED', 'credentials', clean_ref, 'student',
          jsonb_build_object('identifier', clean_id, 'ref_id', clean_ref));
  RETURN jsonb_build_object('ok', true, 'message', 'Scholar account provisioned in Supabase.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_password_change_status() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_first_login_password_change(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_credential(TEXT, TEXT, TEXT, TEXT, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_student_credential(TEXT, TEXT, TEXT, TEXT[]) TO anon, authenticated;

COMMIT;
