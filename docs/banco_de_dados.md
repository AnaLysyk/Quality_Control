# Banco de Dados — Tabelas e fluxos

## Visão geral
O projeto usa Supabase (Postgres) como base principal.

Tabelas comuns no fluxo:
- `users`: usuários internos do painel (mapeia `auth_user_id` do Supabase Auth)
- `cliente`: empresas/clientes (normalmente com `id` e `slug`)
- Outras tabelas podem existir para runs/releases/integrações

## Autenticação vs Perfil
- Supabase Auth: usuário autenticado (`auth_user_id`).
- Tabela `users`: informações do usuário no contexto da aplicação.

Padrão esperado:
- `users.auth_user_id` referencia o `auth.users.id`.
- `users.client_id` define a empresa do usuário (quando não é admin global).
- `users.is_global_admin` permite acesso cross-empresa.

## Segurança e privacidade
Regras:
- Usuário não-admin só pode acessar dados do seu `client_id`.
- Admin global pode acessar todas as empresas.

Se você usar RLS (Row Level Security):
- Definir policies por `client_id`.
- Garantir que APIs server-side usem a chave apropriada (sem vazar para o client).

## Documentos por empresa
Duas camadas:

1) Metadados em tabela (recomendado)
- `company_documents` (sugestão de colunas):
  - `id` (uuid)
  - `company_slug` (texto) ou `company_id` (uuid)
  - `kind` (`file`/`link`)
  - `title`, `description`
  - `url` (para link)
  - `storage_path` (para arquivo)
  - `mime_type`, `size_bytes`, `file_name`
  - `created_at`, `created_by`

2) Arquivos em Storage
- Bucket: `company-documents`
- Path sugerido: `<companySlug>/<id>-<fileName>`
- Expor via URL assinada (curta duração) ou via endpoint autenticado.

## Migrações
Há scripts SQL em `scripts/`.

Boa prática:
- Versionar mudanças e aplicar em ordem.
- Evitar mudanças destrutivas sem backup.
- Para colunas novas, escrever código resiliente quando a coluna pode ainda não existir (durante rollout).
