-- Qase ETL (Postgres / Supabase)
-- Raw -> Kanban -> Metrics
-- Assumes ingestion is done by backend; this script defines storage and transforms.

-- =============================
-- 1) RAW TABLES (landing)
-- =============================
create table if not exists qase_projects (
  project_code text primary key,
  name text,
  status text,
  payload jsonb,
  fetched_at timestamptz not null default now()
);

create table if not exists qase_suites (
  project_code text not null,
  suite_id bigint not null,
  parent_id bigint,
  title text,
  description text,
  payload jsonb,
  fetched_at timestamptz not null default now(),
  primary key (project_code, suite_id)
);

create table if not exists qase_cases_raw (
  project_code text not null,
  case_id bigint not null,
  suite_id bigint,
  title text,
  status text,
  priority int,
  severity int,
  type_id int,
  is_flaky boolean,
  created_at timestamptz,
  updated_at timestamptz,
  payload jsonb,
  fetched_at timestamptz not null default now(),
  primary key (project_code, case_id)
);

create table if not exists qase_runs (
  project_code text not null,
  run_id bigint not null,
  title text,
  status text,
  description text,
  started_at timestamptz,
  finished_at timestamptz,
  stats jsonb,
  payload jsonb,
  fetched_at timestamptz not null default now(),
  primary key (project_code, run_id)
);

-- /run/{project}/{run_id}/cases
create table if not exists qase_run_cases_raw (
  project_code text not null,
  run_id bigint not null,
  case_id bigint not null,
  title text,
  status text,
  defect text,
  payload jsonb,
  fetched_at timestamptz not null default now(),
  primary key (project_code, run_id, case_id)
);

-- /result/{project}/{run_id}
create table if not exists qase_results_raw (
  project_code text not null,
  run_id bigint not null,
  result_id bigint not null,
  case_id bigint not null,
  status text,
  comment text,
  defect text,
  time_ms int,
  created_at timestamptz,
  payload jsonb,
  fetched_at timestamptz not null default now(),
  primary key (project_code, run_id, result_id)
);

create table if not exists qase_milestones (
  project_code text not null,
  milestone_id bigint not null,
  title text,
  status text,
  start_date date,
  end_date date,
  payload jsonb,
  fetched_at timestamptz not null default now(),
  primary key (project_code, milestone_id)
);

-- Optional: defects (v2)
create table if not exists qase_defects_raw (
  project_code text not null,
  defect_id bigint not null,
  run_id bigint,
  status text,
  title text,
  payload jsonb,
  fetched_at timestamptz not null default now(),
  primary key (project_code, defect_id)
);

create table if not exists qase_sync_log (
  endpoint text primary key,
  last_success_at timestamptz,
  last_offset int,
  last_page int,
  last_error text
);

create index if not exists idx_qase_results_run_case on qase_results_raw (project_code, run_id, case_id);
create index if not exists idx_qase_results_created on qase_results_raw (project_code, run_id, created_at desc);
create index if not exists idx_qase_run_cases_run on qase_run_cases_raw (project_code, run_id);

-- =============================
-- 2) DERIVED TABLES (product)
-- =============================
create table if not exists kanban_cases (
  id bigserial primary key,
  project_code text not null,
  run_id bigint not null,
  case_id bigint not null,
  title text not null,
  status text not null check (status in ('pass', 'fail', 'blocked', 'not_run')),
  qase_status text,
  bug text,
  source text,
  last_result_id bigint,
  last_result_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (project_code, run_id, case_id)
);

create table if not exists run_metrics (
  project_code text not null,
  run_id bigint not null,
  pass int not null,
  fail int not null,
  blocked int not null,
  not_run int not null,
  total int not null,
  pass_rate numeric(6,2) not null,
  updated_at timestamptz not null default now(),
  primary key (project_code, run_id)
);

-- Optional: releases registry (if not already in DB)
create table if not exists releases (
  release_id text primary key,
  title text not null,
  project_code text not null,
  run_id bigint,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Support 1:N release -> runs
create table if not exists release_runs (
  release_id text not null references releases (release_id) on delete cascade,
  project_code text not null,
  run_id bigint not null,
  primary key (release_id, project_code, run_id)
);

create or replace view release_metrics_v as
select
  r.release_id,
  r.title,
  rr.project_code,
  rr.run_id,
  rm.pass,
  rm.fail,
  rm.blocked,
  rm.not_run,
  rm.total,
  rm.pass_rate,
  rm.updated_at
from release_runs rr
join releases r on r.release_id = rr.release_id
left join run_metrics rm
  on rm.project_code = rr.project_code
 and rm.run_id = rr.run_id;

-- =============================
-- 3) HELPER: STATUS NORMALIZATION
-- =============================
create or replace function normalize_qase_status(raw text)
returns text
language sql
as $$
  select case lower(coalesce(raw, ''))
    when 'passed' then 'pass'
    when 'failed' then 'fail'
    when 'blocked' then 'blocked'
    when 'skipped' then 'not_run'
    when 'untested' then 'not_run'
    when 'not_run' then 'not_run'
    else 'not_run'
  end;
$$;

-- =============================
-- 4) ETL: RAW -> KANBAN CASES
-- =============================
create or replace function refresh_kanban_cases(p_project text default null, p_run bigint default null)
returns void
language sql
as $$
  with latest_results as (
    select distinct on (project_code, run_id, case_id)
      project_code,
      run_id,
      case_id,
      status,
      defect,
      created_at,
      result_id
    from qase_results_raw
    where (p_project is null or project_code = p_project)
      and (p_run is null or run_id = p_run)
    order by project_code, run_id, case_id, created_at desc nulls last, result_id desc
  ),
  latest_run_cases as (
    select distinct on (project_code, run_id, case_id)
      project_code,
      run_id,
      case_id,
      title,
      status,
      defect,
      fetched_at
    from qase_run_cases_raw
    where (p_project is null or project_code = p_project)
      and (p_run is null or run_id = p_run)
    order by project_code, run_id, case_id, fetched_at desc nulls last
  ),
  base as (
    select
      coalesce(rc.project_code, r.project_code) as project_code,
      coalesce(rc.run_id, r.run_id) as run_id,
      coalesce(rc.case_id, r.case_id) as case_id,
      rc.title as rc_title,
      rc.status as rc_status,
      rc.defect as rc_defect,
      r.status as result_status,
      r.defect as result_defect,
      r.result_id,
      r.created_at as result_created_at
    from latest_run_cases rc
    full join latest_results r
      on rc.project_code = r.project_code
     and rc.run_id = r.run_id
     and rc.case_id = r.case_id
  ),
  enriched as (
    select
      b.project_code,
      b.run_id,
      b.case_id,
      coalesce(b.rc_title, c.title, ('Case ' || b.case_id::text)) as title,
      normalize_qase_status(coalesce(b.result_status, b.rc_status)) as status,
      coalesce(b.result_status, b.rc_status) as qase_status,
      coalesce(b.result_defect, b.rc_defect) as bug,
      case when b.result_status is not null then 'result' else 'run_case' end as source,
      b.result_id as last_result_id,
      b.result_created_at as last_result_at,
      now() as updated_at
    from base b
    left join qase_cases_raw c
      on c.project_code = b.project_code
     and c.case_id = b.case_id
  )
  insert into kanban_cases (
    project_code,
    run_id,
    case_id,
    title,
    status,
    qase_status,
    bug,
    source,
    last_result_id,
    last_result_at,
    updated_at
  )
  select
    project_code,
    run_id,
    case_id,
    title,
    status,
    qase_status,
    bug,
    source,
    last_result_id,
    last_result_at,
    updated_at
  from enriched
  where project_code is not null and run_id is not null and case_id is not null
  on conflict (project_code, run_id, case_id) do update
    set title = excluded.title,
        status = excluded.status,
        qase_status = excluded.qase_status,
        bug = excluded.bug,
        source = excluded.source,
        last_result_id = excluded.last_result_id,
        last_result_at = excluded.last_result_at,
        updated_at = excluded.updated_at;
$$;

-- Optional prune (only use if run cases list is complete)
-- delete from kanban_cases
-- where project_code = $1 and run_id = $2
--   and (project_code, run_id, case_id) not in (
--     select project_code, run_id, case_id from qase_run_cases_raw
--     where project_code = $1 and run_id = $2
--   );

-- =============================
-- 5) ETL: KANBAN -> RUN METRICS
-- =============================
create or replace function refresh_run_metrics(p_project text default null, p_run bigint default null)
returns void
language sql
as $$
  insert into run_metrics (
    project_code,
    run_id,
    pass,
    fail,
    blocked,
    not_run,
    total,
    pass_rate,
    updated_at
  )
  select
    project_code,
    run_id,
    count(*) filter (where status = 'pass') as pass,
    count(*) filter (where status = 'fail') as fail,
    count(*) filter (where status = 'blocked') as blocked,
    count(*) filter (where status = 'not_run') as not_run,
    count(*) as total,
    case when count(*) = 0
      then 0
      else round(100.0 * (count(*) filter (where status = 'pass')) / count(*), 2)
    end as pass_rate,
    now() as updated_at
  from kanban_cases
  where (p_project is null or project_code = p_project)
    and (p_run is null or run_id = p_run)
  group by project_code, run_id
  on conflict (project_code, run_id) do update
    set pass = excluded.pass,
        fail = excluded.fail,
        blocked = excluded.blocked,
        not_run = excluded.not_run,
        total = excluded.total,
        pass_rate = excluded.pass_rate,
        updated_at = excluded.updated_at;
$$;

-- =============================
-- 6) EXAMPLE EXECUTION
-- =============================
-- refresh_kanban_cases('SFQ', 123);
-- refresh_run_metrics('SFQ', 123);

-- Or batch refresh for all runs
-- refresh_kanban_cases();
-- refresh_run_metrics();

