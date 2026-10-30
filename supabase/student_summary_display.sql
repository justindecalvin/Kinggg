-- Run once in Supabase Dashboard → SQL Editor after schema.sql.
-- This setting contains only display preferences and is intentionally public-readable.
-- Only authenticated administrators can change it through public.put_states.
BEGIN;

INSERT INTO public.school_state (key, data, is_public)
VALUES (
  'stanbax_student_summary_display',
  '{
    "visible": true,
    "cards": {
      "average": { "visible": true, "label": "Collated Average" },
      "standing": { "visible": true, "label": "Class Standing" },
      "gpa": { "visible": true, "label": "Cumulative GPA" },
      "status": { "visible": true, "label": "Standing / Status" }
    }
  }'::jsonb,
  true
)
ON CONFLICT (key) DO UPDATE
SET data = COALESCE(public.school_state.data, EXCLUDED.data),
    is_public = true,
    updated_at = now();

COMMIT;
