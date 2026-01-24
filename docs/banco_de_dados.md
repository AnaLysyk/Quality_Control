# Banco de dados – tabelas e fluxos

## Visão geral
O projeto usa Supabase (Postgres) como base de dados principal.

Tabelas comuns no fluxo:
- `users`: usuários internos do painel (id = `auth.users.id`)
- `company_users`: vínculos usuário ↔ empresa (multi-empresa, role por empresa)
- `cliente`: tabela de integração/status (nao representa empresa)
- Outras tabelas conectadas a runs, releases e integrações específicas

## Autenticação versus perfil

- Supabase Auth autentica o usuário (`auth_user_id`).
- A tabela `users` armazena os dados do usuário no contexto da aplicação.

Padrões esperados:

- `users.id` referencia o `auth.users.id` do Supabase.
- `users.is_global_admin` autoriza o acesso entre empresas.

## Multitenancy (company_users)

- `company_users` guarda o vínculo por empresa (`company_id`) e o papel no contexto (`role`).
- `ativo` controla se o vínculo está habilitado.
- A tabela `cliente` nao e usada para RBAC/tenant.

## Resolução de contexto (backend)

Ordem de resolução usada pelo backend (`TenantService.resolve`):

1. **Empresa ativa**: primeiro vínculo ativo em `company_users` (por `user_id`).
2. **Role**: `company_users.role` (normalizado para minúsculas).
3. **Global admin**: `users.is_global_admin` → role `global_admin/admin`.

Isso evita ambiguidade e garante que a empresa mande mais que metadata/token.

## Empresa ativa (frontend)

- O frontend mantém a empresa ativa no `ClientContext` (ver `app/context/ClientContext.tsx`).
- A seleção é persistida em `localStorage` com a chave `activeClient:<userId>`.
- Quando nao houver slug disponivel, use `companyId` como fallback no frontend.
- Ao trocar empresa ativa, o identificador é salvo localmente e usado para filtrar telas e chamadas de API.

## Papéis (roles)

Valores esperados no banco (normalizados para minúsculas):

- `global_admin` (admin do sistema)
- `client_admin` (admin de empresa)
- `client_user` (usuário padrão)

## Segurança e privacidade

- Usuários não admin só veem dados do `company_id` associado.
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
