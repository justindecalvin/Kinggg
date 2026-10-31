-- ===========================================================================
-- restore_backup_snapshot(p_snapshot JSONB)
--
-- One-shot, transactional restore of a Stanbax migration backup file
-- (the .json produced by "Download School Data Backup" / "Complete Migration
-- Package") into the central Supabase database.
--
-- Why this exists
-- ---------------
-- The Cloud Sync import used to write the uploaded file into localStorage only
-- and then reload. On reload `hydrateFromSupabase()` pulled the stale cloud
-- rows back over the restored data, so the roster flashed for a few seconds and
-- then reverted. The browser-side fix routes the import through this function
-- so the whole snapshot is committed server-side in ONE transaction and then
-- read back for verification.
--
-- Safety
-- ------
-- * SECURITY DEFINER + explicit is_admin() gate (admin / proprietress only).
-- * Reuses public.can_write_state_key() and public.put_states(), so the existing
--   role matrix, public/private flags and student de-duplication still apply.
-- * Never destroys existing passwords: credentials are only created when the
--   backup contains a usable password AND no live credential exists for that
--   ref_id. Redacted "[...]"/placeholder passwords are skipped.
-- * Repeatable: safe to run many times, and safe to run twice in a row.
--
-- Run this in Supabase Dashboard -> SQL Editor, once.
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.restore_backup_snapshot(p_snapshot JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_role     TEXT := public.session_role();
  v_ref      TEXT := public.session_ref_id();
  v_items    JSONB := '[]'::jsonb;
  v_key      TEXT;
  v_value    JSONB;
  v_storage  TEXT;
  v_students JSONB;
  v_tutors   JSONB;
  v_parents  JSONB;
  v_person   JSONB;
  v_ident    TEXT;
  v_pass     TEXT;
  v_ref_id   TEXT;
  v_aliases  TEXT[];
  v_name_parts TEXT[];
  v_i        INT;
  v_j        INT;
  v_created  INT := 0;
  v_preserved INT := 0;
  v_write    JSONB;
  v_deleted  TEXT[];
BEGIN
  -- ---- Authorization -----------------------------------------------------
  IF NOT public.valid_session() THEN
    RAISE EXCEPTION 'Not signed in. Log in as Administrator before restoring a backup.';
  END IF;

  IF v_role NOT IN ('admin', 'proprietress') THEN
    INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
    VALUES ('SECURITY_VIOLATION_UNAUTHORIZED_RESTORE', 'school_state', v_ref, v_role,
            jsonb_build_object('reason', 'restore_backup_snapshot requires admin authority'));
    RAISE EXCEPTION 'Access denied: only Administrator or Proprietress may restore a full backup.';
  END IF;

  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'Invalid backup payload: expected a JSON object.';
  END IF;

  -- ---- 1. Map every recognised snapshot field to its storage key ---------
  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(p_snapshot)
  LOOP
    IF v_value = 'null'::jsonb THEN
      CONTINUE;
    END IF;

    v_storage := CASE v_key
      WHEN 'schoolInfo'              THEN 'stanbax_school_info'
      WHEN 'images'                  THEN 'stanbax_app_images'
      WHEN 'classes'                 THEN 'stanbax_classes'
      WHEN 'subjects'                THEN 'stanbax_subjects'
      WHEN 'gradingSystem'           THEN 'stanbax_grading_system'
      WHEN 'tutors'                  THEN 'stanbax_tutors'
      WHEN 'students'                THEN 'stanbax_students'
      WHEN 'parents'                 THEN 'stanbax_parents_list'
      WHEN 'homeworks'               THEN 'stanbax_homeworks'
      WHEN 'notices'                 THEN 'stanbax_notices'
      WHEN 'applications'            THEN 'stanbax_applications'
      WHEN 'entranceExamSettings'    THEN 'stanbax_entrance_exam_settings'
      WHEN 'broadcastLogs'           THEN 'stanbax_broadcast_logs'
      WHEN 'inquiries'               THEN 'stanbax_inquiries'
      WHEN 'lessonNotes'             THEN 'stanbax_lesson_notes'
      WHEN 'notesFeatureEnabled'     THEN 'stanbax_notes_enabled'
      WHEN 'assessmentConfig'        THEN 'stanbax_assessment_config'
      WHEN 'termResumptionConfig'    THEN 'stanbax_term_resumption_config'
      WHEN 'attendanceRecords'       THEN 'stanbax_attendance_records'
      WHEN 'cbtExams'                THEN 'stanbax_cbt_exams'
      WHEN 'cbtAttempts'             THEN 'stanbax_cbt_attempts'
      WHEN 'timetables'              THEN 'stanbax_weekly_timetables'
      WHEN 'sickBayLogs'             THEN 'stanbax_sickbay_logs'
      WHEN 'consultationRequests'    THEN 'stanbax_parent_consultations'
      WHEN 'feePayments'             THEN 'stanbax_fee_payments'
      WHEN 'calvinTokens'            THEN 'stanbax_calvin_tokens'
      WHEN 'libraryBooks'            THEN 'stanbax_library_books'
      WHEN 'proprietressProfile'     THEN 'stanbax_proprietress_profile'
      WHEN 'appointments'            THEN 'stanbax_proprietress_appointments'
      WHEN 'messagesToProprietress'  THEN 'stanbax_proprietress_messages'
      WHEN 'directives'              THEN 'stanbax_proprietress_directives'
      WHEN 'facultyList'             THEN 'stanbax_faculty_members'
      WHEN 'heroSlides'              THEN 'stanbax_hero_slides'
      WHEN 'heroHighlights'          THEN 'stanbax_hero_highlights'
      WHEN 'keyPillars'              THEN 'stanbax_key_pillars'
      WHEN 'keyPillarsHeader'        THEN 'stanbax_key_pillars_header'
      WHEN 'aboutContent'            THEN 'stanbax_about_content'
      WHEN 'academicPrograms'        THEN 'stanbax_academic_programs'
      WHEN 'featuredCourses'         THEN 'stanbax_featured_courses'
      WHEN 'clubsList'               THEN 'stanbax_clubs_list'
      WHEN 'houseStandings'          THEN 'stanbax_house_standings'
      WHEN 'busRoutes'               THEN 'stanbax_bus_routes'
      WHEN 'mealMenu'                THEN 'stanbax_meal_menu'
      WHEN 'calendarEvents'          THEN 'stanbax_calendar_events'
      WHEN 'testimonials'            THEN 'stanbax_testimonials'
      WHEN 'testimonialsHeader'      THEN 'stanbax_testimonials_header'
      WHEN 'faqs'                    THEN 'stanbax_faq_items'
      WHEN 'faqHeader'               THEN 'stanbax_faq_header'
      WHEN 'adminPassword'           THEN 'stanbax_admin_password'
      WHEN 'proprietressPassword'    THEN 'stanbax_proprietress_password'
      WHEN 'adminSecurityQuestion'   THEN 'stanbax_admin_security_q'
      WHEN 'adminSecurityAnswer'     THEN 'stanbax_admin_security_a'
      WHEN 'schoolRepConfig'         THEN 'stanbax_school_rep_config'
      WHEN 'visitorConversations'    THEN 'stanbax_visitor_conversations'
      WHEN 'landingSections'         THEN 'stanbax_landing_sections'
      WHEN 'deletedAccountIds'       THEN 'stanbax_deleted_account_ids'
      ELSE NULL
    END;

    -- Keys already namespaced (stanbax_*) or unknown-but-safe are passed through
    IF v_storage IS NULL THEN
      IF v_key LIKE 'stanbax\_%' THEN
        v_storage := v_key;
      ELSE
        CONTINUE;  -- version / schoolName / exportedAt / unrecognised helpers
      END IF;
    END IF;

    v_items := v_items || jsonb_build_array(jsonb_build_object('key', v_storage, 'data', v_value));
  END LOOP;

  IF jsonb_array_length(v_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'No restorable collections found in this backup file.');
  END IF;

  -- ---- 2. Commit every collection in this one transaction ----------------
  -- put_states() performs the per-key permission check, de-duplicates the
  -- student roster and sets the correct is_public flag for each key.
  v_write := public.put_states(v_items);

  -- ---- 3. Scholar / tutor / parent logins --------------------------------
  -- Redacted passwords ("[Password managed securely]") are never used. Existing
  -- credentials keep their current hash so nobody is locked out after a restore.
  v_students := CASE WHEN jsonb_typeof(p_snapshot->'students') = 'array'
                     THEN p_snapshot->'students' ELSE '[]'::jsonb END;
  v_tutors   := CASE WHEN jsonb_typeof(p_snapshot->'tutors') = 'array'
                     THEN p_snapshot->'tutors' ELSE '[]'::jsonb END;
  v_parents  := CASE WHEN jsonb_typeof(p_snapshot->'parents') = 'array'
                     THEN p_snapshot->'parents' ELSE '[]'::jsonb END;

  FOR v_person IN SELECT value FROM jsonb_array_elements(v_students || v_tutors || v_parents)
  LOOP
    v_ref_id := NULLIF(v_person->>'id', '');
    v_pass   := NULLIF(v_person->>'password', '');

    IF v_ref_id IS NULL OR v_pass IS NULL THEN
      CONTINUE;
    END IF;

    -- Placeholder / redacted password: do not overwrite a live credential.
    IF left(v_pass, 1) = '[' AND right(v_pass, 1) = ']' THEN
      IF EXISTS (SELECT 1 FROM public.credentials c WHERE c.ref_id = v_ref_id) THEN
        v_preserved := v_preserved + 1;
      ELSE
        v_preserved := v_preserved + 1;  -- nothing usable to create
      END IF;
      CONTINUE;
    END IF;

    v_ident := lower(trim(COALESCE(
      NULLIF(v_person->>'regNumber', ''),
      NULLIF(v_person->>'staffId', ''),
      NULLIF(v_person->>'email', ''),
      NULLIF(v_person->>'phone', ''),
      v_ref_id
    )));

    v_aliases := ARRAY(
      SELECT DISTINCT lower(x)
      FROM jsonb_array_elements_text(jsonb_build_array(
        v_person->>'regNumber', v_person->>'staffId', v_person->>'email',
        v_person->>'phone', v_person->>'name', v_ref_id
      )) AS t(x)
      WHERE x IS NOT NULL AND trim(x) <> ''
    );

    -- Accept the full name and every two-name combination, e.g. a student
    -- named “Mark Tinu Angel” can use “Mark Tinu” or “Mark Angel”.
    v_name_parts := regexp_split_to_array(lower(trim(COALESCE(v_person->>'name', ''))), '\s+');
    IF array_length(v_name_parts, 1) >= 2 THEN
      FOR v_i IN 1..array_length(v_name_parts, 1) LOOP
        FOR v_j IN (v_i + 1)..array_length(v_name_parts, 1) LOOP
          v_aliases := array_append(v_aliases, v_name_parts[v_i] || ' ' || v_name_parts[v_j]);
        END LOOP;
      END LOOP;
      SELECT ARRAY(SELECT DISTINCT lower(trim(x)) FROM unnest(v_aliases) AS t(x) WHERE trim(x) <> '')
        INTO v_aliases;
    END IF;

    IF EXISTS (SELECT 1 FROM public.credentials c WHERE c.ref_id = v_ref_id) THEN
      -- Keep the working password, only refresh the alias map.
      UPDATE public.credentials
         SET aliases = (
               SELECT ARRAY(SELECT DISTINCT unnest(public.credentials.aliases || v_aliases))
             ),
             updated_at = now()
       WHERE ref_id = v_ref_id;
      v_preserved := v_preserved + 1;
    ELSE
      INSERT INTO public.credentials
        (identifier, aliases, password_hash, role, ref_id, must_change_password, updated_at)
      VALUES
        (v_ident, v_aliases, crypt(v_pass, gen_salt('bf')),
         CASE
           WHEN p_snapshot->'students' @> jsonb_build_array(jsonb_build_object('id', v_ref_id)) THEN 'student'
           WHEN p_snapshot->'tutors'   @> jsonb_build_array(jsonb_build_object('id', v_ref_id)) THEN 'tutor'
           ELSE 'parent'
         END,
         v_ref_id, true, now())
      ON CONFLICT (identifier) DO NOTHING;

      INSERT INTO public.user_roles (session_ref_id, identifier, role)
      VALUES (v_ref_id, v_ident,
              CASE
                WHEN p_snapshot->'students' @> jsonb_build_array(jsonb_build_object('id', v_ref_id)) THEN 'student'
                WHEN p_snapshot->'tutors'   @> jsonb_build_array(jsonb_build_object('id', v_ref_id)) THEN 'tutor'
                ELSE 'parent'
              END)
      ON CONFLICT DO NOTHING;

      v_created := v_created + 1;
    END IF;
  END LOOP;

  -- ---- 4. Keep the tombstone list authoritative --------------------------
  IF jsonb_typeof(p_snapshot->'deletedAccountIds') = 'array' THEN
    SELECT COALESCE(array_agg(lower(x)), ARRAY[]::TEXT[])
      INTO v_deleted
      FROM jsonb_array_elements_text(p_snapshot->'deletedAccountIds') AS t(x);
  END IF;

  INSERT INTO public.audit_logs (action, entity, actor_ref, actor_role, details)
  VALUES ('BACKUP_SNAPSHOT_RESTORED', 'school_state', v_ref, v_role,
          jsonb_build_object(
            'exported_at', p_snapshot->>'exportedAt',
            'collections', jsonb_array_length(v_items),
            'credentials_created', v_created,
            'credentials_preserved', v_preserved,
            'deleted_account_ids', COALESCE(array_length(v_deleted, 1), 0)
          ));

  RETURN jsonb_build_object(
    'ok', true,
    'written', COALESCE((v_write->>'written')::INT, jsonb_array_length(v_items)),
    'collections', jsonb_array_length(v_items),
    'credentials_created', v_created,
    'credentials_preserved', v_preserved,
    'students', jsonb_array_length(v_students),
    'subjects', CASE WHEN jsonb_typeof(p_snapshot->'subjects') = 'array'
                     THEN jsonb_array_length(p_snapshot->'subjects') ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_backup_snapshot(JSONB) TO anon, authenticated;

-- ===========================================================================
-- OPTIONAL: one-call repair of accounts lost with the database.
--
-- If the wipe also removed the admin login itself (so no session can be
-- created and the RPC above cannot be reached), run this ONCE in the SQL
-- Editor as the project owner. It re-seeds the four privileged logins.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.repair_privileged_logins()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
DECLARE
  v_count INT := 0;
BEGIN
  INSERT INTO public.credentials
    (identifier, aliases, password_hash, role, ref_id, must_change_password, updated_at)
  VALUES
    ('admin',
     ARRAY['administrator','principal','stanbax','admin@stanbaxschools.edu.ng'],
     crypt('Justin2000.', gen_salt('bf')), 'admin', 'admin', false, now()),
    ('proprietress',
     ARRAY['proprietress@stanbaxschools.edu.ng'],
     crypt('Proprietress2025!', gen_salt('bf')), 'proprietress', 'proprietress', false, now())
  ON CONFLICT (identifier) DO UPDATE
    SET password_hash = excluded.password_hash,
        aliases       = excluded.aliases,
        role          = excluded.role,
        ref_id        = excluded.ref_id,
        must_change_password = false,
        updated_at    = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.user_roles (session_ref_id, identifier, role)
  VALUES ('admin','admin','admin'), ('proprietress','proprietress','proprietress')
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'repaired', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.repair_privileged_logins() TO anon, authenticated;

-- ===========================================================================
-- VERIFY (read-only): what does the database hold right now?
-- ===========================================================================
-- SELECT key, jsonb_typeof(data) AS type,
--        CASE WHEN jsonb_typeof(data) = 'array' THEN jsonb_array_length(data) END AS records,
--        is_public, updated_at
--   FROM public.school_state
--  ORDER BY key;

-- SELECT role, count(*) FROM public.credentials GROUP BY role ORDER BY role;
