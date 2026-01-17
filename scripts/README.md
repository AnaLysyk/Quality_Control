# RLS, políticas e auditoria (fases)

Este diretório reúne scripts SQL organizados em fases para habilitar Row Level Security, criar políticas multi-tenant e adicionar gatilhos de auditoria para dados sensíveis.

## Fluxo recomendado
1. Faça backup do schema atual (staging):
   ```bash
   pg_dump --schema-only -h HOST -U USER -d DB -n public > before_rls_schema.sql
   ```
2. Execute os scripts na ordem indicada no ambiente de staging:
   - `psql -f scripts/01_helper_indexes.sql`
   - `psql -f scripts/02_enable_rls.sql`
   - `psql -f scripts/03_policies.sql`
   - `psql -f scripts/04_audit_triggers.sql`
   - (opcional, recomendado) `psql -f scripts/05_crypto_policies.sql`
   - (quando houver tokens em texto claro) `psql -f scripts/06_encrypt_company_integrations.sql`
   - (ajustes do lint do Supabase) `psql -f scripts/09_lint_fixes.sql`
   - (ajustes de search_path) `psql -f scripts/10_fix_search_path.sql`
   - (segurança para admin/support) `psql -f scripts/16_support_requests_global_admins_security.sql`
   - (sincronização dos enums de cliente) `psql -f scripts/17_fix_cliente_enums.sql`
   - (dados de telefone) `psql -f scripts/11_users_phone.sql`
   - (dados de telefone) `psql -f scripts/12_profiles_phone.sql`
   - (audit logs do app) `psql -f scripts/13_audit_logs.sql`

   Você também pode abrir cada arquivo no editor SQL do Supabase e executar sequencialmente, confirmando o resultado antes do próximo script.

## Checklist de verificação (staging)
- Função `get_current_client_id` existe:
  ```sql
  SELECT proname FROM pg_proc WHERE proname = 'get_current_client_id';
  ```
- RLS ativado para as tabelas principais:
  ```sql
  SELECT relname, relrowsecurity
  FROM pg_class
  WHERE relname IN (
    'qase_defects','qase_projects_raw','qase_cases_raw','qase_runs_raw',
    'qase_results_raw','qase_milestones_raw','run_metrics',
    'company_quality_metrics','company_integrations'
  );
  ```
- Políticas publicadas:
  ```sql
  SELECT * FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('qase_defects','run_metrics','company_integrations');
  ```
- Proteção de tokens ativa: tente um `SELECT` na tabela `public.company_integrations` com um usuário autenticado (não service); a política deve bloquear acesso a registros terceiros.
- Audit logs funcionando:
  ```sql
  SELECT * FROM public.audit_log ORDER BY created_at DESC LIMIT 20;
  ```
- Garantia de escopo: autentique um usuário com `client_id` e verifique que os `SELECTs` retornam apenas os dados daquele cliente.
- Se rodar o script 05 (crypto), confirme:
  - `SELECT proname, proacl FROM pg_proc WHERE proname IN ('qase_encrypt','qase_decrypt');`
  - `SELECT grantee, privilege_type FROM information_schema.column_privileges WHERE table_schema='public' AND table_name IN ('company_integrations','cliente') AND column_name IN ('qase_token_cipher','qase_project_code_cipher');`
- Audit actor: defina `SET LOCAL app.audit_actor = '<uuid_do_actor>';` antes de um `INSERT/UPDATE/DELETE` e verifique a coluna `changed_by` na `audit_log`.
- Se usar o script 06 (migração de tokens), após configurar a passphrase:
  - `SELECT count(*) AS cipher_count FROM public.company_integrations WHERE qase_token_cipher IS NOT NULL;`
  - `SELECT count(*) AS plain_count FROM public.company_integrations WHERE access_token IS NOT NULL;`
  - `SET LOCAL app.qase_passphrase = 'SUA_PASSPHRASE'; SELECT id, public.qase_decrypt(qase_token_cipher) FROM public.company_integrations WHERE qase_token_cipher IS NOT NULL LIMIT 5;`
- Para evitar que o Supabase recrie a tabela `cliente` com tipo `USER-DEFINED`, confirme que os novos enums (`cliente_integration_type`, `cliente_status_type`) existem em `pg_type` e aparecem em `information_schema.columns` como `udt_name` das colunas `integration_type` e `status`.

## Rollback (quando necessário)
- Reverter triggers e função de auditoria (inverso do script 04).
- Remover políticas (inverso do script 03).
- Desabilitar RLS (`ALTER TABLE ... DISABLE ROW LEVEL SECURITY` para cada tabela).
- Apagar helper e índices, se precisar.

## Notas e cuidados
- A função utiliza `auth.uid()` e exige que `public.users.auth_user_id` esteja preenchido. Ajuste se usar outro mapeamento (profiles, etc.).
- A chave `service_role` ignora RLS; deixe seu uso limitado ao backend.
- O gatilho de auditoria substitui chaves padrão; adicione colunas sensíveis extras ao array se precisar monitorar outros campos.
- Sempre execute os scripts primeiro em staging antes de aplicar em produção.
