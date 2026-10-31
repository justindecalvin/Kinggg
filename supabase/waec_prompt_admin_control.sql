-- ===========================================================================
-- STANBAX SCHOOLS — WAEC Bio-Data Prompt: Admin-Only Control
-- Paste into Supabase Dashboard → SQL Editor → Run once. Safe to re-run.
--
-- The WAEC / WASSCE & Bio-Data prompt used to fire AUTOMATICALLY for every
-- student in senior classes. It is now strictly admin-commanded:
--   * The prompt state lives in school_state under the key
--     'stanbax_waec_prompt_broadcast' (isActive flag + targetClasses).
--   * Writes to that key are already gated by public.can_write_state_key,
--     which grants write authority ONLY to admin & proprietress sessions.
--     Students, tutors, moderators and parents CANNOT flip the toggle:
--     any non-admin write to the key is silently reverted server-side to
--     the last admin-set value, and the attempt is recorded in
--     public.audit_logs (SECURITY_VIOLATION_WAEC_PROMPT_KEY_WRITE).
--   * This migration makes that guarantee explicit and auditable.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Guard: block any non-admin write to the WAEC prompt broadcast key
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_waec_prompt_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_existing JSONB;
BEGIN
  IF COALESCE(NEW.key, '') <> 'stanbax_waec_prompt_broadcast' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Non-admin write: neutralize it (keep the last admin-set value) and
  -- log the attempt. Inserting the audit row and returning a rewritten
  -- NEW (instead of raising) means both survive the statement.
  SELECT data INTO v_existing
    FROM public.school_state
   WHERE key = 'stanbax_waec_prompt_broadcast';

  INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
  VALUES ('SECURITY_VIOLATION_WAEC_PROMPT_KEY_WRITE', 'school_state',
          public.session_ref_id(), public.session_role(),
          jsonb_build_object('attempted_data', NEW.data,
                             'preserved_data', v_existing));

  IF TG_OP = 'UPDATE' THEN
    NEW.data := COALESCE(v_existing, NEW.data);
    NEW.updated_by := 'guard:admin-only';
    RETURN NEW;
  END IF;

  -- INSERT path: replace with the inactive default
  NEW.data := jsonb_build_object(
    'title', 'Mandatory WAEC Bio-Data & 9-Subject Registration',
    'message', '', 'deadline', '',
    'isActive', false, 'targetClasses', '[]'::jsonb,
    'sentBy', 'guard:admin-only');
  NEW.updated_by := 'guard:admin-only';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_waec_prompt ON public.school_state;
CREATE TRIGGER trg_guard_waec_prompt
  BEFORE INSERT OR UPDATE ON public.school_state
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_waec_prompt_key();

-- ---------------------------------------------------------------------------
-- 2. Seed the prompt key as OFF until an administrator turns it on
--    (ON CONFLICT DO NOTHING: an existing admin-set value is preserved)
-- ---------------------------------------------------------------------------
INSERT INTO public.school_state (key, data, is_public, updated_by, updated_at)
VALUES (
  'stanbax_waec_prompt_broadcast',
  jsonb_build_object(
    'title', 'Mandatory WAEC Bio-Data & 9-Subject Registration',
    'message', '',
    'deadline', '',
    'isActive', false,
    'targetClasses', '[]'::jsonb,
    'sentBy', 'system-default'
  ),
  false,
  'system-default',
  now()
)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Verify (run manually to confirm):
--    SELECT key, data->>'isActive' AS prompt_on, updated_by
--      FROM public.school_state
--     WHERE key = 'stanbax_waec_prompt_broadcast';
--
--    Violation attempts are visible via:
--    SELECT created_at, actor_role, details
--      FROM public.audit_logs
--     WHERE action = 'SECURITY_VIOLATION_WAEC_PROMPT_KEY_WRITE'
--     ORDER BY created_at DESC;
-- ---------------------------------------------------------------------------
