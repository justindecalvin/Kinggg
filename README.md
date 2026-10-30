# Kinggg / Stanbax Schools

## Cloudflare Pages deployment and shared data sync

The deployed site uses Supabase as its shared state store. In the Cloudflare Pages project, add these **runtime environment variables** under **Settings → Variables and Secrets** for Production and any Preview environments that should use the database:

- `SUPABASE_URL`: the project's `https://<project-ref>.supabase.co` URL
- `SUPABASE_ANON_KEY`: that project's public anon key

The `/api/config` Pages Function exposes only these two values to the same-origin app. The anon key is intended for browser use; database access must remain controlled by the policies and RPCs in `supabase/schema.sql`. Never use a Supabase service-role key here. The HTML bootstrap requests the shared config and reads the RLS-visible rows in `school_state` before loading the prebuilt app. Private rows remain governed by the existing verified-login/session flow.

Already-open browsers poll the shared state every 15 seconds and notify the app's existing storage listeners when another user has changed data. The in-app Supabase settings screen stores its connection details in the current browser's `localStorage`; that can configure one browser for diagnosis, but cannot configure other browsers or users. Cloudflare Pages runtime variables provide the common database configuration. Redeploy after changing variables so the Pages Function receives them.

## School-wide student result summary cards

Only an authenticated administrator can open **Student summary display**, and only while inside the Admin portal. It is not shown on the public landing page or in the proprietress, staff, parent, or student portals. The control can show or hide the summary section, show or hide individual cards, and change their labels. Saving writes the setting through the administrator-verified Supabase `put_states` RPC to the shared `school_state` table. All users receive changes through the existing 15-second state refresh.

Before using this setting, run [`supabase/student_summary_display.sql`](supabase/student_summary_display.sql) once in the Supabase SQL Editor. It initializes the shared display setting and marks that non-sensitive setting publicly readable. Only a valid administrator session can change it.

## Student first-login password change

Run [`supabase/student_first_login_password_change.sql`](supabase/student_first_login_password_change.sql) once in the Supabase SQL Editor after the main schema, then deploy the app update. Because the old system did not record whether each existing student had previously changed a password, the migration flags **all current student credential accounts** for a one-time change; it will not re-flag them if the migration is accidentally run again. New student credentials are flagged automatically.

After a student signs in with the current temporary password, the app blocks access until they choose and confirm a new password of at least 8 characters. Supabase stores the new password only as a bcrypt hash in `credentials.password_hash` and clears `must_change_password`. The database also updates the shared student profile with a masked `[Changed by student]` marker and timestamp so the Admin dashboard can see the status; it does not put the new plaintext password into the public student record or browser storage. The session is database-gated from ordinary protected operations until the change succeeds.

## Deployment notes

Cloudflare Pages should continue to use the repository's configured output directory, `recovered-site`. The app is currently shipped as a committed prebuilt bundle in that folder; the TypeScript tree in this repository is incomplete and should not be used as the deployment build input until its missing modules are restored. Ensure the Supabase schema and required migrations in `supabase/` have been run in the same Supabase project.
