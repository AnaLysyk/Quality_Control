# Banco de dados – tabelas e fluxos

## Visão geral
O projeto utiliza PostgreSQL como banco principal, com o Prisma como única fonte da verdade do schema.

Tabelas principais:
- `User`: identidade do usuário
- `Company`: empresa/tenant
- `UserCompany`: vínculo usuário ↔ empresa (role por empresa)
- `SupportRequest`: solicitações de acesso/suporte
- `Release`: releases e metadados de runs
- `TestRun`: execuções de teste (para métricas)

## Autenticação e papéis
- Login realizado pelo backend (Prisma)
- Papel do usuário em `UserCompany.role`
- Usuário pode ter múltiplas empresas com papéis diferentes

## Multitenancy (UserCompany)
- `UserCompany` armazena o vínculo por empresa (`company_id`) e o papel no contexto (`role`)
- Backend resolve o tenant com base no vínculo e/ou token de sessão

## Empresa ativa (frontend)
- Frontend mantém empresa ativa no `ClientContext`
- Seleção persistida em `localStorage` com chave `activeClient:<userId>`
- Troca de empresa ativa salva identificador localmente e filtra telas/chamadas de API

## Papéis (roles)
Valores esperados:
- `admin` (admin da empresa)
- `user` (usuário padrão)
- `global_admin` (admin do sistema, quando aplicável)

## Segurança e privacidade
- Usuários não admin só veem dados do `company_id` associado
- Admins globais podem consultar todas as empresas

## Documentos por empresa
- Documentos armazenados localmente via `/api/company-documents` (JSON + arquivos em disco)
- Para persistência futura, recomenda-se criar tabela `company_documents` e migrar o armazenamento
