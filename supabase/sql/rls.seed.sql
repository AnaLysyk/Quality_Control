-- Seed data for RLS testing. Safe to run multiple times.
-- Adjust UUIDs or values if they conflict with existing constraints.

begin;

do $$
declare
  admin_auth uuid := '11111111-1111-1111-1111-111111111111';
  admin_user uuid := '22222222-2222-2222-2222-222222222222';
  user_auth uuid := '33333333-3333-3333-3333-333333333333';
  user_user uuid := '44444444-4444-4444-4444-444444444444';
  client_uuid uuid := '55555555-5555-5555-5555-555555555555';
  company_slug text := 'acme';
  now_ts timestamptz := now();
begin
  if to_regclass('public.users') is not null then
    begin
      insert into public.users (id, auth_user_id, email, name, role, is_global_admin, client_id, active)
      values
        (admin_user, admin_auth, 'admin@example.com', 'Admin Seed', 'global_admin', true, null, true),
        (user_user, user_auth, 'user@example.com', 'User Seed', 'client_user', false, client_uuid, true)
      on conflict do nothing;
    exception when undefined_column then
      begin
        insert into public.users (id, auth_user_id, email, name)
        values
          (admin_user, admin_auth, 'admin@example.com', 'Admin Seed'),
          (user_user, user_auth, 'user@example.com', 'User Seed')
        on conflict do nothing;
      exception when undefined_column then
        insert into public.users (id, email)
        values
          (admin_user, 'admin@example.com'),
          (user_user, 'user@example.com')
        on conflict do nothing;
      end;
    end;
  end if;

  if to_regclass('public.global_admins') is not null then
    begin
      insert into public.global_admins (user_id)
      values (admin_auth)
      on conflict do nothing;
    exception when undefined_column then
      null;
    end;
  end if;

  if to_regclass('public.cliente') is not null then
    begin
      insert into public.cliente (id, slug, company_name, active)
      values (client_uuid, company_slug, 'Acme', true)
      on conflict do nothing;
    exception when undefined_column then
      insert into public.cliente (id, slug)
      values (client_uuid, company_slug)
      on conflict do nothing;
    end;
  end if;

  if to_regclass('public.user_clients') is not null then
    begin
      insert into public.user_clients (user_id, auth_user_id, client_id, client_slug, role, active)
      values
        (admin_user, admin_auth, client_uuid, company_slug, 'ADMIN', true),
        (user_user, user_auth, client_uuid, company_slug, 'USER', true)
      on conflict do nothing;
    exception when undefined_column then
      begin
        insert into public.user_clients (user_id, client_id, role, active)
        values
          (admin_user, client_uuid, 'ADMIN', true),
          (user_user, client_uuid, 'USER', true)
        on conflict do nothing;
      exception when undefined_column then
        insert into public.user_clients (user_id, client_id)
        values
          (admin_user, client_uuid),
          (user_user, client_uuid)
        on conflict do nothing;
      end;
    end;
  end if;

  if to_regclass('public.company_documents') is not null then
    begin
      insert into public.company_documents (id, company_slug, kind, title, created_at, created_by)
      values ('66666666-6666-6666-6666-666666666666', company_slug, 'link', 'Seed Doc', now_ts, admin_auth)
      on conflict do nothing;
    exception when undefined_column then
      begin
        insert into public.company_documents (id, company_slug, kind, title)
        values ('66666666-6666-6666-6666-666666666666', company_slug, 'link', 'Seed Doc')
        on conflict do nothing;
      exception when others then
        null;
      end;
    end;
  end if;

  if to_regclass('public.kanban_cards') is not null then
    begin
      insert into public.kanban_cards (client_slug, project, run_id, title, status, created_at, created_by)
      values (company_slug, 'PRJ', 1, 'Seed Card', 'PASS', now_ts, admin_auth)
      on conflict do nothing;
    exception when others then
      null;
    end;
  end if;

  if to_regclass('public.user_settings') is not null then
    begin
      insert into public.user_settings (user_id, language, theme, updated_at)
      values (admin_user, 'en', 'system', now_ts)
      on conflict do nothing;
    exception when undefined_column then
      null;
    end;
  end if;

  if to_regclass('public.notes') is not null then
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'notes' and column_name = 'user_id'
    ) then
      begin
        execute 'insert into public.notes (user_id, title, content) values ($1, $2, $3) on conflict do nothing'
        using admin_user, 'Seed Note', 'Seed note content';
      exception when others then
        null;
      end;
    elsif exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'notes' and column_name = 'auth_user_id'
    ) then
      begin
        execute 'insert into public.notes (auth_user_id, title, content) values ($1, $2, $3) on conflict do nothing'
        using admin_auth, 'Seed Note', 'Seed note content';
      exception when others then
        null;
      end;
    end if;
  end if;

  if to_regclass('public.support_requests') is not null then
    begin
      insert into public.support_requests (email, message, status, user_id, created_at)
      values ('user@example.com', 'Seed support request', 'open', user_user, now_ts)
      on conflict do nothing;
    exception when undefined_column then
      begin
        insert into public.support_requests (email, message, status)
        values ('user@example.com', 'Seed support request', 'open')
        on conflict do nothing;
      exception when others then
        null;
      end;
    end;
  end if;

  if to_regclass('public.company_integrations') is not null then
    begin
      insert into public.company_integrations (company_id, project_code, created_at)
      values (client_uuid, 'ACME', now_ts)
      on conflict do nothing;
    exception when undefined_column then
      null;
    end;
  end if;

  if to_regclass('public.audit_logs') is not null then
    begin
      insert into public.audit_logs (action, entity_type, entity_id, created_at, actor_user_id, actor_email)
      values ('seed', 'user', admin_user::text, now_ts, admin_auth, 'admin@example.com')
      on conflict do nothing;
    exception when undefined_column then
      null;
    end;
  end if;

  if to_regclass('public.runs') is not null then
    begin
      insert into public.runs (client_id, client_slug, title, created_at)
      values (client_uuid, company_slug, 'Seed Run', now_ts)
      on conflict do nothing;
    exception when undefined_column then
      begin
        insert into public.runs (title, created_at)
        values ('Seed Run', now_ts)
        on conflict do nothing;
      exception when others then
        null;
      end;
    end;
  end if;

  if to_regclass('public.defects') is not null then
    begin
      insert into public.defects (client_id, client_slug, title, created_at)
      values (client_uuid, company_slug, 'Seed Defect', now_ts)
      on conflict do nothing;
    exception when undefined_column then
      begin
        insert into public.defects (title, created_at)
        values ('Seed Defect', now_ts)
        on conflict do nothing;
      exception when others then
        null;
      end;
    end;
  end if;
end $$;

commit;
