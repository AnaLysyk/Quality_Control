# Verificações de Segurança do BD (RLS & SECURITY DEFINER)

## Objetivo
Verificações automáticas em CI para prevenir regressões comuns de segurança de banco de dados:
- Views declaradas com `SECURITY DEFINER`
- Tabelas sensíveis sem Row Level Security (RLS) habilitado
- Views sensíveis ainda acessíveis por `PUBLIC`
- (Opcional) Funções `SECURITY DEFINER` fora de uma allowlist

Estes scripts devem ser executados em CI (GitHub Actions, GitLab CI, etc.) e falhar o pipeline caso qualquer violação seja detectada.

## Arquivos
- `./scripts/db-security-check.sh`: checagens principais (views com `SECURITY DEFINER`, tabelas sensíveis sem RLS, views sensíveis acessíveis por `PUBLIC`)
- `./scripts/db-security-check-allowlist.sh`: todas as checagens acima + allowlist para funções `SECURITY DEFINER`
- `./.gitlab-ci.yml`: jobs de exemplo para GitLab CI

## Variáveis de ambiente
- `DATABASE_URL` (obrigatório): string de conexão Postgres completa usada pelo `psql`. Se ausente, scripts saem com código `2`.
- `SENSITIVE_TABLES` (opcional): lista separada por vírgulas de tabelas totalmente qualificadas a serem tratadas como sensíveis. Formato: `schema.tabela`. Padrão: `public.users,public.company_users`. Exemplo: `SENSITIVE_TABLES="public.users,public.company_users,admin.critical_table"`
- `SENSITIVE_VIEWS` (opcional): lista separada por vírgulas de nomes de views (sem schema) a serem checadas quanto a privilégios de `PUBLIC`. Se não definido, o script gera padrões adicionando `_view` ao nome de cada tabela sensível. Exemplo: `SENSITIVE_VIEWS="users_view,company_users_view,critical_table_view"`
- `ALLOWED_SECURITY_DEFINER_FUNCTIONS` (opcional; apenas no script com allowlist): lista separada por vírgulas de nomes de funções totalmente qualificadas permitidas como `SECURITY DEFINER`. Formato: `schema.funcao`. Exemplo: `ALLOWED_SECURITY_DEFINER_FUNCTIONS="public.safe_fn,admin.minimal_helper"`

## Comportamento e códigos de saída
- Exit `0`: todas as checagens passaram
- Exit `1`: uma ou mais checagens falharam (CI deve tratar como falha)
- Exit `2`: `DATABASE_URL` ausente

## Exemplos
Local (rápido):
- `export DATABASE_URL="postgres://user:pass@host:5432/dbname"`
- `./scripts/db-security-check.sh`

Override de tabelas sensíveis:
- `export SENSITIVE_TABLES="public.users,public.company_users,admin.critical_table"`
- `./scripts/db-security-check.sh`

Script com allowlist:
- `export ALLOWED_SECURITY_DEFINER_FUNCTIONS="public.safe_fn,admin.minimal_helper"`
- `./scripts/db-security-check-allowlist.sh`

## Notas de manutenção
- Mantenha `SENSITIVE_TABLES` explícito para forçar decisões conscientes sobre o que é sensível
- Atualize `ALLOWED_SECURITY_DEFINER_FUNCTIONS` apenas via PR aprovado com justificativa (trilha de auditoria)
- Revise periodicamente novas funções `SECURITY DEFINER`; são de alto risco por projeto
