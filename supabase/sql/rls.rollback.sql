-- Rollback for supabase/sql/rls.sql.
-- This drops policies/functions created by rls.sql and disables RLS on affected tables.
-- Review before running; if these objects existed prior, they will be removed.

begin;

-- Storage policies.
drop policy if exists company_documents_read on storage.objects;
drop policy if exists company_documents_write on storage.objects;
drop policy if exists avatars_read on storage.objects;
drop policy if exists avatars_write on storage.objects;

-- users
drop policy if exists users_select_self_or_admin on public.users;
drop policy if exists users_insert_admin on public.users;
drop policy if exists users_update_self_or_admin on public.users;
drop policy if exists users_delete_admin on public.users;
alter table public.users disable row level security;

-- profiles
drop policy if exists profiles_select_self_or_admin on public.profiles;
drop policy if exists profiles_update_self_or_admin on public.profiles;
alter table public.profiles disable row level security;

-- global_admins
drop policy if exists global_admins_select_self on public.global_admins;
drop policy if exists global_admins_write_service_role on public.global_admins;
alter table public.global_admins disable row level security;

-- user_clients
drop policy if exists user_clients_select_self_or_admin on public.user_clients;
drop policy if exists user_clients_write_admin on public.user_clients;
alter table public.user_clients disable row level security;

-- cliente (canonical companies table)
drop policy if exists cliente_select_member_or_admin on public.cliente;
drop policy if exists cliente_write_admin_only on public.cliente;
alter table public.cliente disable row level security;

-- clients (legacy table, only if exists)
do $$
begin
  if to_regclass('public.clients') is not null then
    execute 'drop policy if exists clients_select_member_or_admin on public.clients';
    execute 'drop policy if exists clients_write_admin_only on public.clients';
    execute 'alter table public.clients disable row level security';
  end if;
end $$;

-- company_documents
drop policy if exists company_documents_read on public.company_documents;
drop policy if exists company_documents_write on public.company_documents;
alter table public.company_documents disable row level security;

-- kanban_cards
drop policy if exists kanban_cards_read on public.kanban_cards;
drop policy if exists kanban_cards_write on public.kanban_cards;
alter table public.kanban_cards disable row level security;

-- user_settings
drop policy if exists user_settings_select_self_or_admin on public.user_settings;
drop policy if exists user_settings_write_self_or_admin on public.user_settings;
alter table public.user_settings disable row level security;

-- audit_logs
drop policy if exists audit_logs_admin_read on public.audit_logs;
drop policy if exists audit_logs_admin_write on public.audit_logs;
alter table public.audit_logs disable row level security;

-- support_requests
drop policy if exists support_requests_insert_authenticated on public.support_requests;
drop policy if exists support_requests_admin_read on public.support_requests;
drop policy if exists support_requests_admin_write on public.support_requests;
alter table public.support_requests disable row level security;

-- company_integrations
drop policy if exists company_integrations_read on public.company_integrations;
drop policy if exists company_integrations_write on public.company_integrations;
alter table public.company_integrations disable row level security;

-- notes (private policies, only if exists)
do $$
begin
  if to_regclass('public.notes') is not null then
    execute 'drop policy if exists notes_read_private on public.notes';
    execute 'drop policy if exists notes_write_private on public.notes';
    execute 'alter table public.notes disable row level security';
  end if;
end $$;

-- Functions created by rls.sql.
drop function if exists public.has_client_admin_access(uuid, text);
drop function if exists public.has_client_slug_access(uuid, text);
drop function if exists public.has_client_id_access(uuid, text);
drop function if exists public.current_app_user_id();
drop function if exists public.is_global_admin(uuid);

-- Indexes created by rls.sql (drop with care).
drop index if exists public.users_auth_user_id_idx;
drop index if exists public.users_client_id_idx;
drop index if exists public.users_active_idx;
drop index if exists public.global_admins_user_id_idx;
drop index if exists public.user_clients_user_id_idx;
drop index if exists public.user_clients_auth_user_id_idx;
drop index if exists public.user_clients_client_id_idx;
drop index if exists public.user_clients_client_slug_idx;
drop index if exists public.company_documents_slug_idx;
drop index if exists public.kanban_cards_client_slug_idx;
drop index if exists public.user_settings_user_id_idx;

commit;
