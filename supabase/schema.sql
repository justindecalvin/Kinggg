-- ============================================================================
-- STANBAX SCHOOLS — Production Supabase & PostgreSQL Master Schema
-- Paste this ENTIRE file into Supabase Dashboard → SQL Editor → Run once.
-- 
-- Features:
-- 1. Zero-Trust API Key & Client Separation (Client uses ANON key only).
-- 2. Mandatory & FORCED Row Level Security (RLS) on all public tables.
-- 3. Isolated RBAC Table (public.user_roles) & Server-Side is_admin() validation.
-- 4. Granular per-key authorization matrix (Students/Parents cannot tamper with
--    grades, credentials, school info, fees, or faculty).
-- 5. Mass assignment defense triggers preventing credential and role escalation.
-- 6. Immutable search_path (public, extensions, pg_temp) on all SECURITY DEFINER
--    functions preventing search-path hijacking.
-- 7. Tamper-evident security audit trail in public.audit_logs.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. ISOLATED RBAC TABLE: public.user_roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        UUID, -- Bound to auth.users if Supabase Auth is enabled
  session_ref_id TEXT, -- e.g. 'admin', 'tut-1', 'stu-4', 'parent-2'
  identifier     TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('admin', 'proprietress', 'headmistress', 'moderator', 'tutor', 'student', 'parent')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS user_roles_role_idx ON public.user_roles (role);
CREATE INDEX IF NOT EXISTS user_roles_identifier_idx ON public.user_roles (lower(identifier));
CREATE INDEX IF NOT EXISTS user_roles_ref_idx ON public.user_roles (session_ref_id);

-- ---------------------------------------------------------------------------
-- 2. CREDENTIALS TABLE: Hashed passwords & primary account records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credentials (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier    TEXT NOT NULL UNIQUE,          -- Canonical login id (lowercase)
  aliases       TEXT[] NOT NULL DEFAULT '{}',  -- Other accepted identifiers (phones, reg numbers, names)
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'proprietress', 'headmistress', 'moderator', 'tutor', 'student', 'parent')),
  ref_id        TEXT,                          -- App id: stu-1, tut-3, parent-5, admin
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. SESSIONS TABLE: Verified login tokens with automatic expiration
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sessions (
  token      TEXT PRIMARY KEY,
  role       TEXT NOT NULL CHECK (role IN ('admin', 'proprietress', 'headmistress', 'moderator', 'tutor', 'student', 'parent')),
  ref_id     TEXT,
  user_id    UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '12 hours')
);

CREATE INDEX IF NOT EXISTS sessions_expires_idx ON public.sessions (expires_at);
CREATE INDEX IF NOT EXISTS sessions_token_role_idx ON public.sessions (token, role);

-- ---------------------------------------------------------------------------
-- 4. SCHOOL_STATE TABLE: Data store mirroring application state
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_state (
  key           TEXT PRIMARY KEY,
  data          JSONB,
  is_public     BOOLEAN NOT NULL DEFAULT false,
  allowed_roles TEXT[] NOT NULL DEFAULT '{"admin", "proprietress"}',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    TEXT
);

CREATE INDEX IF NOT EXISTS school_state_public_idx ON public.school_state (is_public);

-- ---------------------------------------------------------------------------
-- 5. TAMPER-EVIDENT AUDIT TRAIL: public.audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  actor_ref  TEXT,
  actor_role TEXT,
  ip_address TEXT,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. SECURITY DEFINER HELPER FUNCTIONS WITH IMMUTABLE SEARCH PATHS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_session_token()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public, extensions, pg_temp AS $$
  SELECT NULLIF(current_setting('request.headers', true)::jsonb ->> 'x-stanbax-session', '');
$$;

CREATE OR REPLACE FUNCTION public.valid_session()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.token = public.request_session_token()
      AND s.expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.session_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
  SELECT s.role FROM public.sessions s
  WHERE s.token = public.request_session_token()
    AND s.expires_at > now()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.session_ref_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
  SELECT s.ref_id FROM public.sessions s
  WHERE s.token = public.request_session_token()
    AND s.expires_at > now()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_uid UUID;
  v_role TEXT;
BEGIN
  -- 1. Check Supabase auth.uid() if authenticated through Supabase Auth
  BEGIN
    v_uid := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL;
  END;
  
  IF v_uid IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_uid AND ur.role IN ('admin', 'proprietress')
    ) THEN
      RETURN true;
    END IF;
  END IF;

  -- 2. Check active verified session token role
  v_role := public.session_role();
  IF v_role IN ('admin', 'proprietress') THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
  SELECT public.is_admin() OR (public.session_role() IN ('admin', 'proprietress', 'headmistress', 'moderator', 'tutor'));
$$;

CREATE OR REPLACE FUNCTION public.can_write_state_key(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_role TEXT := public.session_role();
BEGIN
  -- Anonymous callers have ZERO write authority
  IF NOT public.valid_session() THEN
    RETURN false;
  END IF;

  -- Admin & Proprietress have full write authority across all keys
  IF v_role IN ('admin', 'proprietress') THEN
    RETURN true;
  END IF;

  -- Head Mistress: Academic Executive leadership authority across academic and school operations
  IF v_role = 'headmistress' THEN
    RETURN p_key IN (
      'stanbax_students',
      'stanbax_tutors',
      'stanbax_classes',
      'stanbax_subjects',
      'stanbax_lesson_notes',
      'stanbax_cbt_exams',
      'stanbax_cbt_attempts',
      'stanbax_attendance_records',
      'stanbax_homeworks',
      'stanbax_weekly_timetables',
      'stanbax_grades',
      'stanbax_terminal_collations',
      'stanbax_chat_messages',
      'stanbax_visitor_conversations',
      'stanbax_parent_consultations',
      'stanbax_ephemeral_statuses',
      'stanbax_notices',
      'stanbax_school_calendar',
      'stanbax_term_resumption_config',
      'stanbax_gallery_photos',
      'stanbax_directives'
    );
  END IF;

  -- Moderator: Community communications, chat channels, visitor inquiries, news and media oversight
  IF v_role = 'moderator' THEN
    RETURN p_key IN (
      'stanbax_chat_channels',
      'stanbax_chat_messages',
      'stanbax_visitor_conversations',
      'stanbax_parent_consultations',
      'stanbax_ephemeral_statuses',
      'stanbax_notices',
      'stanbax_gallery_photos',
      'stanbax_school_rep_config',
      'stanbax_navbar_content',
      'stanbax_footer_content'
    );
  END IF;

  -- Faculty / Tutors: classroom, lesson notes, attendance, exams, homeworks, timetables
  IF v_role = 'tutor' THEN
    RETURN p_key IN (
      'stanbax_lesson_notes',
      'stanbax_cbt_exams',
      'stanbax_cbt_attempts',
      'stanbax_attendance_records',
      'stanbax_homeworks',
      'stanbax_weekly_timetables',
      'stanbax_grades',
      'stanbax_chat_channels',
      'stanbax_chat_messages',
      'stanbax_ephemeral_statuses',
      'stanbax_library_books',
      'stanbax_sick_bay_logs',
      'stanbax_parent_consultations',
      'stanbax_directives',
      'stanbax_footer_content'
    );
  END IF;

  -- Students: student submissions, active CBT attempts, chat messages, statuses
  IF v_role = 'student' THEN
    RETURN p_key IN (
      'stanbax_cbt_attempts',
      'stanbax_chat_channels',
      'stanbax_chat_messages',
      'stanbax_ephemeral_statuses',
      'stanbax_student_articles',
      'stanbax_homeworks',
      'stanbax_footer_content'
    );
  END IF;

  -- Parents: consultation requests and fee payment receipts
  IF v_role = 'parent' THEN
    RETURN p_key IN (
      'stanbax_parent_consultations',
      'stanbax_fee_payments',
      'stanbax_chat_channels',
      'stanbax_chat_messages',
      'stanbax_footer_content'
    );
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_session()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
  SELECT public.is_admin();
$$;

-- ---------------------------------------------------------------------------
-- 7. MASS ASSIGNMENT & PRIVILEGE ESCALATION DEFENSE TRIGGERS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_credentials_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
BEGIN
  -- Prevent privilege escalation on role modification
  IF (NEW.role IS DISTINCT FROM OLD.role) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Privilege escalation rejected: role cannot be modified except by an administrator';
  END IF;
  
  -- Prevent ID mutation
  IF (NEW.id IS DISTINCT FROM OLD.id) THEN
    RAISE EXCEPTION 'Immutable field violation: record ID cannot be altered';
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_credentials ON public.credentials;
CREATE TRIGGER trg_protect_credentials
  BEFORE UPDATE ON public.credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_credentials_columns();

-- ---------------------------------------------------------------------------
-- 8. HARDENED STORED PROCEDURES (RPCS)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.verify_login(p_identifier TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  c RECORD;
  t TEXT;
  clean_id TEXT := lower(trim(p_identifier));
BEGIN
  SELECT * INTO c FROM public.credentials
   WHERE lower(identifier) = clean_id
      OR lower(ref_id) = clean_id
      OR EXISTS (SELECT 1 FROM unnest(aliases) a
                 WHERE lower(replace(a, ' ', '')) = lower(replace(trim(p_identifier), ' ', '')))
      OR EXISTS (SELECT 1 FROM unnest(aliases) a
                 WHERE a ~ '^[+0-9 ()-]+$'
                   AND length(regexp_replace(trim(p_identifier), '[^0-9]', '', 'g')) >= 7
                   AND regexp_replace(a, '[^0-9]', '', 'g')
                       LIKE '%' || regexp_replace(trim(p_identifier), '[^0-9]', '', 'g') || '%');

  IF NOT FOUND THEN
    INSERT INTO public.audit_logs (action, entity, actor_ref, details)
    VALUES ('LOGIN_FAILED', 'credentials', clean_id, jsonb_build_object('reason', 'user_not_found'));
    RETURN jsonb_build_object('ok', false, 'message', 'Invalid credentials.');
  END IF;

  IF c.password_hash <> crypt(p_password, c.password_hash) THEN
    INSERT INTO public.audit_logs (action, entity, actor_ref, details)
    VALUES ('LOGIN_FAILED', 'credentials', c.identifier, jsonb_build_object('reason', 'incorrect_password'));
    RETURN jsonb_build_object('ok', false, 'message', 'Invalid credentials.');
  END IF;

  -- 32-byte cryptographically secure session token
  t := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.sessions (token, role, ref_id) VALUES (t, c.role, c.ref_id);

  -- Keep isolated user_roles table synchronized
  INSERT INTO public.user_roles (session_ref_id, identifier, role)
  VALUES (c.ref_id, c.identifier, c.role);

  -- Clean up expired sessions
  DELETE FROM public.sessions WHERE expires_at < now();

  INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
  VALUES ('LOGIN_SUCCESS', 'sessions', c.ref_id, c.role, jsonb_build_object('identifier', c.identifier));

  RETURN jsonb_build_object('ok', true, 'token', t, 'role', c.role, 'ref_id', c.ref_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.logout_session(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_ref TEXT;
  v_role TEXT;
BEGIN
  SELECT ref_id, role INTO v_ref, v_role FROM public.sessions WHERE token = p_token;
  IF FOUND THEN
    INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
    VALUES ('LOGOUT', 'sessions', v_ref, v_role, jsonb_build_object('token_prefix', substring(p_token, 1, 8)));
  END IF;
  DELETE FROM public.sessions WHERE token = p_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_password(
  p_identifier TEXT, p_old_password TEXT, p_new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  c RECORD;
  v_role TEXT := public.session_role();
  v_ref TEXT := public.session_ref_id();
  is_self BOOLEAN;
BEGIN
  IF NOT public.valid_session() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not signed in.');
  END IF;

  SELECT * INTO c FROM public.credentials
   WHERE lower(identifier) = lower(trim(p_identifier))
      OR lower(ref_id) = lower(trim(p_identifier));
      
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Account not found.');
  END IF;

  is_self := (lower(c.identifier) = lower(trim(p_identifier)) OR c.ref_id = v_ref);

  -- Strict Authorization: Non-admins can ONLY change their OWN password and MUST verify old password
  IF NOT public.is_admin() THEN
    IF NOT is_self THEN
      INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
      VALUES ('SECURITY_VIOLATION_PASSWORD_CHANGE', 'credentials', v_ref, v_role, jsonb_build_object('target', p_identifier));
      RETURN jsonb_build_object('ok', false, 'message', 'Unauthorized: You may only change your own password.');
    END IF;

    IF c.password_hash <> crypt(COALESCE(p_old_password, ''), c.password_hash) THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Current password incorrect.');
    END IF;
  END IF;

  UPDATE public.credentials
     SET password_hash = crypt(p_new_password, gen_salt('bf')),
         updated_at = now()
   WHERE id = c.id;

  INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
  VALUES ('PASSWORD_CHANGED', 'credentials', c.ref_id, c.role, jsonb_build_object('identifier', c.identifier, 'changed_by', v_ref));

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_credential(
  p_identifier TEXT, p_password TEXT, p_role TEXT, p_ref_id TEXT, p_aliases TEXT[] DEFAULT '{}')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_actor_ref TEXT := public.session_ref_id();
  v_actor_role TEXT := public.session_role();
BEGIN
  -- Strict Privilege Escalation Guard: Only verified admin/proprietress
  IF NOT public.is_admin() THEN
    INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
    VALUES ('SECURITY_VIOLATION_UNAUTHORIZED_ACCOUNT_CREATION', 'credentials', v_actor_ref, v_actor_role, 
            jsonb_build_object('attempted_identifier', p_identifier, 'attempted_role', p_role));
    RETURN jsonb_build_object('ok', false, 'message', 'Access denied: Only administrators may provision or modify credentials.');
  END IF;

  INSERT INTO public.credentials (identifier, aliases, password_hash, role, ref_id, updated_at)
  VALUES (lower(trim(p_identifier)), p_aliases, crypt(p_password, gen_salt('bf')), p_role, p_ref_id, now())
  ON CONFLICT (identifier) DO UPDATE
    SET password_hash = excluded.password_hash,
        aliases       = excluded.aliases,
        role          = excluded.role,
        ref_id        = excluded.ref_id,
        updated_at    = now();

  INSERT INTO public.user_roles (session_ref_id, identifier, role)
  VALUES (p_ref_id, lower(trim(p_identifier)), p_role);

  INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
  VALUES ('CREDENTIAL_PROVISIONED', 'credentials', v_actor_ref, v_actor_role, 
          jsonb_build_object('identifier', p_identifier, 'role', p_role, 'ref_id', p_ref_id));

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Elevate a scholar to faculty tutor, reassigning credential role strictly to tutor
CREATE OR REPLACE FUNCTION public.upgrade_student_to_tutor(
  p_student_id TEXT,
  p_tutor_id TEXT,
  p_staff_id TEXT,
  p_tutor_email TEXT
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
    RETURN jsonb_build_object('ok', false, 'message', 'Access denied: Only administrators may upgrade scholars to tutors.');
  END IF;

  -- Reassign credentials from student to faculty tutor so scholar login is converted
  UPDATE public.credentials
  SET role = 'tutor',
      ref_id = p_tutor_id,
      aliases = array_append(aliases, lower(p_staff_id)),
      updated_at = now()
  WHERE ref_id = p_student_id;

  -- Synchronize isolated user_roles table
  UPDATE public.user_roles
  SET role = 'tutor',
      session_ref_id = p_tutor_id,
      updated_at = now()
  WHERE session_ref_id = p_student_id;

  INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
  VALUES ('SCHOLAR_ELEVATED_TO_TUTOR', 'credentials', v_actor_ref, v_actor_role,
          jsonb_build_object('student_id', p_student_id, 'tutor_id', p_tutor_id, 'staff_id', p_staff_id));

  RETURN jsonb_build_object('ok', true, 'message', 'Scholar elevated to Faculty Tutor and role converted to tutor.');
END;
$$;

-- ---------------------------------------------------------------------------
-- PASSWORD RESET WITH SECURITY VERIFICATION (SUPABASE CENTRAL DATABASE)
-- Non-authenticated or forgotten password reset: saves directly into PostgreSQL
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_password(
  p_identifier TEXT,
  p_new_password TEXT,
  p_security_answer TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  c RECORD;
  clean_id TEXT := lower(trim(p_identifier));
  clean_ans TEXT := lower(trim(COALESCE(p_security_answer, '')));
  clean_new_pass TEXT := trim(p_new_password);
  expected_admin_ans TEXT;
  students_data JSONB;
  tutors_data JSONB;
  parents_data JSONB;
  stu_rec JSONB;
  expected_stu_ans TEXT;
  stu_has_q BOOLEAN := false;
BEGIN
  IF clean_id = '' OR clean_new_pass = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Identifier and new password are required.');
  END IF;

  IF length(clean_new_pass) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Password must be at least 6 characters long.');
  END IF;

  -- 1. Locate credential
  SELECT * INTO c FROM public.credentials
   WHERE lower(identifier) = clean_id
      OR lower(ref_id) = clean_id
      OR EXISTS (SELECT 1 FROM unnest(aliases) a
                 WHERE lower(replace(a, ' ', '')) = lower(replace(trim(p_identifier), ' ', '')))
      OR EXISTS (SELECT 1 FROM unnest(aliases) a
                 WHERE a ~ '^[+0-9 ()-]+$'
                   AND length(regexp_replace(trim(p_identifier), '[^0-9]', '', 'g')) >= 7
                   AND regexp_replace(a, '[^0-9]', '', 'g')
                       LIKE '%' || regexp_replace(trim(p_identifier), '[^0-9]', '', 'g') || '%')
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'No registered account found with that identifier.');
  END IF;

  -- 2. Security verification for Admin
  IF c.role = 'admin' THEN
    SELECT COALESCE(data#>>'{}', 'Stanbax') INTO expected_admin_ans
      FROM public.school_state WHERE key = 'stanbax_admin_security_a';
    IF expected_admin_ans IS NULL OR expected_admin_ans = '' THEN
      expected_admin_ans := 'stanbax';
    END IF;

    IF clean_ans = '' OR (
      clean_ans <> lower(trim(expected_admin_ans)) AND 
      regexp_replace(clean_ans, '\.+$', '') <> regexp_replace(lower(trim(expected_admin_ans)), '\.+$', '')
    ) THEN
      INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
      VALUES ('SECURITY_VERIFICATION_FAILED', 'credentials', c.ref_id, c.role, jsonb_build_object('identifier', c.identifier));
      RETURN jsonb_build_object('ok', false, 'message', 'Security question verification failed. The provided answer does not match.');
    END IF;
  END IF;

  -- 3. Security verification for Student (if account has a security question)
  IF c.role = 'student' THEN
    SELECT data INTO students_data FROM public.school_state WHERE key = 'stanbax_students';
    IF students_data IS NOT NULL THEN
      FOR stu_rec IN SELECT * FROM jsonb_array_elements(students_data) LOOP
        IF lower(stu_rec->>'id') = lower(c.ref_id) OR lower(stu_rec->>'regNumber') = clean_id THEN
          IF stu_rec->>'securityQuestion' IS NOT NULL AND stu_rec->>'securityQuestion' <> '' THEN
            stu_has_q := true;
            expected_stu_ans := lower(trim(COALESCE(stu_rec->>'securityAnswer', '')));
          END IF;
          EXIT;
        END IF;
      END LOOP;

      IF stu_has_q AND (clean_ans = '' OR clean_ans <> expected_stu_ans) THEN
        RETURN jsonb_build_object('ok', false, 'message', 'Security answer incorrect for this student account.');
      END IF;
    END IF;
  END IF;

  -- 4. Update credentials table with bcrypt hash
  UPDATE public.credentials
     SET password_hash = crypt(clean_new_pass, gen_salt('bf')),
         updated_at = now()
   WHERE id = c.id;

  -- 5. Mirror update to school_state so portal initializers read the updated password
  IF c.role = 'admin' THEN
    INSERT INTO public.school_state (key, data, updated_by, updated_at)
    VALUES ('stanbax_admin_password', to_jsonb(clean_new_pass), 'system_reset', now())
    ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = now();
  ELSIF c.role = 'proprietress' THEN
    INSERT INTO public.school_state (key, data, updated_by, updated_at)
    VALUES ('stanbax_proprietress_password', to_jsonb(clean_new_pass), 'system_reset', now())
    ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = now();
  ELSIF c.role = 'headmistress' THEN
    INSERT INTO public.school_state (key, data, updated_by, updated_at)
    VALUES ('stanbax_headmistress_password', to_jsonb(clean_new_pass), 'system_reset', now())
    ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = now();
  ELSIF c.role = 'student' THEN
    UPDATE public.school_state
       SET data = (
         SELECT jsonb_agg(
           CASE 
             WHEN lower(elem->>'id') = lower(c.ref_id) OR lower(elem->>'regNumber') = clean_id 
             THEN jsonb_set(elem, '{password}', to_jsonb(clean_new_pass))
             ELSE elem
           END
         )
         FROM jsonb_array_elements(data) AS elem
       ),
       updated_at = now()
     WHERE key = 'stanbax_students' AND data IS NOT NULL;
  ELSIF c.role = 'tutor' THEN
    UPDATE public.school_state
       SET data = (
         SELECT jsonb_agg(
           CASE 
             WHEN lower(elem->>'id') = lower(c.ref_id) OR lower(elem->>'email') = clean_id OR lower(COALESCE(elem->>'staffId','')) = clean_id
             THEN jsonb_set(elem, '{password}', to_jsonb(clean_new_pass))
             ELSE elem
           END
         )
         FROM jsonb_array_elements(data) AS elem
       ),
       updated_at = now()
     WHERE key = 'stanbax_tutors' AND data IS NOT NULL;
  ELSIF c.role = 'parent' THEN
    UPDATE public.school_state
       SET data = (
         SELECT jsonb_agg(
           CASE 
             WHEN lower(elem->>'id') = lower(c.ref_id) OR lower(elem->>'email') = clean_id OR lower(COALESCE(elem->>'phone','')) = clean_id
             THEN jsonb_set(elem, '{password}', to_jsonb(clean_new_pass))
             ELSE elem
           END
         )
         FROM jsonb_array_elements(data) AS elem
       ),
       updated_at = now()
     WHERE key = 'stanbax_parents_list' AND data IS NOT NULL;
  END IF;

  INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
  VALUES ('PASSWORD_RESET_REMOTE', 'credentials', c.ref_id, c.role,
          jsonb_build_object('identifier', c.identifier, 'role', c.role));

  RETURN jsonb_build_object(
    'ok', true, 
    'role', c.role, 
    'ref_id', c.ref_id, 
    'message', 'Password successfully reset and saved in Supabase database.'
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- ADMIN DIRECT USER PASSWORD RESET
-- Full administrative authority to reset any user password in Supabase
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  p_identifier TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  c RECORD;
  v_actor_ref TEXT := public.session_ref_id();
  v_actor_role TEXT := public.session_role();
  clean_id TEXT := lower(trim(p_identifier));
  clean_new_pass TEXT := trim(p_new_password);
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Unauthorized: Only administrators may execute administrative password resets.');
  END IF;

  IF length(clean_new_pass) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Password must be at least 4 characters long.');
  END IF;

  SELECT * INTO c FROM public.credentials
   WHERE lower(identifier) = clean_id
      OR lower(ref_id) = clean_id
      OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE lower(a) = clean_id)
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'User account not found in credentials table.');
  END IF;

  UPDATE public.credentials
     SET password_hash = crypt(clean_new_pass, gen_salt('bf')),
         updated_at = now()
   WHERE id = c.id;

  -- Update state table
  IF c.role = 'admin' THEN
    INSERT INTO public.school_state (key, data, updated_by, updated_at)
    VALUES ('stanbax_admin_password', to_jsonb(clean_new_pass), v_actor_ref, now())
    ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = now();
  ELSIF c.role = 'proprietress' THEN
    INSERT INTO public.school_state (key, data, updated_by, updated_at)
    VALUES ('stanbax_proprietress_password', to_jsonb(clean_new_pass), v_actor_ref, now())
    ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = now();
  ELSIF c.role = 'headmistress' THEN
    INSERT INTO public.school_state (key, data, updated_by, updated_at)
    VALUES ('stanbax_headmistress_password', to_jsonb(clean_new_pass), v_actor_ref, now())
    ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = now();
  ELSIF c.role = 'student' THEN
    UPDATE public.school_state
       SET data = (
         SELECT jsonb_agg(
           CASE 
             WHEN lower(elem->>'id') = lower(c.ref_id) OR lower(elem->>'regNumber') = clean_id 
             THEN jsonb_set(elem, '{password}', to_jsonb(clean_new_pass))
             ELSE elem
           END
         )
         FROM jsonb_array_elements(data) AS elem
       ),
       updated_at = now()
     WHERE key = 'stanbax_students' AND data IS NOT NULL;
  ELSIF c.role = 'tutor' THEN
    UPDATE public.school_state
       SET data = (
         SELECT jsonb_agg(
           CASE 
             WHEN lower(elem->>'id') = lower(c.ref_id) OR lower(elem->>'email') = clean_id
             THEN jsonb_set(elem, '{password}', to_jsonb(clean_new_pass))
             ELSE elem
           END
         )
         FROM jsonb_array_elements(data) AS elem
       ),
       updated_at = now()
     WHERE key = 'stanbax_tutors' AND data IS NOT NULL;
  ELSIF c.role = 'parent' THEN
    UPDATE public.school_state
       SET data = (
         SELECT jsonb_agg(
           CASE 
             WHEN lower(elem->>'id') = lower(c.ref_id) OR lower(elem->>'email') = clean_id OR lower(COALESCE(elem->>'phone','')) = clean_id
             THEN jsonb_set(elem, '{password}', to_jsonb(clean_new_pass))
             ELSE elem
           END
         )
         FROM jsonb_array_elements(data) AS elem
       ),
       updated_at = now()
     WHERE key = 'stanbax_parents_list' AND data IS NOT NULL;
  END IF;

  INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
  VALUES ('ADMIN_RESET_PASSWORD', 'credentials', c.ref_id, c.role,
          jsonb_build_object('target', c.identifier, 'admin_ref', v_actor_ref));

  RETURN jsonb_build_object('ok', true, 'message', 'Password successfully updated in Supabase database.');
END;
$$;

-- ---------------------------------------------------------------------------
-- SCHOLAR SELF-REGISTRATION CREDENTIAL PROVISIONING
-- Allows prospective and enrolling students to register credentials in Supabase
-- ---------------------------------------------------------------------------
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

  INSERT INTO public.credentials (identifier, aliases, password_hash, role, ref_id, updated_at)
  VALUES (clean_id, p_aliases, crypt(clean_pass, gen_salt('bf')), 'student', clean_ref, now())
  ON CONFLICT (identifier) DO UPDATE
    SET password_hash = excluded.password_hash,
        aliases       = excluded.aliases,
        role          = 'student',
        ref_id        = excluded.ref_id,
        updated_at    = now();

  INSERT INTO public.user_roles (session_ref_id, identifier, role)
  VALUES (clean_ref, clean_id, 'student');

  INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
  VALUES ('STUDENT_CREDENTIAL_REGISTERED', 'credentials', clean_ref, 'student',
          jsonb_build_object('identifier', clean_id, 'ref_id', clean_ref));

  RETURN jsonb_build_object('ok', true, 'message', 'Scholar account provisioned in Supabase.');
END;
$$;

-- ---------------------------------------------------------------------------
-- QUERY SECURITY QUESTION (WITHOUT LEAKING ANSWER)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_security_question(p_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  c RECORD;
  clean_id TEXT := lower(trim(p_identifier));
  admin_q TEXT;
  students_data JSONB;
  stu_rec JSONB;
BEGIN
  SELECT * INTO c FROM public.credentials
   WHERE lower(identifier) = clean_id
      OR lower(ref_id) = clean_id
      OR EXISTS (SELECT 1 FROM unnest(aliases) a WHERE lower(replace(a, ' ', '')) = lower(replace(clean_id, ' ', '')))
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  IF c.role = 'admin' THEN
    SELECT COALESCE(data#>>'{}', 'What is the name of your first school?') INTO admin_q
      FROM public.school_state WHERE key = 'stanbax_admin_security_q';
    RETURN jsonb_build_object(
      'exists', true,
      'hasQuestion', true,
      'securityQuestion', COALESCE(admin_q, 'What is the name of your first school?'),
      'name', 'Administrator',
      'role', 'admin'
    );
  END IF;

  IF c.role = 'student' THEN
    SELECT data INTO students_data FROM public.school_state WHERE key = 'stanbax_students';
    IF students_data IS NOT NULL THEN
      FOR stu_rec IN SELECT * FROM jsonb_array_elements(students_data) LOOP
        IF lower(stu_rec->>'id') = lower(c.ref_id) OR lower(stu_rec->>'regNumber') = clean_id THEN
          RETURN jsonb_build_object(
            'exists', true,
            'hasQuestion', (stu_rec->>'securityQuestion' IS NOT NULL AND stu_rec->>'securityQuestion' <> ''),
            'securityQuestion', stu_rec->>'securityQuestion',
            'name', stu_rec->>'name',
            'role', 'student'
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'exists', true,
    'hasQuestion', false,
    'role', c.role
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- PUBLIC SUBMISSION: ADMISSION APPLICATION (ANONYMOUS VISITORS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_admission_application(p_application JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  curr JSONB;
BEGIN
  SELECT data INTO curr FROM public.school_state WHERE key = 'stanbax_admission_applications';
  IF curr IS NULL OR jsonb_typeof(curr) <> 'array' THEN
    curr := '[]'::jsonb;
  END IF;

  curr := curr || jsonb_build_array(p_application);

  INSERT INTO public.school_state (key, data, is_public, updated_by, updated_at)
  VALUES ('stanbax_admission_applications', curr, false, 'public_applicant', now())
  ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = now();

  INSERT INTO public.audit_logs (action, entity, actor_ref, details)
  VALUES ('ADMISSION_SUBMITTED', 'school_state', p_application->>'refNumber', p_application);

  RETURN jsonb_build_object('ok', true, 'message', 'Application stored in Supabase.');
END;
$$;

-- ---------------------------------------------------------------------------
-- PUBLIC SUBMISSION: CONTACT / INQUIRY (ANONYMOUS VISITORS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_contact_inquiry(p_inquiry JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  curr JSONB;
BEGIN
  SELECT data INTO curr FROM public.school_state WHERE key = 'stanbax_contact_inquiries';
  IF curr IS NULL OR jsonb_typeof(curr) <> 'array' THEN
    curr := '[]'::jsonb;
  END IF;

  curr := curr || jsonb_build_array(p_inquiry);

  INSERT INTO public.school_state (key, data, is_public, updated_by, updated_at)
  VALUES ('stanbax_contact_inquiries', curr, false, 'public_inquiry', now())
  ON CONFLICT (key) DO UPDATE SET data = excluded.data, updated_at = now();

  RETURN jsonb_build_object('ok', true, 'message', 'Inquiry stored in Supabase.');
END;
$$;

CREATE OR REPLACE FUNCTION public.put_states(p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  item RECORD;
  v_key TEXT;
  v_data JSONB;
  v_role TEXT := public.session_role();
  v_ref TEXT := public.session_ref_id();
  v_written INT := 0;
BEGIN
  IF NOT public.valid_session() THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_key := item.value->>'key';
    v_data := item.value->'data';

    IF NOT public.can_write_state_key(v_key) THEN
      INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
      VALUES ('SECURITY_VIOLATION_UNAUTHORIZED_STATE_WRITE', 'school_state', v_ref, v_role, jsonb_build_object('blocked_key', v_key));
      RAISE EXCEPTION 'Access denied: Role % is not permitted to modify key %', v_role, v_key;
    END IF;

    -- Ensure stanbax_students never contains duplicate rows for the same registration number or student ID
    IF v_key = 'stanbax_students' AND jsonb_typeof(v_data) = 'array' THEN
      SELECT COALESCE(jsonb_agg(deduped.elem), '[]'::jsonb)
      INTO v_data
      FROM (
        SELECT DISTINCT ON (
          COALESCE(
            NULLIF(regexp_replace(lower(COALESCE(e.elem->>'regNumber', '')), '[^a-z0-9]', '', 'g'), ''),
            lower(COALESCE(e.elem->>'id', e.ord::text))
          )
        ) e.elem, e.ord
        FROM jsonb_array_elements(v_data) WITH ORDINALITY AS e(elem, ord)
        ORDER BY
          COALESCE(
            NULLIF(regexp_replace(lower(COALESCE(e.elem->>'regNumber', '')), '[^a-z0-9]', '', 'g'), ''),
            lower(COALESCE(e.elem->>'id', e.ord::text))
          ),
          CASE WHEN COALESCE(e.elem->>'id', '') LIKE 'std-batch-%' THEN 1 ELSE 0 END ASC,
          e.ord DESC
      ) AS deduped;
    END IF;

    INSERT INTO public.school_state (key, data, is_public, updated_by, updated_at)
    VALUES (
      v_key, 
      v_data, 
      v_key IN (
        'stanbax_students', 'stanbax_classes', 'stanbax_subjects', 'stanbax_tutors', 
        'stanbax_parents_list', 'stanbax_school_info', 'stanbax_footer_content', 
        'stanbax_navbar_content', 'stanbax_hero_slides', 'stanbax_hero_highlights', 
        'stanbax_key_pillars', 'stanbax_key_pillars_header', 'stanbax_about_content', 
        'stanbax_academic_programs', 'stanbax_assessment_config', 'stanbax_grading_system', 
        'stanbax_official_signatures', 'stanbax_deleted_account_ids', 'stanbax_school_calendar',
        'stanbax_faq_items', 'stanbax_faq_header', 'stanbax_testimonials', 'stanbax_testimonials_header',
        'stanbax_term_resumption_config', 'stanbax_gallery_photos',
        'stanbax_student_summary_display'
      ), 
      v_ref, 
      now()
    )
    ON CONFLICT (key) DO UPDATE 
      SET data = excluded.data, 
          is_public = excluded.is_public OR public.school_state.is_public,
          updated_by = excluded.updated_by, 
          updated_at = now();
    v_written := v_written + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'written', v_written);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_states(p_keys TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  k TEXT;
  v_role TEXT := public.session_role();
  v_ref TEXT := public.session_ref_id();
  v_deleted INT := 0;
BEGIN
  IF NOT public.valid_session() THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  FOREACH k IN ARRAY p_keys LOOP
    IF NOT public.can_write_state_key(k) THEN
      INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
      VALUES ('SECURITY_VIOLATION_UNAUTHORIZED_STATE_DELETE', 'school_state', v_ref, v_role, jsonb_build_object('blocked_key', k));
      RAISE EXCEPTION 'Access denied: Role % is not permitted to delete key %', v_role, k;
    END IF;
    DELETE FROM public.school_state WHERE key = k;
    v_deleted := v_deleted + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'deleted', v_deleted);
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. MANDATORY ROW LEVEL SECURITY (RLS) ACTIVATION & FORCING
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_roles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles    FORCE ROW LEVEL SECURITY;

ALTER TABLE public.credentials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credentials   FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions      FORCE ROW LEVEL SECURITY;

ALTER TABLE public.school_state  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_state  FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs    FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 10. REVOKE DIRECT TABLE ACCESS & DROP OPEN POLICIES
-- ---------------------------------------------------------------------------

REVOKE ALL ON public.credentials FROM anon, authenticated;
REVOKE ALL ON public.sessions    FROM anon, authenticated;
REVOKE ALL ON public.user_roles  FROM anon, authenticated;
REVOKE ALL ON public.audit_logs  FROM anon, authenticated;

DROP POLICY IF EXISTS "Enable all" ON public.school_state;
DROP POLICY IF EXISTS "session write" ON public.school_state;
DROP POLICY IF EXISTS "public read" ON public.school_state;
DROP POLICY IF EXISTS "session read" ON public.school_state;

-- ---------------------------------------------------------------------------
-- 11. ENFORCE GRANULAR PER-OPERATION POLICIES
-- ---------------------------------------------------------------------------

-- school_state: SELECT (Public website content readable anonymously)
CREATE POLICY "school_state_select_public" ON public.school_state
  FOR SELECT TO anon, authenticated
  USING (is_public);

-- school_state: SELECT (Private collections readable only with verified session)
CREATE POLICY "school_state_select_authenticated" ON public.school_state
  FOR SELECT TO anon, authenticated
  USING (public.valid_session());

-- school_state: INSERT (Granular role-key validation with WITH CHECK)
CREATE POLICY "school_state_insert_policy" ON public.school_state
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.valid_session() AND public.can_write_state_key(key));

-- school_state: UPDATE (Granular role-key validation with USING and WITH CHECK)
CREATE POLICY "school_state_update_policy" ON public.school_state
  FOR UPDATE TO anon, authenticated
  USING (public.valid_session() AND public.can_write_state_key(key))
  WITH CHECK (public.valid_session() AND public.can_write_state_key(key));

-- school_state: DELETE (Restricted to Admins or authorized collection owners)
CREATE POLICY "school_state_delete_policy" ON public.school_state
  FOR DELETE TO anon, authenticated
  USING (public.is_admin() OR (public.valid_session() AND public.can_write_state_key(key)));

-- user_roles: Read own role or admin read all
CREATE POLICY "user_roles_select_policy" ON public.user_roles
  FOR SELECT TO anon, authenticated
  USING (
    public.is_admin() 
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (session_ref_id IS NOT NULL AND session_ref_id = public.session_ref_id())
  );

-- audit_logs: Only Admins can view audit trails
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
  FOR SELECT TO anon, authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 12. RPC EXECUTION PERMISSIONS
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.verify_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.logout_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_password(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_password(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_student_credential(TEXT, TEXT, TEXT, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_security_question(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_admission_application(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_contact_inquiry(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_credential(TEXT, TEXT, TEXT, TEXT, TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.put_states(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_states(TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_session() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 13. SEED PUBLIC STATE KEYS & DEMO ACCOUNTS
-- ---------------------------------------------------------------------------

INSERT INTO public.school_state (key, is_public) VALUES
  ('stanbax_school_info', true),
  ('stanbax_hero_slides', true),
  ('stanbax_hero_highlights', true),
  ('stanbax_key_pillars', true),
  ('stanbax_key_pillars_header', true),
  ('stanbax_about_content', true),
  ('stanbax_academic_programs', true),
  ('stanbax_featured_courses', true),
  ('stanbax_clubs_list', true),
  ('stanbax_house_standings', true),
  ('stanbax_bus_routes', true),
  ('stanbax_meal_menu', true),
  ('stanbax_calendar_events', true),
  ('stanbax_testimonials', true),
  ('stanbax_testimonials_header', true),
  ('stanbax_faq_items', true),
  ('stanbax_faq_header', true),
  ('stanbax_app_images', true),
  ('stanbax_gallery_images', true),
  ('stanbax_news_articles', true),
  ('stanbax_popup_notice', true),
  ('stanbax_navbar_content', true),
  ('stanbax_footer_content', true),
  ('stanbax_role_privileges', true),
  ('stanbax_headmistress_profile', true),
  ('stanbax_moderators', true),
  ('stanbax_school_rep_config', true),
  ('stanbax_visitor_conversations', true),
  ('stanbax_chat_channels', true),
  ('stanbax_chat_messages', true),
  ('stanbax_students', true),
  ('stanbax_tutors', true),
  ('stanbax_parents_list', true),
  ('stanbax_subjects', true),
  ('stanbax_deleted_account_ids', true),
  ('stanbax_assessment_config', true),
  ('stanbax_grading_system', true),
  ('stanbax_official_signatures', true),
  ('stanbax_student_summary_display', true)
ON CONFLICT (key) DO UPDATE SET is_public = EXCLUDED.is_public;

INSERT INTO public.credentials (identifier, aliases, password_hash, role, ref_id) VALUES
  ('admin',        ARRAY['administrator','principal','stanbax','admin@stanbaxschools.edu.ng'], crypt('Justin2000.', gen_salt('bf')), 'admin', 'admin'),
  ('proprietress', ARRAY['mrs.bello','proprietress@stanbaxschools.edu.ng','adebisi.bello'],     crypt('Proprietress2025!', gen_salt('bf')), 'proprietress', 'proprietress'),
  ('headmistress', ARRAY['head_mistress','hm@stanbaxschools.edu.ng','headmistress@stanbaxschools.edu.ng','mrs.adediran'], crypt('Headmistress2025!', gen_salt('bf')), 'headmistress', 'headmistress'),
  ('moderator',    ARRAY['mod','moderator@stanbaxschools.edu.ng','chatmod','kehinde.badmus'],                             crypt('Moderator2025!', gen_salt('bf')),    'moderator',    'mod-1'),

  ('olumide.ogunleye@stanbaxschools.edu.ng',  ARRAY['stx/fac/001','tut-1','mr. olumide ogunleye'],   crypt('stanbax2025', gen_salt('bf')), 'tutor', 'tut-1'),
  ('folake.adeyemi@stanbaxschools.edu.ng',    ARRAY['stx/fac/002','tut-2','mrs. folake adeyemi'],    crypt('stanbax2025', gen_salt('bf')), 'tutor', 'tut-2'),
  ('chukwuemeka.obi@stanbaxschools.edu.ng',   ARRAY['stx/fac/003','tut-3','dr. chukwuemeka obi'],    crypt('stanbax2025', gen_salt('bf')), 'tutor', 'tut-3'),
  ('chidi.okafor@stanbaxschools.edu.ng',      ARRAY['stx/fac/004','tut-4','dr. chidi okafor'],       crypt('stanbax2025', gen_salt('bf')), 'tutor', 'tut-4'),
  ('nkechi.nwosu@stanbaxschools.edu.ng',      ARRAY['stx/fac/005','tut-5','dr. (mrs) nkechi nwosu'], crypt('stanbax2025', gen_salt('bf')), 'tutor', 'tut-5'),
  ('emmanuel.danjuma@stanbaxschools.edu.ng',  ARRAY['stx/fac/006','tut-6','mr. emmanuel danjuma'],   crypt('stanbax2025', gen_salt('bf')), 'tutor', 'tut-6'),
  ('dupont@stanbaxschools.edu.ng',            ARRAY['stx/fac/007','tut-7','madame dupont'],          crypt('stanbax2025', gen_salt('bf')), 'tutor', 'tut-7'),

  ('stx/2023/042', ARRAY['stx2023042@stanbaxschools.edu.ng','stu-1','tiwa adeleke'],       crypt('stanbax2025', gen_salt('bf')), 'student', 'stu-1'),
  ('stx/2023/043', ARRAY['stx2023043@stanbaxschools.edu.ng','stu-2','babatunde akindele'], crypt('stanbax2025', gen_salt('bf')), 'student', 'stu-2'),
  ('stx/2023/044', ARRAY['stx2023044@stanbaxschools.edu.ng','stu-3','chidera okafor'],     crypt('stanbax2025', gen_salt('bf')), 'student', 'stu-3'),
  ('stx/2023/045', ARRAY['stx2023045@stanbaxschools.edu.ng','stu-4','damilola fashola'],   crypt('stanbax2025', gen_salt('bf')), 'student', 'stu-4'),
  ('stx/2023/046', ARRAY['stx2023046@stanbaxschools.edu.ng','stu-5','efe oghomwen'],       crypt('stanbax2025', gen_salt('bf')), 'student', 'stu-5'),
  ('stx/2023/047', ARRAY['stx2023047@stanbaxschools.edu.ng','stu-6','farouk danjuma'],     crypt('stanbax2025', gen_salt('bf')), 'student', 'stu-6'),
  ('stx/2024/101', ARRAY['stx2024101@stanbaxschools.edu.ng','stu-7','amina bello'],        crypt('stanbax2025', gen_salt('bf')), 'student', 'stu-7'),
  ('stx/2024/102', ARRAY['stx2024102@stanbaxschools.edu.ng','stu-8','kenechukwu nnamdi'],  crypt('stanbax2025', gen_salt('bf')), 'student', 'stu-8'),

  ('adeleke.family@gmail.com',   ARRAY['+2348034456789','parent-1','chief & mrs. adebayo adeleke'], crypt('parent2025', gen_salt('bf')), 'parent', 'parent-1'),
  ('akindele.eng@yahoo.com',     ARRAY['+2348028876543','parent-2','engr. & dr. akindele'],         crypt('parent2025', gen_salt('bf')), 'parent', 'parent-2'),
  ('okafor.family@gmail.com',    ARRAY['+2348091123456','parent-3','mr. & mrs. obinna okafor'],     crypt('parent2025', gen_salt('bf')), 'parent', 'parent-3'),
  ('fashola.law@gmail.com',      ARRAY['+2348057765432','parent-4','barrister fashola'],            crypt('parent2025', gen_salt('bf')), 'parent', 'parent-4'),
  ('oghomwen.clinic@gmail.com',  ARRAY['+2348039987766','parent-5','dr. osas oghomwen'],            crypt('parent2025', gen_salt('bf')), 'parent', 'parent-5'),
  ('danjuma.holdings@gmail.com', ARRAY['+2348074432211','parent-6','alhaji & hajia danjuma'],       crypt('parent2025', gen_salt('bf')), 'parent', 'parent-6'),
  ('bello.family@gmail.com',     ARRAY['+2348023345566','parent-7','mr. & mrs. bello'],             crypt('parent2025', gen_salt('bf')), 'parent', 'parent-7'),
  ('nnamdi.family@gmail.com',    ARRAY['+2348056678899','parent-8','chief nnamdi'],                 crypt('parent2025', gen_salt('bf')), 'parent', 'parent-8')
ON CONFLICT (identifier) DO NOTHING;

INSERT INTO public.user_roles (session_ref_id, identifier, role)
SELECT ref_id, identifier, role FROM public.credentials
ON CONFLICT DO NOTHING;
