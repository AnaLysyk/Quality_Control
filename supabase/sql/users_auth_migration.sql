-- Migration: link public.users to auth.users + audit cleanup
-- Run in Supabase SQL editor with a privileged role.

-- 1) Add auth_user_id column (nullable)
alter table public.users
add column if not exists auth_user_id uuid;

-- 2) Ensure audit insert function exists (avoids log_audit overload ambiguity)
create or replace function public.log_audit_insert_audit_logs(
  p_table_name text,
  p_operation text,
  p_record_id uuid,
  p_actor_user_id uuid,
  p_actor_email text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
as $function$
begin
  insert into public.audit_logs (
    table_name, operation, record_id, actor_user_id, actor_email, payload, created_at
  ) values (
    p_table_name, p_operation, p_record_id, p_actor_user_id, p_actor_email, p_payload, now()
  );
end;
$function$;

-- 3) Replace users_audit_trigger to call the definitive function.
-- NOTE: If your existing trigger does more than audit logging, merge the logic manually.
create or replace function public.users_audit_trigger()
returns trigger
language plpgsql
as $function$
declare
  v_op text;
  v_record_id uuid;
  v_payload jsonb;
begin
  if tg_op = 'INSERT' then
    v_op := 'INSERT';
    v_record_id := new.id;
    v_payload := row_to_json(new)::jsonb;
  elsif tg_op = 'UPDATE' then
    v_op := 'UPDATE';
    v_record_id := new.id;
    v_payload := jsonb_build_object('old', row_to_json(old), 'new', row_to_json(new));
  elsif tg_op = 'DELETE' then
    v_op := 'DELETE';
    v_record_id := old.id;
    v_payload := row_to_json(old)::jsonb;
  else
    return null;
  end if;

  perform public.log_audit_insert_audit_logs(
    'users',
    v_op,
    v_record_id,
    coalesce(current_setting('jwt.claims.user_id', true), null)::uuid,
    coalesce(current_setting('jwt.claims.email', true), null)::text,
    v_payload
  );

  return new;
end;
$function$;

-- 4) Populate auth_user_id using email match (case-insensitive).
update public.users u
set auth_user_id = au.id
from auth.users au
where lower(u.email) = lower(au.email)
  and u.auth_user_id is distinct from au.id;

-- 5) Index for auth_user_id.
create index if not exists idx_users_auth_user_id on public.users(auth_user_id);

-- 6) Archive audit_logs older than 90 days.
create table if not exists public.audit_logs_archive (
  like public.audit_logs including all
);

with moved as (
  delete from public.audit_logs
  where created_at < now() - interval '90 days'
  returning *
)
insert into public.audit_logs_archive
select * from moved;

-- 7) Add FK (fails if any auth_user_id has no matching auth.users id).
do $$
begin
  if exists (
    select 1
    from public.users u
    where u.auth_user_id is not null
      and not exists (select 1 from auth.users au where au.id = u.auth_user_id)
  ) then
    raise exception 'Cannot create FK: some users.auth_user_id values do not match auth.users.id';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_users_auth_user_id'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint fk_users_auth_user_id
      foreign key (auth_user_id) references auth.users(id);
  end if;
end;
$$;

-- 8) Backup log_audit overload definitions (optional but recommended before cleanup).
create table if not exists public.function_backups (
  name text,
  signature text,
  definition text,
  backed_up_at timestamptz default now()
);

insert into public.function_backups(name, signature, definition)
select 'public.log_audit' as name, p.oid::regprocedure::text as signature, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on p.pronamespace = n.oid
where p.proname = 'log_audit' and n.nspname = 'public'
on conflict do nothing;

-- 9) Consolidate log_audit overloads (keep only the implementation that inserts into audit_logs).
-- WARNING: review in a staging DB first.
do $$
declare
  r record;
  argtypes text;
begin
  for r in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on p.pronamespace = n.oid
    where p.proname = 'log_audit' and n.nspname = 'public'
  loop
    if r.def not like '%insert into public.audit_logs%' then
      select string_agg(pg_catalog.format_type(t, null), ', ')
        into argtypes
      from unnest((select p.proargtypes from pg_proc p where p.oid = r.oid)) as t;
      execute format('drop function if exists public.log_audit(%s);', coalesce(argtypes, ''));
    end if;
  end loop;
end;
$$;
