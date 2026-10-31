-- Test harness: reproduces the user's exact error, then proves the fixed script is safe to re-run.
\set ON_ERROR_STOP on

-- Helper stubs so the RPC/policies can be exercised the way they will behave in
-- the real project (schema.sql defines these).
create schema if not exists extensions;
create or replace function public.session_ref_id() returns text language sql stable as $$ select 'ref-admin'::text $$;
create or replace function public.valid_session() returns boolean language sql stable as $$ select true $$;
create or replace function public.session_role() returns text language sql stable as $$ select 'admin'::text $$;
create or replace function public.is_admin() returns boolean language sql stable as $$ select true $$;

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  action text not null, entity text not null, actor_ref text, actor_role text,
  ip_address text, details jsonb, created_at timestamptz not null default now()
);
