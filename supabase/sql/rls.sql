-- RLS policies for painel-qa (canonical companies table: public.cliente).
-- Assumptions:
-- - users.auth_user_id and users.id are uuid.
-- - support_requests does NOT accept anonymous inserts.
-- - notes are private and scoped to the owner (notes.user_id or notes.auth_user_id).

begin;

-- Helpers (security definer to avoid recursion and allow policy evaluation).
create or replace function public.is_global_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.global_admins ga
      where ga.user_id = uid
    )
    or exists (
      select 1
      from public.users u
      where u.auth_user_id = uid
        and u.active = true
        and (
          u.is_global_admin = true
          or lower(coalesce(u.role, '')) in ('global_admin', 'admin', 'system_admin')
        )
    )
    or exists (
      select 1
      from public.profiles p
      where (p.id = uid or p.auth_user_id = uid)
        and (
          p.is_global_admin = true
          or lower(coalesce(p.role, '')) in ('global_admin', 'admin', 'system_admin')
        )
    );
$$;

revoke execute on function public.is_global_admin(uuid) from public;
grant execute on function public.is_global_admin(uuid) to authenticated;

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.active = true
  limit 1;
$$;

revoke execute on function public.current_app_user_id() from public;
grant execute on function public.current_app_user_id() to authenticated;

create or replace function public.has_client_id_access(uid uuid, client_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_global_admin(uid)
    or exists (
      select 1
      from public.users u
      left join public.user_clients uc
        on uc.active = true
       and (
         (uc.user_id is not null and uc.user_id = u.id)
         or (uc.auth_user_id is not null and uc.auth_user_id = u.auth_user_id)
       )
      where u.auth_user_id = uid
        and u.active = true
        and (
          u.client_id::text = client_id
          or uc.client_id::text = client_id
        )
    );
$$;

revoke execute on function public.has_client_id_access(uuid, text) from public;
grant execute on function public.has_client_id_access(uuid, text) to authenticated;

create or replace function public.has_client_slug_access(uid uuid, slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_global_admin(uid)
    or exists (
      select 1
      from public.users u
      left join public.user_clients uc
        on uc.active = true
       and (
         (uc.user_id is not null and uc.user_id = u.id)
         or (uc.auth_user_id is not null and uc.auth_user_id = u.auth_user_id)
       )
      left join public.cliente c
        on c.id::text = coalesce(uc.client_id::text, u.client_id::text)
      where u.auth_user_id = uid
        and u.active = true
        and (
          c.slug = slug
          or uc.client_slug = slug
        )
    );
$$;

revoke execute on function public.has_client_slug_access(uuid, text) from public;
grant execute on function public.has_client_slug_access(uuid, text) to authenticated;

create or replace function public.has_client_admin_access(uid uuid, client_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_global_admin(uid)
    or exists (
      select 1
      from public.users u
      left join public.user_clients uc
        on uc.active = true
       and (
         (uc.user_id is not null and uc.user_id = u.id)
         or (uc.auth_user_id is not null and uc.auth_user_id = u.auth_user_id)
       )
      where u.auth_user_id = uid
        and u.active = true
        and (
          lower(coalesce(u.role, '')) in ('global_admin', 'admin', 'client_admin', 'client_owner', 'client_manager')
          or lower(coalesce(uc.role, '')) in ('global_admin', 'admin', 'client_admin', 'client_owner', 'client_manager')
        )
        and (
          u.client_id::text = client_id
          or uc.client_id::text = client_id
        )
    );
$$;

revoke execute on function public.has_client_admin_access(uuid, text) from public;
grant execute on function public.has_client_admin_access(uuid, text) to authenticated;

-- users
alter table public.users enable row level security;
drop policy if exists users_select_self_or_admin on public.users;
create policy users_select_self_or_admin
  on public.users for select
  using (auth.uid() = auth_user_id or public.is_global_admin(auth.uid()));

drop policy if exists users_insert_admin on public.users;
create policy users_insert_admin
  on public.users for insert
  with check (public.is_global_admin(auth.uid()));

drop policy if exists users_update_self_or_admin on public.users;
create policy users_update_self_or_admin
  on public.users for update
  using (auth.uid() = auth_user_id or public.is_global_admin(auth.uid()))
  with check (auth.uid() = auth_user_id or public.is_global_admin(auth.uid()));

drop policy if exists users_delete_admin on public.users;
create policy users_delete_admin
  on public.users for delete
  using (public.is_global_admin(auth.uid()));

-- profiles
alter table public.profiles enable row level security;
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
  on public.profiles for select
  using (id = auth.uid() or auth_user_id = auth.uid() or public.is_global_admin(auth.uid()));

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
  on public.profiles for update
  using (id = auth.uid() or auth_user_id = auth.uid() or public.is_global_admin(auth.uid()))
  with check (id = auth.uid() or auth_user_id = auth.uid() or public.is_global_admin(auth.uid()));

-- global_admins
alter table public.global_admins enable row level security;
drop policy if exists global_admins_select_self on public.global_admins;
create policy global_admins_select_self
  on public.global_admins for select
  using (user_id = auth.uid());

drop policy if exists global_admins_write_service_role on public.global_admins;
create policy global_admins_write_service_role
  on public.global_admins for insert, update, delete
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- user_clients
alter table public.user_clients enable row level security;
drop policy if exists user_clients_select_self_or_admin on public.user_clients;
create policy user_clients_select_self_or_admin
  on public.user_clients for select
  using (
    public.is_global_admin(auth.uid())
    or user_id = public.current_app_user_id()
    or auth_user_id = auth.uid()
  );

drop policy if exists user_clients_write_admin on public.user_clients;
create policy user_clients_write_admin
  on public.user_clients for insert, update, delete
  using (
    public.is_global_admin(auth.uid())
    or public.has_client_admin_access(auth.uid(), client_id::text)
  )
  with check (
    public.is_global_admin(auth.uid())
    or public.has_client_admin_access(auth.uid(), client_id::text)
  );

-- cliente (canonical companies table)
alter table public.cliente enable row level security;
drop policy if exists cliente_select_member_or_admin on public.cliente;
create policy cliente_select_member_or_admin
  on public.cliente for select
  using (public.is_global_admin(auth.uid()) or public.has_client_id_access(auth.uid(), id::text));

drop policy if exists cliente_write_admin_only on public.cliente;
create policy cliente_write_admin_only
  on public.cliente for insert, update, delete
  using (public.is_global_admin(auth.uid()))
  with check (public.is_global_admin(auth.uid()));

-- Optional legacy clients table (only if it exists).
do $$
begin
  if to_regclass('public.clients') is not null then
    execute 'alter table public.clients enable row level security';
    execute 'drop policy if exists clients_select_member_or_admin on public.clients';
    execute 'create policy clients_select_member_or_admin on public.clients for select using (public.is_global_admin(auth.uid()) or public.has_client_id_access(auth.uid(), id::text))';
    execute 'drop policy if exists clients_write_admin_only on public.clients';
    execute 'create policy clients_write_admin_only on public.clients for insert, update, delete using (public.is_global_admin(auth.uid())) with check (public.is_global_admin(auth.uid()))';
  end if;
end $$;

-- company_documents
alter table public.company_documents enable row level security;
drop policy if exists company_documents_read on public.company_documents;
create policy company_documents_read
  on public.company_documents for select
  using (public.is_global_admin(auth.uid()) or public.has_client_slug_access(auth.uid(), company_slug));

drop policy if exists company_documents_write on public.company_documents;
create policy company_documents_write
  on public.company_documents for insert, update, delete
  using (public.is_global_admin(auth.uid()) or public.has_client_slug_access(auth.uid(), company_slug))
  with check (public.is_global_admin(auth.uid()) or public.has_client_slug_access(auth.uid(), company_slug));

-- kanban_cards
alter table public.kanban_cards enable row level security;
drop policy if exists kanban_cards_read on public.kanban_cards;
create policy kanban_cards_read
  on public.kanban_cards for select
  using (public.is_global_admin(auth.uid()) or public.has_client_slug_access(auth.uid(), client_slug));

drop policy if exists kanban_cards_write on public.kanban_cards;
create policy kanban_cards_write
  on public.kanban_cards for insert, update, delete
  using (public.is_global_admin(auth.uid()) or public.has_client_slug_access(auth.uid(), client_slug))
  with check (public.is_global_admin(auth.uid()) or public.has_client_slug_access(auth.uid(), client_slug));

-- user_settings
alter table public.user_settings enable row level security;
drop policy if exists user_settings_select_self_or_admin on public.user_settings;
create policy user_settings_select_self_or_admin
  on public.user_settings for select
  using (user_id = public.current_app_user_id() or public.is_global_admin(auth.uid()));

drop policy if exists user_settings_write_self_or_admin on public.user_settings;
create policy user_settings_write_self_or_admin
  on public.user_settings for insert, update, delete
  using (user_id = public.current_app_user_id() or public.is_global_admin(auth.uid()))
  with check (user_id = public.current_app_user_id() or public.is_global_admin(auth.uid()));

-- audit_logs
alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_admin_read on public.audit_logs;
create policy audit_logs_admin_read
  on public.audit_logs for select
  using (public.is_global_admin(auth.uid()));

drop policy if exists audit_logs_admin_write on public.audit_logs;
create policy audit_logs_admin_write
  on public.audit_logs for insert, update, delete
  using (public.is_global_admin(auth.uid()))
  with check (public.is_global_admin(auth.uid()));

-- support_requests (no anonymous inserts)
alter table public.support_requests enable row level security;
drop policy if exists support_requests_insert_authenticated on public.support_requests;
create policy support_requests_insert_authenticated
  on public.support_requests for insert
  with check (auth.uid() is not null);

drop policy if exists support_requests_admin_read on public.support_requests;
create policy support_requests_admin_read
  on public.support_requests for select
  using (public.is_global_admin(auth.uid()));

drop policy if exists support_requests_admin_write on public.support_requests;
create policy support_requests_admin_write
  on public.support_requests for update, delete
  using (public.is_global_admin(auth.uid()))
  with check (public.is_global_admin(auth.uid()));

-- company_integrations
alter table public.company_integrations enable row level security;
drop policy if exists company_integrations_read on public.company_integrations;
create policy company_integrations_read
  on public.company_integrations for select
  using (public.is_global_admin(auth.uid()) or public.has_client_id_access(auth.uid(), company_id::text));

drop policy if exists company_integrations_write on public.company_integrations;
create policy company_integrations_write
  on public.company_integrations for insert, update, delete
  using (public.is_global_admin(auth.uid()) or public.has_client_admin_access(auth.uid(), company_id::text))
  with check (public.is_global_admin(auth.uid()) or public.has_client_admin_access(auth.uid(), company_id::text));

-- notes (private). This block adapts to notes.user_id or notes.auth_user_id.
do $$
begin
  if to_regclass('public.notes') is null then
    raise notice 'notes table missing; skipping notes policies';
    return;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notes' and column_name = 'user_id'
  ) then
    execute 'alter table public.notes enable row level security';
    execute 'drop policy if exists notes_read_private on public.notes';
    execute 'create policy notes_read_private on public.notes for select using (user_id = public.current_app_user_id())';
    execute 'drop policy if exists notes_write_private on public.notes';
    execute '' ||
      'create policy notes_write_private on public.notes for insert, update, delete ' ||
      'using (user_id = public.current_app_user_id()) ' ||
      'with check (user_id = public.current_app_user_id())';
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notes' and column_name = 'auth_user_id'
  ) then
    execute 'alter table public.notes enable row level security';
    execute 'drop policy if exists notes_read_private on public.notes';
    execute 'create policy notes_read_private on public.notes for select using (auth_user_id = auth.uid())';
    execute 'drop policy if exists notes_write_private on public.notes';
    execute '' ||
      'create policy notes_write_private on public.notes for insert, update, delete ' ||
      'using (auth_user_id = auth.uid()) ' ||
      'with check (auth_user_id = auth.uid())';
  else
    raise notice 'notes table has no user_id/auth_user_id; skipping notes policies';
  end if;
end $$;

-- Storage policies (company-documents and avatars).
drop policy if exists company_documents_read on storage.objects;
create policy company_documents_read
  on storage.objects for select
  using (
    bucket_id = 'company-documents'
    and public.has_client_slug_access(auth.uid(), (storage.foldername(name))[1])
  );

drop policy if exists company_documents_write on storage.objects;
create policy company_documents_write
  on storage.objects for insert, update, delete
  using (
    bucket_id = 'company-documents'
    and public.has_client_slug_access(auth.uid(), (storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'company-documents'
    and public.has_client_slug_access(auth.uid(), (storage.foldername(name))[1])
  );

drop policy if exists avatars_read on storage.objects;
create policy avatars_read
  on storage.objects for select
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = public.current_app_user_id()::text
      or public.is_global_admin(auth.uid())
    )
  );

drop policy if exists avatars_write on storage.objects;
create policy avatars_write
  on storage.objects for insert, update, delete
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = public.current_app_user_id()::text
      or public.is_global_admin(auth.uid())
    )
  )
  with check (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = public.current_app_user_id()::text
      or public.is_global_admin(auth.uid())
    )
  );

-- Indexes for RLS performance.
create index if not exists users_auth_user_id_idx on public.users (auth_user_id);
create index if not exists users_client_id_idx on public.users (client_id);
create index if not exists users_active_idx on public.users (active);
create index if not exists global_admins_user_id_idx on public.global_admins (user_id);
create index if not exists user_clients_user_id_idx on public.user_clients (user_id);
create index if not exists user_clients_auth_user_id_idx on public.user_clients (auth_user_id);
create index if not exists user_clients_client_id_idx on public.user_clients (client_id);
create index if not exists user_clients_client_slug_idx on public.user_clients (client_slug);
create index if not exists company_documents_slug_idx on public.company_documents (company_slug);
create index if not exists kanban_cards_client_slug_idx on public.kanban_cards (client_slug);
create index if not exists user_settings_user_id_idx on public.user_settings (user_id);

commit;
