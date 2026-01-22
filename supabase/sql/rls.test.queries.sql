-- Replace UUIDs with the auth.user IDs you want to test.
-- Admin auth UUID: 11111111-1111-1111-1111-111111111111
-- User auth UUID:  33333333-3333-3333-3333-333333333333

-- Admin context
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
select auth.uid();

select id, email, role, is_global_admin from public.users;
select id, slug from public.cliente;
select id, company_slug from public.company_documents;
select id, client_slug from public.kanban_cards;
select user_id, language, theme from public.user_settings;
select id, created_at from public.audit_logs;
select id, email, status from public.support_requests;
select id, company_id from public.company_integrations;
select id, title from public.notes;

-- Normal user context
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select auth.uid();

select id, email from public.users;
select id, slug from public.cliente;
select id, company_slug from public.company_documents;
select id, client_slug from public.kanban_cards;
select user_id, language, theme from public.user_settings;
select id, title from public.notes;

-- Support request insert should work only when authenticated
insert into public.support_requests (email, message, status)
values ('user@example.com', 'RLS test', 'open');

-- Anon context
set local role anon;
select set_config('request.jwt.claims', '{}', true);
select auth.uid();

-- This insert should fail when anon inserts are blocked
insert into public.support_requests (email, message, status)
values ('anon@example.com', 'RLS test', 'open');

-- Storage visibility (company-documents, avatars)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
select name, bucket_id from storage.objects where bucket_id in ('company-documents', 'avatars');
