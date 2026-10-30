# Cross-browser persistence and shared media setup

The application now reads its shared `school_state` snapshot before React initializes, refreshes shared rows every 20 seconds (and when a tab regains focus), writes an allowlisted set of school records through Supabase, and stores CMS image uploads in the `school-media` Supabase Storage bucket. Authentication tokens, Supabase credentials, passwords, and per-device UI state are intentionally not synchronized as ordinary data.

## Apply to an existing Supabase project

1. In Supabase SQL Editor, run `supabase/privacy_sync_fix.sql` to make existing roster, account, and communications rows private. This is important because the previous schema marked several of those rows public.
2. Run `supabase/storage_setup.sql` to create the public-read media bucket and restrict uploads/deletes to a verified admin or proprietress session.
3. Confirm the project has the `school_state` table and RPCs from `supabase/schema.sql`. Do not put a Supabase service-role key in the browser or in Cloudflare's public build variables.

For a new project, review/apply the updated `supabase/schema.sql` first, followed by `supabase/landing_page_sync.sql`, `supabase/privacy_sync_fix.sql`, and `supabase/storage_setup.sql`. The privacy fix is safe to re-run.

## Cloudflare configuration

Supabase URL and **anon/public** key must be available on every browser. Prefer setting `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Cloudflare Pages build-time environment variables, then rebuild and deploy. A value saved only in `localStorage` connects only that browser. Never use a service-role key here.

## Repository/deployment limitation found during review

This repository's current `npm run build` only validates the committed `recovered-site` archive; it does not compile `src/`. The configured Cloudflare output is also `recovered-site`. A Vite build from `src/` cannot currently complete because `src/App.tsx` imports multiple component files that are not present in the tracked `src/components` tree (for example `KeyPillars` and `AboutSection`). Therefore these source changes and migrations are prepared locally, but the deployed Cloudflare bundle cannot safely be regenerated from this checkout until that missing source/build mismatch is resolved. Do not publish by changing the Pages output path to `dist` yet; the new bundle would omit existing static assets/pages and the source build currently fails.

## Verify after the deployment is resolved

Use a fresh browser (or private window), open the site, confirm the admin portal reports a working Supabase connection, update a CMS field, then load the site in a second browser. Test an account edit and deletion across roles, verify unauthenticated reads of `school_state` do not return private rows, and upload a new logo. The logo's saved value should be a `https://<project>.supabase.co/storage/v1/object/public/school-media/...` URL rather than a `data:image/...` string.
