# Banco de dados – tabelas e fluxos

## Visão geral
O projeto usa Supabase (Postgres) como base de dados principal.

Tabelas comuns no fluxo:
- `users`: usuários internos do painel (mapeia `auth_user_id` do Supabase Auth)
- `cliente`: empresas/organizações (cada registro tem `id` e `slug`)
- Outras tabelas conectadas a runs, releases e integrações específicas

## Autenticação versus perfil

- Supabase Auth autentica o usuário (`auth_user_id`).
- A tabela `users` armazena os dados do usuário no contexto da aplicação.

Padrões esperados:

- `users.auth_user_id` referencia o `auth.users.id` do Supabase.
- `users.client_id` determina a empresa do usuário (quando ele não é admin global).
- `users.is_global_admin` autoriza o acesso entre empresas.

## Segurança e privacidade

- Usuários não admin só veem dados do `client_id` associado.
- Admins globais conseguem consultar todas as empresas.

Para Row Level Security:

- Defina políticas condicionadas a `client_id`.
- Garanta que APIs server-side usem a chave certa para não vazar dados sensíveis no cliente.

## Documentos por empresa
O modelo tem duas camadas:

1. Metadados em tabela (recomendado)
   - Tabela `company_documents` com colunas como:
     - `id` (uuid)
     - `company_slug` ou `company_id`
     - `kind` (`file` ou `link`)
     - `title`, `description`
     - `url` (quando for link)
     - `storage_path` e `file_name` (quando for upload)
     - `mime_type`, `size_bytes`
     - `created_by`, `visibility`
2. Arquivos/links no storage
   - Os uploads ficam em buckets dedicados (ex.: `company-documents` no Supabase Storage)
   - As URLs são assinadas e só liberadas via APIs server-side

## Auditoria e histórico

- A tabela `audit_log` registra operações críticas (quem fez o quê e quando).
- O gatilho de auditoria usa `app.audit_actor` para identificar o ator atual.
- Os logs auxiliam na investigação de acessos indevidos ou falhas operacionais.
