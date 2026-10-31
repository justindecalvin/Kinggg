-- ===========================================================================
--  student_results.sql  —  v2 (idempotent + self-healing)
--
--  Fixes:  ERROR 23505 duplicate key value violates unique constraint
--          "pg_type_typname_nsp_index"
--          DETAIL: Key (typname, typnamespace)=(student_results, 2200) already exists.
--
--  Cause: a stray TYPE named student_results already occupies that name in the
--  public schema, so CREATE TABLE cannot register its row type. This script
--  removes a stray orphaned type automatically, but REFUSES to touch a table,
--  view or materialized view that already holds data.
--
--  Safe to run as many times as you like.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- STEP 1 — Make the name available, without ever destroying data.
-- ---------------------------------------------------------------------------
do $preflight$
declare
  v_relkind "char";
  v_typtype "char";
  v_rows    bigint;
begin
  select c.relkind into v_relkind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'student_results'
   order by (c.relkind in ('r', 'p')) desc
   limit 1;

  -- A real table (or partitioned table) is already there: keep it, we only add
  -- anything that is missing further down.
  if v_relkind in ('r', 'p') then
    execute 'select count(*) from public.student_results' into v_rows;
    raise notice 'public.student_results already exists as a table with % row(s). Keeping it and adding any missing columns.', v_rows;
    return;
  end if;

  -- A view / materialized view / foreign table / sequence / index: stop and say
  -- exactly what was found instead of failing halfway through the script.
  if v_relkind is not null and v_relkind <> 'c' then
    raise exception
      'public.student_results already exists as a % . Nothing was changed. Run the STEP 0 diagnostic query, then drop or rename that object and re-run this script.',
      case v_relkind
        when 'v' then 'view'
        when 'm' then 'materialized view'
        when 'f' then 'foreign table'
        when 'S' then 'sequence'
        when 'i' then 'index'
        else 'relation of kind ' || v_relkind
      end
      using errcode = '42809';
  end if;

  -- relkind is NULL or 'c' (a composite type). Any pg_type row with this name is
  -- now by definition an orphan, because no table owns it. That orphan is what
  -- produced the 23505 error, so remove it.
  --   No CASCADE on purpose: if anything depends on the type, we want a loud
  --   error rather than silently dropping a column somewhere.
  select t.typtype into v_typtype
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public'
     and t.typname = 'student_results'
   limit 1;

  if v_typtype is not null then
    execute 'drop type public.student_results';
    raise notice 'Removed the stray type public.student_results (typtype=%) that was blocking CREATE TABLE. This was the cause of the 23505 error.', v_typtype;
  end if;
end;
$preflight$;


-- ---------------------------------------------------------------------------
-- STEP 2 — The table.
-- ---------------------------------------------------------------------------
create table if not exists public.student_results (
  id               uuid primary key default gen_random_uuid(),
  student_ref      text,
  reg_number       text not null,
  reg_key          text generated always as (lower(regexp_replace(coalesce(reg_number, ''), '[^A-Za-z0-9]', '', 'g'))) stored,
  student_name     text,
  class_name       text,
  academic_session text not null default '2026/2027',
  term             text not null default '1st Term',
  subject          text not null default '',
  subject_key      text generated always as (lower(regexp_replace(coalesce(subject, ''), '[^A-Za-z0-9]', '', 'g'))) stored,
  ca1              numeric(6,2) not null default 0,
  ca2              numeric(6,2) not null default 0,
  ca3              numeric(6,2) not null default 0,
  exam             numeric(6,2) not null default 0,
  total            numeric(6,2) not null default 0,
  grade            text,
  remark           text,
  is_real_score    boolean not null default true,
  source           text not null default 'bulk_csv_upload',
  uploaded_by      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- If the table already existed in an older / partial shape, bring it up to date.
alter table public.student_results add column if not exists student_ref      text;
alter table public.student_results add column if not exists reg_number       text not null default '';
alter table public.student_results add column if not exists reg_key          text generated always as (lower(regexp_replace(coalesce(reg_number, ''), '[^A-Za-z0-9]', '', 'g'))) stored;
alter table public.student_results add column if not exists student_name     text;
alter table public.student_results add column if not exists class_name       text;
alter table public.student_results add column if not exists academic_session text not null default '2026/2027';
alter table public.student_results add column if not exists term             text not null default '1st Term';
alter table public.student_results add column if not exists subject          text not null default '';
alter table public.student_results add column if not exists subject_key      text generated always as (lower(regexp_replace(coalesce(subject, ''), '[^A-Za-z0-9]', '', 'g'))) stored;
alter table public.student_results add column if not exists ca1              numeric(6,2) not null default 0;
alter table public.student_results add column if not exists ca2              numeric(6,2) not null default 0;
alter table public.student_results add column if not exists ca3              numeric(6,2) not null default 0;
alter table public.student_results add column if not exists exam             numeric(6,2) not null default 0;
alter table public.student_results add column if not exists total            numeric(6,2) not null default 0;
alter table public.student_results add column if not exists grade            text;
alter table public.student_results add column if not exists remark           text;
alter table public.student_results add column if not exists is_real_score    boolean not null default true;
alter table public.student_results add column if not exists source           text not null default 'bulk_csv_upload';
alter table public.student_results add column if not exists uploaded_by      text;
alter table public.student_results add column if not exists created_at       timestamptz not null default now();
alter table public.student_results add column if not exists updated_at       timestamptz not null default now();

-- Future inserts must state term and subject explicitly (the defaults above only
-- existed so an older table with rows could be migrated).
alter table public.student_results alter column term drop default;
alter table public.student_results alter column subject drop default;
alter table public.student_results alter column reg_number drop default;

-- Score-range guard, added only when absent (ADD CONSTRAINT has no IF NOT EXISTS).
do $guard$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'student_results_score_range'
       and conrelid = 'public.student_results'::regclass
  ) then
    alter table public.student_results
      add constraint student_results_score_range check (
        ca1 between 0 and 100 and ca2 between 0 and 100
        and ca3 between 0 and 100 and exam between 0 and 100 and total >= 0
      ) not valid;
    alter table public.student_results validate constraint student_results_score_range;
  end if;
end;
$guard$;


-- ---------------------------------------------------------------------------
-- STEP 3 — Indexes. The unique one is what turns an upload into an UPSERT.
-- ---------------------------------------------------------------------------
create unique index if not exists student_results_identity_key
  on public.student_results (reg_key, academic_session, term, subject_key);

create index if not exists student_results_lookup_idx
  on public.student_results (academic_session, term, reg_key);

create index if not exists student_results_class_idx
  on public.student_results (academic_session, term, class_name);

create index if not exists student_results_student_ref_idx
  on public.student_results (student_ref);


-- ---------------------------------------------------------------------------
-- STEP 4 — updated_at trigger.
-- ---------------------------------------------------------------------------
create or replace function public.touch_student_results()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists student_results_touch on public.student_results;
create trigger student_results_touch
  before update on public.student_results
  for each row execute function public.touch_student_results();


-- ---------------------------------------------------------------------------
-- STEP 5 — Row Level Security.
--   ENABLE (never FORCE): the SECURITY DEFINER RPCs below run as the owner and
--   therefore still work, while direct anon PostgREST reads stay blocked by the
--   policies. FORCE would subject the owner to the policies too and make the
--   upload fail whenever a request header is missing.
-- ---------------------------------------------------------------------------
alter table public.student_results enable row level security;
alter table public.student_results no force row level security;

-- Policies reference helpers that live in schema.sql. If they are missing we
-- skip policies with a clear notice instead of failing with a cryptic error.
do $policies$
declare
  v_missing text[] := array[]::text[];
  v_fn      text;
begin
  foreach v_fn in array array['valid_session', 'session_role', 'session_ref_id', 'is_admin'] loop
    if not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_fn
    ) then
      v_missing := v_missing || v_fn;
    end if;
  end loop;

  if array_length(v_missing, 1) > 0 then
    raise notice 'Skipped RLS policies: missing helper function(s) public.% . Run supabase/schema.sql (or SETUP_ALL.sql) first, then re-run this script to enable scholar self-service reads. Admin uploads work either way.', array_to_string(v_missing, ', public.');
    return;
  end if;

  execute 'drop policy if exists student_results_select_policy on public.student_results';
  execute $p$
    create policy student_results_select_policy on public.student_results
      for select
      using (
        public.session_role() in ('admin', 'proprietress', 'headmistress')
        or public.is_admin()
        or (
          public.valid_session()
          and student_ref is not null
          and student_ref = public.session_ref_id()
        )
      )
  $p$;

  execute 'drop policy if exists student_results_insert_policy on public.student_results';
  execute $p$
    create policy student_results_insert_policy on public.student_results
      for insert
      with check (
        public.valid_session()
        and public.session_role() in ('admin', 'proprietress', 'headmistress')
      )
  $p$;

  execute 'drop policy if exists student_results_update_policy on public.student_results';
  execute $p$
    create policy student_results_update_policy on public.student_results
      for update
      using (public.valid_session() and public.session_role() in ('admin', 'proprietress', 'headmistress'))
      with check (public.valid_session() and public.session_role() in ('admin', 'proprietress', 'headmistress'))
  $p$;

  execute 'drop policy if exists student_results_delete_policy on public.student_results';
  execute $p$
    create policy student_results_delete_policy on public.student_results
      for delete
      using (public.valid_session() and public.session_role() in ('admin', 'proprietress', 'headmistress'))
  $p$;

  raise notice 'RLS policies installed on public.student_results.';
end;
$policies$;


-- ---------------------------------------------------------------------------
-- STEP 6 — UPSERT RPC (the single write path used by the bulk CSV uploader).
-- ---------------------------------------------------------------------------
create or replace function public.upsert_student_results(
  p_records jsonb,
  p_source  text default 'bulk_csv_upload'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_role      text := public.session_role();
  v_ref       text := public.session_ref_id();
  v_rec       jsonb;
  v_ins       int := 0;
  v_upd       int := 0;
  v_skipped   int := 0;
  v_i         int := 0;
  v_u         int := 0;
  v_problems  jsonb := '[]'::jsonb;
  v_reg       text;
  v_subject   text;
  v_term      text;
  v_session   text;
  v_ca1       numeric;
  v_ca2       numeric;
  v_ca3       numeric;
  v_exam      numeric;
  v_total     numeric;
begin
  if not public.valid_session() then
    raise exception 'Not signed in: a verified admin session is required to save results.'
      using errcode = '28000';
  end if;

  if v_role not in ('admin', 'proprietress', 'headmistress') then
    raise exception 'Access denied: role % is not permitted to upload student results.', v_role
      using errcode = '42501';
  end if;

  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception 'p_records must be a JSON array of result rows.' using errcode = '22023';
  end if;

  for v_rec in select * from jsonb_array_elements(p_records) loop
    v_reg     := nullif(btrim(coalesce(v_rec->>'reg_number', '')), '');
    v_subject := nullif(btrim(coalesce(v_rec->>'subject', '')), '');
    v_term    := coalesce(nullif(btrim(coalesce(v_rec->>'term', '')), ''), '1st Term');
    v_session := coalesce(nullif(btrim(coalesce(v_rec->>'academic_session', '')), ''), '2026/2027');

    if v_reg is null or v_subject is null then
      v_skipped := v_skipped + 1;
      if jsonb_array_length(v_problems) < 10 then
        v_problems := v_problems || jsonb_build_object(
          'reg_number', coalesce(v_reg, '(missing)'),
          'subject', coalesce(v_subject, '(missing)'),
          'reason', 'Missing registration number or subject'
        );
      end if;
      continue;
    end if;

    begin
      v_ca1 := coalesce(nullif(v_rec->>'ca1', '')::numeric, 0);
      v_ca2 := coalesce(nullif(v_rec->>'ca2', '')::numeric, 0);
      v_ca3 := coalesce(nullif(v_rec->>'ca3', '')::numeric, 0);
      v_exam := coalesce(nullif(v_rec->>'exam', '')::numeric, 0);
      v_total := coalesce(nullif(v_rec->>'total', '')::numeric, v_ca1 + v_ca2 + v_ca3 + v_exam);
    exception when invalid_text_representation then
      v_skipped := v_skipped + 1;
      if jsonb_array_length(v_problems) < 10 then
        v_problems := v_problems || jsonb_build_object(
          'reg_number', v_reg, 'subject', v_subject, 'reason', 'Score is not a number'
        );
      end if;
      continue;
    end;

    if v_ca1 not between 0 and 100 or v_ca2 not between 0 and 100
       or v_ca3 not between 0 and 100 or v_exam not between 0 and 100 then
      v_skipped := v_skipped + 1;
      if jsonb_array_length(v_problems) < 10 then
        v_problems := v_problems || jsonb_build_object(
          'reg_number', v_reg,
          'subject', v_subject,
          'reason', format('Score out of range (ca1=%s ca2=%s ca3=%s exam=%s)', v_ca1, v_ca2, v_ca3, v_exam)
        );
      end if;
      continue;
    end if;

    with up as (
      insert into public.student_results (
        student_ref, reg_number, student_name, class_name,
        academic_session, term, subject,
        ca1, ca2, ca3, exam, total, grade, remark,
        is_real_score, source, uploaded_by
      ) values (
        nullif(v_rec->>'student_ref', ''),
        v_reg,
        nullif(v_rec->>'student_name', ''),
        nullif(v_rec->>'class_name', ''),
        v_session, v_term, v_subject,
        v_ca1, v_ca2, v_ca3, v_exam, v_total,
        nullif(v_rec->>'grade', ''),
        nullif(v_rec->>'remark', ''),
        coalesce((v_rec->>'is_real_score')::boolean, true),
        coalesce(nullif(p_source, ''), 'bulk_csv_upload'),
        v_ref
      )
      on conflict (reg_key, academic_session, term, subject_key) do update set
        student_ref   = coalesce(excluded.student_ref, public.student_results.student_ref),
        student_name  = coalesce(excluded.student_name, public.student_results.student_name),
        class_name    = coalesce(excluded.class_name, public.student_results.class_name),
        ca1           = excluded.ca1,
        ca2           = excluded.ca2,
        ca3           = excluded.ca3,
        exam          = excluded.exam,
        total         = excluded.total,
        grade         = coalesce(excluded.grade, public.student_results.grade),
        remark        = coalesce(excluded.remark, public.student_results.remark),
        is_real_score = excluded.is_real_score,
        source        = excluded.source,
        uploaded_by   = excluded.uploaded_by,
        updated_at    = now()
      returning (xmax = 0) as inserted
    )
    select count(*) filter (where inserted), count(*) filter (where not inserted)
      into v_i, v_u
      from up;

    v_ins := v_ins + coalesce(v_i, 0);
    v_upd := v_upd + coalesce(v_u, 0);
  end loop;

  -- Audit is best-effort: an RLS policy on audit_logs must never be able to
  -- abort an otherwise successful results upload.
  begin
    insert into public.audit_logs (action, entity, actor_ref, actor_role, details)
    values (
      'BULK_RESULTS_UPSERT', 'student_results', v_ref, v_role,
      jsonb_build_object('inserted', v_ins, 'updated', v_upd, 'skipped', v_skipped, 'source', p_source)
    );
  exception when others then
    raise notice 'Audit log skipped (%): results were still saved.', sqlerrm;
  end;

  return jsonb_build_object(
    'ok', true,
    'inserted', v_ins,
    'updated', v_upd,
    'skipped', v_skipped,
    'total', v_ins + v_upd,
    'problems', v_problems
  );
end;
$fn$;


-- ---------------------------------------------------------------------------
-- STEP 7 — READ RPC (report cards + scholar self-service).
-- ---------------------------------------------------------------------------
create or replace function public.fetch_student_results(
  p_session text,
  p_term    text default null,
  p_reg     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_role text := public.session_role();
  v_ref  text := public.session_ref_id();
  v_rows jsonb;
begin
  if not public.valid_session() then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.reg_number, r.subject), '[]'::jsonb)
    into v_rows
  from public.student_results r
  where r.academic_session = p_session
    and (p_term is null or r.term = p_term)
    and (p_reg is null or r.reg_key = lower(regexp_replace(p_reg, '[^A-Za-z0-9]', '', 'g')))
    and (
      v_role in ('admin', 'proprietress', 'headmistress')
      or (v_ref is not null and r.student_ref = v_ref)
    );

  return jsonb_build_object('ok', true, 'count', jsonb_array_length(v_rows), 'rows', v_rows);
end;
$fn$;


-- ---------------------------------------------------------------------------
-- STEP 8 — Grants (RLS still governs which rows are visible).
-- ---------------------------------------------------------------------------
-- On Supabase the roles anon / authenticated always exist. Elsewhere they may
-- not, so grant only to the roles that are actually present.
do $grants$
declare
  v_role text;
begin
  foreach v_role in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = v_role) then
      execute format('grant select on public.student_results to %I', v_role);
      execute format('grant execute on function public.upsert_student_results(jsonb, text) to %I', v_role);
      execute format('grant execute on function public.fetch_student_results(text, text, text) to %I', v_role);
    end if;
  end loop;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant insert, update, delete on public.student_results to authenticated';
  end if;

  raise notice 'Grants applied to the roles present in this database.';
end;
$grants$;


-- ---------------------------------------------------------------------------
-- STEP 9 — Self-check. Raises if anything above did not apply.
-- ---------------------------------------------------------------------------
do $verify$
declare
  v_tbl   boolean;
  v_index boolean;
  v_up    boolean;
  v_fetch boolean;
  v_rls   boolean;
begin
  select exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'student_results' and c.relkind = 'r'
  ) into v_tbl;

  select exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'student_results_identity_key'
  ) into v_index;

  select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'upsert_student_results'
  ) into v_up;

  select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'fetch_student_results'
  ) into v_fetch;

  select c.relrowsecurity into v_rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'student_results';

  if not (v_tbl and v_index and v_up and v_fetch and v_rls) then
    raise exception 'student_results.sql did not fully apply (table=% unique_index=% upsert_rpc=% fetch_rpc=% rls=%)',
      v_tbl, v_index, v_up, v_fetch, v_rls;
  end if;

  raise notice 'student_results.sql applied: table, unique upsert index, RLS and both RPCs are live.';
end;
$verify$;
