-- Admin-triggered first-login password change.
-- Run after schema.sql and student_first_login_password_change.sql.
-- The RPC sets only the pending-change flag; it never resets or exposes a password.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_require_student_password_change(p_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_actor_ref TEXT := public.session_ref_id();
  v_actor_role TEXT := public.session_role();
  v_identifier TEXT := lower(trim(COALESCE(p_identifier, '')));
  v_matches INTEGER;
  v_student public.credentials%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF NOT public.valid_session() OR v_actor_role <> 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Only a signed-in administrator can require a password change.');
  END IF;

  IF v_identifier = '' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Enter the student login ID, registration number, or student ID.');
  END IF;

  SELECT count(*)::INTEGER
    INTO v_matches
    FROM public.credentials AS c
   WHERE c.role = 'student'
     AND (
       lower(c.identifier) = v_identifier
       OR lower(COALESCE(c.ref_id, '')) = v_identifier
       OR EXISTS (
         SELECT 1
           FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[])) AS aliases(alias_value)
          WHERE lower(trim(aliases.alias_value)) = v_identifier
       )
     );

  IF v_matches = 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'No student account matched that exact identifier.');
  ELSIF v_matches > 1 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'That identifier matches more than one student. Use the exact student login ID or registration number.');
  END IF;

  SELECT c.*
    INTO v_student
    FROM public.credentials AS c
   WHERE c.role = 'student'
     AND (
       lower(c.identifier) = v_identifier
       OR lower(COALESCE(c.ref_id, '')) = v_identifier
       OR EXISTS (
         SELECT 1
           FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[])) AS aliases(alias_value)
          WHERE lower(trim(aliases.alias_value)) = v_identifier
       )
     )
   FOR UPDATE;

  IF v_student.must_change_password THEN
    RETURN jsonb_build_object(
      'ok', true,
      'required', true,
      'already_required', true,
      'identifier', v_student.identifier,
      'message', 'This student is already required to change their password at next sign-in.'
    );
  END IF;

  UPDATE public.credentials
     SET must_change_password = TRUE,
         updated_at = v_now
   WHERE id = v_student.id;

  -- Keep the shared Admin-facing profile in sync using a non-secret status marker.
  UPDATE public.school_state AS state
     SET data = (
       SELECT jsonb_agg(
         CASE
           WHEN lower(COALESCE(items.elem->>'id', '')) = lower(COALESCE(v_student.ref_id, ''))
             OR lower(COALESCE(items.elem->>'regNumber', '')) = lower(v_student.identifier)
           THEN jsonb_set(
                  jsonb_set(
                    jsonb_set(items.elem, '{password}', to_jsonb('[Change on first login]'::TEXT), TRUE),
                    '{passwordChangedAt}', 'null'::JSONB, TRUE
                  ),
                  '{updatedAt}', to_jsonb(v_now), TRUE
                )
           ELSE items.elem
         END
         ORDER BY items.ordinality
       )
       FROM jsonb_array_elements(state.data) WITH ORDINALITY AS items(elem, ordinality)
     ),
     updated_at = v_now
   WHERE state.key = 'stanbax_students'
     AND jsonb_typeof(state.data) = 'array';

  INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
  VALUES (
    'STUDENT_PASSWORD_CHANGE_REQUIRED',
    'credentials',
    v_actor_ref,
    v_actor_role,
    jsonb_build_object(
      'identifier', v_student.identifier,
      'student_ref_id', v_student.ref_id,
      'triggered_at', v_now
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'required', true,
    'already_required', false,
    'identifier', v_student.identifier,
    'message', 'The student must set a new password at their next sign-in.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_require_student_password_change(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_require_student_password_change(TEXT) TO anon, authenticated;

-- Bulk action: set the next-login password-change requirement on every student account.
CREATE OR REPLACE FUNCTION public.admin_require_all_students_password_change()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_actor_ref TEXT := public.session_ref_id();
  v_actor_role TEXT := public.session_role();
  v_now TIMESTAMPTZ := now();
  v_total_students INTEGER := 0;
  v_newly_flagged INTEGER := 0;
BEGIN
  IF NOT public.valid_session() OR v_actor_role <> 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Only a signed-in administrator can require all students to change passwords.');
  END IF;

  SELECT count(*)::INTEGER
    INTO v_total_students
    FROM public.credentials
   WHERE role = 'student';

  UPDATE public.credentials
     SET must_change_password = TRUE,
         updated_at = v_now
   WHERE role = 'student'
     AND must_change_password IS DISTINCT FROM TRUE;
  GET DIAGNOSTICS v_newly_flagged = ROW_COUNT;

  -- Update shared Admin-facing profiles with a non-secret pending status.
  UPDATE public.school_state AS state
     SET data = (
       SELECT jsonb_agg(
         CASE
           WHEN EXISTS (
             SELECT 1
               FROM public.credentials AS c
              WHERE c.role = 'student'
                AND (
                  lower(COALESCE(c.ref_id, '')) = lower(COALESCE(items.elem->>'id', ''))
                  OR lower(c.identifier) = lower(COALESCE(items.elem->>'regNumber', ''))
                  OR EXISTS (
                    SELECT 1
                      FROM unnest(COALESCE(c.aliases, ARRAY[]::TEXT[])) AS aliases(alias_value)
                     WHERE lower(trim(aliases.alias_value)) = lower(trim(COALESCE(items.elem->>'regNumber', '')))
                  )
                )
           )
           THEN jsonb_set(
                  jsonb_set(
                    jsonb_set(items.elem, '{password}', to_jsonb('[Change on first login]'::TEXT), TRUE),
                    '{passwordChangedAt}', 'null'::JSONB, TRUE
                  ),
                  '{updatedAt}', to_jsonb(v_now), TRUE
                )
           ELSE items.elem
         END
         ORDER BY items.ordinality
       )
       FROM jsonb_array_elements(state.data) WITH ORDINALITY AS items(elem, ordinality)
     ),
     updated_at = v_now
   WHERE state.key = 'stanbax_students'
     AND jsonb_typeof(state.data) = 'array';

  INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
  VALUES (
    'ALL_STUDENT_PASSWORD_CHANGE_REQUIRED',
    'credentials',
    v_actor_ref,
    v_actor_role,
    jsonb_build_object(
      'total_student_accounts', v_total_students,
      'newly_flagged_accounts', v_newly_flagged,
      'triggered_at', v_now
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'required', true,
    'total_students', v_total_students,
    'newly_flagged', v_newly_flagged,
    'message', format('%s student accounts are now required to change their password at next sign-in; %s were newly flagged.', v_total_students, v_newly_flagged)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_require_all_students_password_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_require_all_students_password_change() TO anon, authenticated;

COMMIT;
