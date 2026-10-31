# Kinggg / Stanbax Schools

## Cloudflare Pages deployment and shared data sync

The deployed site uses Supabase as its shared state store. In the Cloudflare Pages project, add these **runtime environment variables** under **Settings → Variables and Secrets** for Production and any Preview environments that should use the database:

- `SUPABASE_URL`: the project's `https://<project-ref>.supabase.co` URL
- `SUPABASE_ANON_KEY`: that project's public anon key

The `/api/config` Pages Function exposes only these two values to the same-origin app. The anon key is intended for browser use; database access must remain controlled by the policies and RPCs in `supabase/schema.sql`. Never use a Supabase service-role key here. The HTML bootstrap requests the shared config and reads the RLS-visible rows in `school_state` before loading the prebuilt app. Private rows remain governed by the existing verified-login/session flow.

General shared website state refreshes every 15 seconds. The chat bridge subscribes to Supabase Realtime for community messages/channels, visitor conversations, representative status, and typing indicators, and uses a 4-second polling fallback. Protected parent consultations and read receipts are synchronized through the verified Stanbax session and refreshed by authenticated polling. `localStorage` remains an optimistic browser cache, not the shared source of truth for these chat records. The in-app Supabase settings screen stores its connection details in the current browser's `localStorage`; that can configure one browser for diagnosis, but cannot configure other browsers or users. Cloudflare Pages runtime variables provide the common database configuration. Redeploy after changing variables so the Pages Function receives them.

## Supabase-backed chat and live updates

Run [`supabase/chat_realtime_sync.sql`](supabase/chat_realtime_sync.sql) once in the same Supabase project, after the main schema. It enables Postgres Changes on `school_state`, merges concurrent chat/consultation snapshots by record ID, stores public landing-page visitor messages through a restricted RPC, and synchronizes typing status and authenticated read receipts. The browser never receives a service-role key. The migration must be installed before the new bridge can persist visitor chat messages or receive Supabase Realtime events; push/deploy the app after applying it.

Important existing-schema privacy note: `schema.sql` currently marks `stanbax_visitor_conversations` publicly readable so the unauthenticated landing-page chat can read its existing shared state. This bridge preserves that pre-existing read behavior; it does not make old conversation contents private. New visitor messages require a random token kept only in the visitor's browser (only its digest is stored privately in Supabase), so a public conversation ID alone cannot be used to impersonate that visitor. A visitor without their original browser token should start a new chat; staff can still read/reply to old conversations. Do not ask visitors to send sensitive personal or financial information in the public chat; full privacy requires a separate authenticated visitor-read design.

## School-wide student result summary cards

Only an authenticated administrator can open **Student summary display**, and only inside **School Settings & Signatures** in the Admin Portal. It is not shown as a floating button or in other Admin tabs, the public landing page, or the proprietress, staff, parent, or student portals. The control can show or hide the summary section, show or hide individual cards, and change their labels. Saving writes the setting through the administrator-verified Supabase `put_states` RPC to the shared `school_state` table. All users receive changes through the existing 15-second state refresh.

Before using this setting, run [`supabase/student_summary_display.sql`](supabase/student_summary_display.sql) once in the Supabase SQL Editor. It initializes the shared display setting and marks that non-sensitive setting publicly readable. Only a valid administrator session can change it.

## Student first-login password change

Run [`supabase/student_first_login_password_change.sql`](supabase/student_first_login_password_change.sql) once in the Supabase SQL Editor after the main schema, then deploy the app update. Because the old system did not record whether each existing student had previously changed a password, the migration flags **all current student credential accounts** for a one-time change; it will not re-flag them if the migration is accidentally run again. New student credentials are flagged automatically.

After a student signs in with the current temporary password, the app blocks access until they choose and confirm a new password of at least 8 characters. Supabase stores the new password only as a bcrypt hash in `credentials.password_hash` and clears `must_change_password`. The database also updates the shared student profile with a masked `[Changed by student]` marker and timestamp so the Admin dashboard can see the status; it does not put the new plaintext password into the public student record or browser storage. The session is database-gated from ordinary protected operations until the change succeeds.

Inside **School Settings & Signatures**, administrators can trigger the requirement for one student using **Require password change**, or for every student account using **Require ALL students to change password**. These controls are not floating and are hidden from every other tab and portal. The all-students button has a confirmation warning, and its Supabase RPC validates the admin session, flags all student credentials, updates non-secret profile markers, and records the total in the audit log. Each student must set a new password at their next sign-in; no password is reset or revealed by the bulk action. Run [`supabase/admin_force_student_password_change.sql`](supabase/admin_force_student_password_change.sql) once after the main schema and first-login migration; the migration is safe to re-run.

## Deployment notes

Cloudflare Pages should continue to use the repository's configured output directory, `recovered-site`. The app is currently shipped as a committed prebuilt bundle in that folder; the TypeScript tree in this repository is incomplete and should not be used as the deployment build input until its missing modules are restored. Ensure `schema.sql`, `student_first_login_password_change.sql`, `admin_force_student_password_change.sql`, and `chat_realtime_sync.sql` have been run in the same Supabase project.
