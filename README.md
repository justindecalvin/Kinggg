# Kinggg / Stanbax Schools

## Cloudflare Pages deployment and shared data sync

The deployed site uses Supabase as its shared state store. In the Cloudflare Pages project, add these **runtime environment variables** under **Settings → Variables and Secrets** for Production and any Preview environments that should use the database:

- `SUPABASE_URL`: the project's `https://<project-ref>.supabase.co` URL
- `SUPABASE_ANON_KEY`: that project's public anon key

The `/api/config` Pages Function exposes only these two values to the same-origin app. The anon key is intended for browser use; database access must remain controlled by the policies and RPCs in `supabase/schema.sql`. Never use a Supabase service-role key here. The new HTML bootstrap requests the shared config and reads the RLS-visible rows in `school_state` before loading the prebuilt app, so a fresh browser starts with shared public state rather than only its local defaults. Private rows remain governed by the existing verified-login/session flow.

Already-open browsers poll the shared state every 15 seconds and notify the app's existing storage listeners when another user has changed data. The in-app Supabase settings screen stores its connection details in the current browser's `localStorage`; that can configure one browser for diagnosis, but cannot configure other browsers or users. Cloudflare Pages runtime variables provide the common database configuration. Redeploy after changing variables so the Pages Function receives them.

Cloudflare Pages should continue to use the repository's configured output directory, `recovered-site`. The app is currently shipped as a committed prebuilt bundle in that folder; the TypeScript tree in this repository is incomplete and should not be used as the deployment build input until its missing modules are restored. Ensure the Supabase schema and required migrations in `supabase/` have been run in the same Supabase project before expecting remote reads and writes.

After deploy, confirm that `/api/config` returns `configured: true`, then open the site in a clean browser and verify that a known public content edit appears there and that an edit made in the clean browser becomes visible in another already-open browser within about 15 seconds.
