-- Add KG1 and KG2 to the shared class catalog in Supabase.
-- Safe to run more than once: existing names are matched case-insensitively
-- with whitespace ignored (for example, "Kg 2" counts as "KG2").
-- This does not change any student records or class assignments.
-- Tuition defaults to 0 because no fee amounts were supplied; update in the
-- Classes & Fees screen after the catalog is synced if fees should differ.

BEGIN;

DO $$
DECLARE
  class_catalog JSONB;
  class_name TEXT;
BEGIN
  SELECT data
    INTO class_catalog
    FROM public.school_state
   WHERE key = 'stanbax_classes'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The stanbax_classes row was not found. Run this only after the application has initialized its Supabase class catalog.';
  END IF;

  IF class_catalog IS NULL OR jsonb_typeof(class_catalog) <> 'array' THEN
    RAISE EXCEPTION 'stanbax_classes does not contain a JSON array; no changes were made.';
  END IF;

  FOREACH class_name IN ARRAY ARRAY['KG1', 'KG2'] LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM jsonb_array_elements(class_catalog) AS existing(item)
       WHERE regexp_replace(
               lower(btrim(coalesce(existing.item->>'name', ''))),
               '[[:space:]]', '', 'g'
             ) = regexp_replace(lower(class_name), '[[:space:]]', '', 'g')
    ) THEN
      class_catalog := class_catalog || jsonb_build_array(
        jsonb_build_object(
          'id', 'cls-' || gen_random_uuid()::TEXT,
          'name', class_name,
          'category', 'Early Years',
          'tuitionPerTerm', 0,
          'isActive', TRUE
        )
      );
    END IF;
  END LOOP;

  UPDATE public.school_state
     SET data = class_catalog,
         updated_at = now()
   WHERE key = 'stanbax_classes';
END;
$$;

COMMIT;

-- Verify the Kindergarten classes now present in the shared catalog.
SELECT item->>'name' AS class_name,
       item->>'category' AS category,
       item->>'tuitionPerTerm' AS tuition_per_term
  FROM public.school_state AS state
 CROSS JOIN LATERAL jsonb_array_elements(state.data) AS item
 WHERE state.key = 'stanbax_classes'
   AND regexp_replace(lower(btrim(coalesce(item->>'name', ''))), '[[:space:]]', '', 'g')
       IN ('kg1', 'kg2')
 ORDER BY lower(item->>'name');
