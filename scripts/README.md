# RLS + Políticas + Auditoria (fases)

Este diretório contém scripts SQL em fases para habilitar Row Level Security, criar políticas multi-tenant e adicionar triggers de auditoria com redação de dados sensíveis.

## Fluxo recomendado
1. Faça um backup do staging (somente schema):
   ```
   pg_dump --schema-only -h HOST -U USER -d DB -n public > before_rls_schema.sql
   ```
2. Rode os scripts em ordem no staging:
   - `psql -f scripts/01_helper_indexes.sql`
   - `psql -f scripts/02_enable_rls.sql`
   - `psql -f scripts/03_policies.sql`
   - `psql -f scripts/04_audit_triggers.sql`
   - (opcional, recomendado) `psql -f scripts/05_crypto_policies.sql`
   - (se houver tokens em texto) `psql -f scripts/06_encrypt_company_integrations.sql`
   - (lint Supabase) `psql -f scripts/09_lint_fixes.sql`
   - (lint Supabase) `psql -f scripts/10_fix_search_path.sql`
   Ou cole cada arquivo no editor SQL do Supabase e execute, verificando a cada etapa.

## Checklist de verificação (staging)
- Função existe: `SELECT proname FROM pg_proc WHERE proname = 'get_current_client_id';`
- RLS habilitado:
  ```
  SELECT relname, relrowsecurity
  FROM pg_class
  WHERE relname IN (
    'qase_defects','qase_projects_raw','qase_cases_raw','qase_runs_raw','qase_results_raw','qase_milestones_raw','run_metrics','company_quality_metrics','company_integrations'
  );
  ```
- Políticas criadas:
  `SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('qase_defects','run_metrics','company_integrations');`
- Proteção de tokens: tente `SELECT` em `public.company_integrations` como usuário autenticado (não service) — deve retornar zero linhas pela política.
- Audit log: `SELECT * FROM public.audit_log ORDER BY created_at DESC LIMIT 20;`
- Teste de escopo: logar com usuário de teste vinculado a um client_id e garantir que os SELECTs retornam apenas linhas desse cliente.
- Se rodar o script 05 (crypto), verifique:
  - `SELECT proname, proacl FROM pg_proc WHERE proname IN ('qase_encrypt','qase_decrypt');`
  - `SELECT grantee, privilege_type FROM information_schema.column_privileges WHERE table_schema='public' AND table_name IN ('company_integrations','cliente') AND column_name IN ('qase_token_cipher','qase_project_code_cipher');`
- Audit actor (script 04 atualizado): defina `SET LOCAL app.audit_actor = '<uuid_do_actor>';` antes de um INSERT/UPDATE/DELETE e confira `changed_by` na `audit_log`.
- Se usar o script 06 (migração de tokens), após definir a passphrase na sessão:
  - `SELECT count(*) AS cipher_count FROM public.company_integrations WHERE qase_token_cipher IS NOT NULL;`
  - `SELECT count(*) AS plain_count FROM public.company_integrations WHERE access_token IS NOT NULL;`
  - `SET LOCAL app.qase_passphrase = 'SUA_PASSPHRASE'; SELECT id, public.qase_decrypt(qase_token_cipher) FROM public.company_integrations WHERE qase_token_cipher IS NOT NULL LIMIT 5;`

## Rollback (se necessário)
- Remova triggers e a função de auditoria (inverso do script 04).
- Remova as políticas (inverso do script 03).
- Desabilite RLS (`ALTER TABLE ... DISABLE ROW LEVEL SECURITY` em cada tabela).
- Remova função helper e índices, se quiser.

## Notas e cuidados
- A função usa `auth.uid()` e espera `public.users.auth_user_id` populado. Ajuste se usar outro mapeamento (profiles etc.).
- `service_role` ignora RLS; garanta uso seguro da chave de serviço no backend.
- O redator de auditoria substitui chaves comuns — adicione colunas sensíveis adicionais ao array se precisar.
- Sempre teste em staging antes de aplicar em produção.
