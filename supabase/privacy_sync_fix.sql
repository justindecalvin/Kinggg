-- Apply once to an existing database before relying on cross-device sync.
-- The old schema/mirror allowed private roster, account and communications rows
-- to be read anonymously. This migration revokes those anonymous reads.
UPDATE public.school_state
SET is_public = false, updated_at = now()
WHERE key IN (
  'stanbax_students', 'stanbax_classes', 'stanbax_tutors', 'stanbax_parents_list', 'stanbax_moderators',
  'stanbax_role_privileges', 'stanbax_headmistress_profile', 'stanbax_admin_accounts',
  'stanbax_deleted_account_ids', 'stanbax_visitor_conversations', 'stanbax_chat_channels',
  'stanbax_chat_messages', 'stanbax_assessment_config', 'stanbax_grading_system',
  'stanbax_official_signatures', 'stanbax_school_rep_config', 'stanbax_navbar_content',
  'stanbax_footer_content', 'stanbax_parent_consultations', 'stanbax_fee_payments',
  'stanbax_inquiries', 'stanbax_broadcast_logs', 'stanbax_admin_password',
  'stanbax_proprietress_password', 'stanbax_admin_security_q', 'stanbax_admin_security_a'
);

-- Be explicit about which settings are allowed for anonymous website display.
UPDATE public.school_state
SET is_public = true, updated_at = now()
WHERE key IN (
  'stanbax_school_info', 'stanbax_app_images', 'stanbax_app_theme', 'stanbax_hero_slides',
  'stanbax_hero_highlights', 'stanbax_key_pillars', 'stanbax_key_pillars_header',
  'stanbax_about_content', 'stanbax_academic_programs', 'stanbax_featured_courses',
  'stanbax_clubs_list', 'stanbax_house_standings', 'stanbax_bus_routes',
  'stanbax_meal_menu', 'stanbax_calendar_events', 'stanbax_testimonials',
  'stanbax_testimonials_header', 'stanbax_faq_items', 'stanbax_faq_header',
  'stanbax_campus_gallery_photos', 'stanbax_news_articles', 'stanbax_popup_notice',
  'stanbax_landing_sections', 'stanbax_subjects'
);
