-- Run once in the Supabase SQL Editor after schema.sql.
-- Public visitors can display school branding, but only authenticated school
-- admins can upload, replace, or delete objects using the app's verified token.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'school-media', 'school-media', true, 10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "school_media_public_read" ON storage.objects;
CREATE POLICY "school_media_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'school-media');

DROP POLICY IF EXISTS "school_media_admin_insert" ON storage.objects;
CREATE POLICY "school_media_admin_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'school-media'
    AND public.valid_session()
    AND public.session_role() IN ('admin', 'proprietress')
  );

DROP POLICY IF EXISTS "school_media_admin_update" ON storage.objects;
CREATE POLICY "school_media_admin_update" ON storage.objects
  FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'school-media' AND public.valid_session() AND public.session_role() IN ('admin', 'proprietress'))
  WITH CHECK (bucket_id = 'school-media' AND public.valid_session() AND public.session_role() IN ('admin', 'proprietress'));

DROP POLICY IF EXISTS "school_media_admin_delete" ON storage.objects;
CREATE POLICY "school_media_admin_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'school-media' AND public.valid_session() AND public.session_role() IN ('admin', 'proprietress'));
