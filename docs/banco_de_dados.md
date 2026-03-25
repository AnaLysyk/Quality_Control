# Banco de dados – tabelas e fluxos

## Visão geral
O projeto usa PostgreSQL como banco principal. O Prisma é a única fonte da verdade do schema.

Tabelas principais:
- `User`: identidade do usuário.
- `Company`: empresa/tenant.
- `UserCompany`: vínculo usuário ↔ empresa (role por empresa).
- `SupportRequest`: solicitações de acesso/suporte.
- `Release`: releases e metadados de runs.
- `TestRun`: execuções de teste (para métricas).

## Autenticação e papel

- O usuário faz login pelo backend (Prisma).
- O papel (role) vive em `UserCompany.role`.
- Um usuário pode ter múltiplas empresas com roles diferentes.

## Multitenancy (UserCompany)

- `UserCompany` guarda o vínculo por empresa (`company_id`) e o papel no contexto (`role`).
- O backend resolve o tenant com base no vínculo e/ou no token de sessão.

## Empresa ativa (frontend)

- O frontend mantém a empresa ativa no `ClientContext`.
- A seleção é persistida em `sessionStorage` com a chave `activeClient:<userId>`.
- Ao trocar a empresa ativa, o identificador é salvo na sessão e usado para filtrar telas e chamadas de API.

## Papéis (roles)

Valores esperados:

- `admin` (admin da empresa)
- `user` (usuário padrão)
- `global_admin` (admin do sistema, quando aplicável)

## Segurança e privacidade

- Usuários não admin só veem dados do `company_id` associado.
- Admins globais podem consultar todas as empresas.

## Documentos por empresa

Os documentos são armazenados localmente via `/api/company-documents` (JSON + arquivos em disco).
Se futuramente for necessária persistência em banco, a recomendação é criar uma tabela
`company_documents` e migrar o armazenamento.
