# Arquitetura geral do sistema (backend + APIs + frontend)

Este repositório se apoia em três pilares principais:

1. **Frontend Next.js (`app/`)**: renderiza as telas (admin, empresa, usuário) diretamente no App Router, roda dentro do servidor Next e expõe APIs internas (`app/api/**`) para dados de acesso rápido (runs, usuários, documentos etc.).
2. **Microserviço NestJS (`backend/src/`)**: concentra integrações mais complexas (Qase, autenticação com Supabase, verificações de integridade) e pode ser executado isoladamente quando necessário.
3. **Armazenamento e integrações**: Supabase para usuários, empresas, perfis e auditorias; arquivos JSON em `data/` para runs e defeitos manuais (ex.: `data/releases-manual.json`).

## Backend NestJS (`backend/src/`)

- **Autenticação**: o módulo `auth` controla login e testes no Nest. O guard `AuthGuard` usa o token do Supabase (`auth.controller.ts`, `auth.service.ts`) e permite rotas públicas (como health) e rotas protegidas (Qase).
- **Qase**: `qase.service.ts` encapsula as chamadas para `https://api.qase.io/v1` (projects, runs, cases) usando `QASE_API_TOKEN` e `QASE_DEFAULT_PROJECT`. Quando o token não está disponível, o fallback entrega amostras locais.
- **Controller**: `QaseController` protege as rotas com o guard e expõe `/projects`, `/runs`, `/runs/:id` e `/runs/:id/cases`. Qualquer cliente autorizado (admin) pode consumir esses dados.
- **Health/tests**: `health.controller.ts` e `backend/test/health.spec.ts` garantem que o Nest está no ar e responde corretamente durante o boot.

## API Next.js (`app/api/**`)

- **Admin/defeitos** (`app/api/admin/defeitos/route.ts`): agrega defeitos do Qase usando `QASE_TOKEN` + `QASE_PROJECT_MAP`, mapeia slugs para projetos e entrega totais por run, status e empresa; o fallback entra quando o token não existe, mantendo o painel de admin atualizado.
- **Runs por empresa** (`app/api/empresas/[slug]/runs/route.ts`): reutiliza `/api/releases` para listar runs por slug, alimentando dropdowns e filtros da empresa.
- **Users/Responsáveis** (`app/api/admin/users/route.ts`): filtra por `client_id` e `role` e expõe a lista de usuários ativos (com `all=true` para admins); esse recurso alimenta a tela de defeitos.
- **Outros recursos**: `app/api/releases-manual` lida com defeitos manuais (POST/PATCH/DELETE), `app/api/me/clients` indica os clientes do usuário logado e várias rotas Next entregam dados diretamente ao front.

## Fluxos críticos

| Cenário | Origem dos dados | Observações |
| --- | --- | --- |
| Admin vê panorama geral | `/api/admin/quality/overview`, `/api/admin/defeitos`, `/api/admin/audit-logs` | Mostra empresas principais, alertas e métricas por run. |
| Empresa cria/visualiza defeitos | `/api/empresas/[slug]/runs`, `/api/admin/users?client_id=...`, `/api/releases-manual`, `/api/empresas/[slug]/defeitos` (Qase) | Dropdown de runs, responsáveis filtrados por cliente, Kanban mistura casos automáticos (API) e manuais; badge `API` identifica itens imutáveis. |
| Kanban | `components/Kanban.tsx` consome `KanbanData`; apenas os casos manuais (`fromApi=false`) são editáveis, mas o fluxo de import/export trata todos os casos. |

## Dados e consistência

- Runs e defeitos criados manualmente residem em JSON (`data/releases-manual.json`) e são acessados pelos endpoints Next (`/api/releases-manual`), garantindo que front e backend puxem da mesma fonte. O backend Nest entra apenas quando o token Qase está disponível para agregar dados extra.
- A Supabase armazena usuários, perfis e auditorias; os guards verificam `is_global_admin`, o Next filtra responsáveis por cliente e o admin pode consultar todas as empresas.
- Como `forceConsistentCasingInFileNames` está ativo, o backend compila de forma previsível em Windows e macOS, mantendo os arquivos com nomes consistentes.

## Onde começar

1. Entenda a interação front/back assistindo `app/empresas/[slug]/defeitos/page.tsx`, `components/Kanban.tsx` e `app/api/admin/defeitos/route.ts`.
2. Revise autenticação no backend (`backend/src/auth/` – guards, controllers, services).
3. Leia o fluxo de documentos e uploads em `app/api/company-documents` e considere o controle de acesso por empresa.
