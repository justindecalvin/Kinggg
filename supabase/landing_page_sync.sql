-- Run this once in Supabase Dashboard > SQL Editor.
-- The main schema.sql must already have been applied (it creates school_state,
-- put_states, and the public-read RLS policies).
-- Only public website content is exposed here; do not add credentials or private records.

BEGIN;

INSERT INTO public.school_state (key, is_public)
VALUES
  ('stanbax_app_images', true),
  ('stanbax_school_info', true),
  ('stanbax_hero_slides', true),
  ('stanbax_hero_highlights', true),
  ('stanbax_landing_sections', true),
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
  ('stanbax_campus_gallery_photos', true),
  ('stanbax_news_articles', true),
  ('stanbax_popup_notice', true),
  ('stanbax_navbar_content', true),
  ('stanbax_footer_content', true)
ON CONFLICT (key) DO UPDATE
  SET is_public = true,
      updated_at = now();

COMMIT;

-- The app writes these values through public.put_states after an admin login.
-- This migration makes them readable to landing-page visitors through the
-- existing school_state_select_public policy. Uploaded image contents currently
-- live in the JSON state (usually as image URLs/data URLs); for large originals,
-- use Supabase Storage rather than storing large base64 strings in JSONB.
