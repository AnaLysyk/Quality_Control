# Arquitetura geral do sistema (backend + APIs + frontend)

Este repositório foi organizado com três pilares:

1. **Frontend Next.js (`app/`)** – renderiza as interfaces (admin/company/user), roda dentro do servidor Next e expõe APIs internas (`app/api/**`) para dados rápidos (ex.: runs, usuários).
2. **Microserviço NestJS (`backend/src/`)** – concentra integrações mais complexas (Qase, autenticação via Supabase, scripts de saúde/testes) e pode rodar isolado se necessário.
3. **Armazenamento / integrações** – Supabase (usuários, empresas, perfis, auditorias) e arquivos JSON para runs/defeitos manuais (ex.: `data/releases-manual.json`).

## Backend NestJS (pasta `backend/src/`)

- **Autenticação**: `auth` controla login/testes do Nest. O guard `AuthGuard` usa o token Supabase (`auth.controller.ts`, `auth.service.ts`) e permite rotas públicas (health) e protegidas (Qase).  
- **Qase**: `qase.service.ts` abstrai chamadas HTTP para `https://api.qase.io/v1` (projects, runs, run detail, run cases) usando `QASE_API_TOKEN` e `QASE_DEFAULT_PROJECT`. O fallback fornece amostras locais quando o token não existe.  
- **Controller**: `QaseController` protege as rotas com o guard e expõe `/projects`, `/runs`, `/runs/:id`, `/runs/:id/cases`. Qualquer consumidor autorizado (admin) pode usar esses dados.  
- **Health/tests**: `health.controller.ts` e `backend/test/health.spec.ts` garantem que o Nest está ligado e responde corretamente ao boot.

## API Next.js (`app/api/**`)

- **Admin/defeitos** (`app/api/admin/defeitos/route.ts`): agrega defeitos do Qase usando `QASE_TOKEN`+`QASE_PROJECT_MAP`, mapeia slugs → projetos, e fornece totais por run/status/empresa; fallback em caso de token ausente. Serve o painel do admin com dados reais.  
- **Runs por empresa** (`app/api/empresas/[slug]/runs/route.ts`): reutiliza `/api/releases` para listar runs por slug, alimentando dropdowns da empresa.  
- **Users/Responsáveis** (`app/api/admin/users/route.ts`): permite filtrar por `client_id` e `role`, expose a lista de usuários ativos (com `all=true` para admins) usada na tela de defeitos.  
- **Outros recursos**: `app/api/releases-manual` manipula defeitos criados manualmente (POST/PATCH/DELETE), `app/api/me/clients` indica clientes do usuário logado, e várias endpoints Next expõem dados diretamente para o front.

## Fluxos críticos

| cenário | origem dos dados | notas |
| --- | --- | --- |
| Admin vê status geral | `/api/admin/quality/overview`, `/api/admin/defeitos`, `/api/admin/audit-logs` | Mostra carrossel de empresas, atenção atual e métricas por run. |
| Empresa cria/visualiza defeitos | `/api/empresas/[slug]/runs`, `/api/admin/users?client_id=...`, `/api/releases-manual`, `/api/empresas/[slug]/defeitos` (Qase) | Dropdown com runs (busca + lista), responsables filtrados a partir dos usuários da empresa, Kanban mistura casos automáticos (API) e manuais. |
| Kanban | `components/Kanban.tsx` recebe `KanbanData`; só permite editar casos manuais (`fromApi=false`), mas mantém import/export para todos os casos. A badge `API` identifica itens imutáveis. |

## Dados e consistência

- Os runs/defeitos manuais são armazenados em JSON (`data/releases-manual.json`) e operam sobre endpoints Next (`/api/releases-manual`), garantindo que tanto front quanto backend compartilham a fonte. O backend Nest só entra para agrupar dados Qase quando o token está configurado.  
- A Supabase armazena usuários/perfis, e os guards verificam `is_global_admin`. O Next filtra responsáveis por cliente enquanto o admin pode pedir todos.  
- Como `forceConsistentCasingInFileNames` está ativo, o backend compila sem surpresa em Windows/macOS e reforça a manutenção de arquivos com nomes consistentes.

## Onde começar a navegar

1. Front/back interplay: veja `app/empresas/[slug]/defeitos/page.tsx`, `components/Kanban.tsx` e `app/api/admin/defeitos/route.ts`.  
2. Autenticação: `backend/src/auth/` (guards, controllers, serviços).  
3. Integrações: `backend/src/qase/` e as variáveis de ambiente (`QASE_API_TOKEN`, `QASE_PROJECT_MAP`).  
4. Documentação complementar: `docs/arquitetura_front.md`, `docs/arquitetura_api.md`, `docs/banco_de_dados.md`.

Com essa visão, qualquer dev pode identificar rapidamente onde ajustar uma rota, consumir um endpoint ou entender como as runs/defeitos se propagam do Qase até o Kanban visual.
