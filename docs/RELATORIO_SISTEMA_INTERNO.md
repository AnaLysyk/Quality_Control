# Relatorio - Como O Sistema Funciona (Modo Interno)

Este repo e uma ferramenta interna de QA. A regra aqui e: **funciona > perfeito**.

O app e um Next.js (App Router) que faz duas coisas:
- UI (telas) em `app/**`
- BFF/API em `app/api/**` (mesmo servidor)

O modo padrao atual evita dependencia obrigatoria de banco. Os dados criticos para QA ficam em JSON local (ou memoria).

## TL;DR

- Login: `POST /api/auth/login` (cookie `access_token`; JWT se `JWT_SECRET` existir, senao vira `session_id`).
- Usuarios/empresas/vinculos: store local em `data/local-auth-store.json` (com fallback `data/local-auth-store.sample.json`).
- Runs/defeitos manuais: JSON em `data/releases-manual.json` + `data/releases-manual-cases.json`.
- Notas do usuario: JSON em `data/user-notes.json`.
- Solicitacoes de acesso/suporte: JSON em `data/support-requests.json`.
- Defeitos locais (simples): JSON em `data/defects.json`.
- Redis: opcional (Upstash). Se nao configurar, cai em memoria (nao persistente).
- Banco/Prisma: opcional (apenas rotas/flows legacy, como audit logs e scripts antigos).

## Como Rodar (Setup Minimo)

1. Instale dependencias:
```bash
npm install
```

2. Configure `.env.local` (minimo recomendado):
- `JWT_SECRET` (recomendado)
- (opcional) `QASE_API_TOKEN` e/ou `QASE_API_TOKEN_<SLUG>` (ex.: `QASE_API_TOKEN_GRIAULE`)
- (opcional) `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`

3. Suba:
```bash
npm run dev
```

Abra `http://localhost:3000`.

## Autenticacao (Auth) e Sessao

Arquivos chave:
- `src/core/session/session.store.ts`: resolve sessao a partir de cookies/header.
- `app/api/auth/login/route.ts`: login e set de cookies.
- `app/api/auth/refresh/route.ts`: refresh (somente quando `JWT_SECRET` existe).
- `app/api/auth/logout/route.ts`: logout.
- `lib/jwtAuth.ts`: helper de auth usado em rotas.

### Como o token funciona (o que importa no dia a dia)

- Cookie principal: `access_token`
- Se `JWT_SECRET` existir:
  - `access_token` e um JWT
  - `refresh_token` existe e o refresh roda (rotacao via Redis)
- Se `JWT_SECRET` NAO existir:
  - o valor de `access_token` e tratado como `session_id`
  - a sessao fica em Redis (ou fallback em memoria)
  - refresh fica desativado

Cookies extras:
- `session_id`: usado no fallback sem JWT
- `active_company_slug`: guarda a empresa ativa quando o login informa `companySlug/clientSlug`

### Login (POST /api/auth/login)

Campos aceitos:
- `login` ou `user` ou `usuario` (qualquer um serve)
- `password`
- opcional: `companySlug`/`clientSlug` (define a empresa ativa no cookie)

O login valida o usuario no store local e:
- gera JWT (se `JWT_SECRET`) OU cria `session_id` (fallback)
- seta cookies httpOnly

### Permissoes

Existem dois niveis:
- Global: `globalRole: "global_admin"` (admin do sistema)
- Por empresa (membership): `company_admin` / `user` / `viewer` (+ capacidades)

Onde isso e aplicado:
- `lib/rbac/requireGlobalAdmin.ts`: guarda simples de admin global em rotas admin.
- `lib/auth/sessionBuilder.ts`: monta o payload (role/capabilities) a partir do usuario + vinculos.

## Usuarios, Empresas e Vinculos (Store Local)

Fonte de verdade (modo interno):
- `data/local-auth-store.json` (runtime; gitignored)
- fallback de seed: `data/local-auth-store.sample.json` (tracked)

Codigo:
- `src/core/auth/localStore.ts` (re-export em `lib/auth/localStore.ts`)

O store contem:
- `users[]`
- `companies[]`
- `memberships[]` (userId <-> companyId, com role/capabilities)

Observacoes praticas:
- Se `LOCAL_AUTH_IN_MEMORY=true`, o store fica em memoria (nao grava `data/local-auth-store.json`).
- Se `data/local-auth-store.json` nao existir, o sistema usa o sample e pode criar o runtime ao escrever.

### Contas seed (para QA)

As contas seedadas ficam no store local (ver `data/local-auth-store.sample.json`):
- `griaule` / `griaule123` (usuario da empresa)
- `analysyk` / `analysyk123` (usuario vinculado a `griaule`)
- `admin` / `griaule4096PD$` (global_admin)
- `bravo` / `bravo123` (company_admin em `griaule`)

## Criar Empresa

Rotas principais:
- `POST /api/clients` (admin global)
- `POST /api/company` (admin global; versao simples)

Persistencia:
- empresa e salva dentro do `data/local-auth-store.json` (junto do resto do auth store).

## Criar Usuario

Rotas principais:
- `POST /api/admin/users` (admin global)
  - aceita `password` opcional
  - se `password` vier vazio, gera uma senha temporaria e retorna `temp_password` na resposta
- `PATCH /api/admin/users` (admin global) para editar perfil/vinculo/ativo

UI:
- `app/admin/users/components/CreateUserModal.tsx` (campo de senha opcional)

Persistencia:
- usuario + membership sao gravados no store local (`data/local-auth-store.json`).

Campos extras suportados:
- `job_title`, `linkedin_url`, `avatar_url`

## Criar Runs / Defeitos Manuais (Sem Qase)

Funcionalidade: releases/runs/defeitos manuais (para o QA conseguir registrar e acompanhar sem depender de integracao).

Rotas:
- `GET/POST /api/releases-manual`
- `GET/PATCH/DELETE /api/releases-manual/[slug]`
- `GET/POST /api/releases-manual/[slug]/cases`

Persistencia:
- `data/releases-manual.json`
- `data/releases-manual-cases.json`

Observacao para E2E:
- quando `E2E_USE_JSON=1` ou `NODE_ENV=test`, os arquivos vao para `.tmp/e2e/*`.

## Defeitos Locais (API simples)

Rotas:
- `GET /api/defect?companyId=<id>&releaseManualId=<id?>`
- `POST /api/defect`

Persistencia:
- `data/defects.json`

## Notas do Usuario

Rotas:
- `GET/POST /api/notes`
- `PATCH/DELETE /api/notes/[id]`

Persistencia:
- `data/user-notes.json` (por userId)

## Solicitacoes (Acesso / Suporte)

Existem dois tipos de "solicitacao" no sistema hoje:

1) **Solicitacao de acesso (suporte)** via JSON:
- `POST /api/support/access-request`
- admin pode listar/alterar status em:
  - `GET /api/support/access-request` (admin global)
  - `PATCH /api/support/access-request/[id]`
  - `GET /api/admin/access-requests`
  - `POST /api/admin/access-requests/[id]/accept`
  - `POST /api/admin/access-requests/[id]/reject`

Persistencia:
- `data/support-requests.json`

2) **Requests internos** (email/company/password reset) via memoria:
- `POST /api/auth/reset-request` cria request do tipo `PASSWORD_RESET`
- admin lista/aprova em `/admin/requests` (rotas em `app/api/admin/requests/**`)

Persistencia:
- `data/requestsStore.ts` (em memoria; perde ao reiniciar)

## Reset de Senha (Fluxo Completo)

Fluxo:
1. Usuario pede reset:
  - UI: `/login/forgot-password`
  - API: `POST /api/auth/reset-request`
2. Admin aprova request:
  - API: `PATCH /api/admin/requests/[id]` com `status=APPROVED`
  - isso gera um token e grava em Redis: `reset:<token>` com TTL 15 min
  - envia email: em `development/test` so loga no console (`lib/email.ts`)
3. Usuario redefine:
  - UI: `/login/reset-password?token=...`
  - API: `POST /api/auth/reset-via-token` (atualiza `password_hash` no store local)

Dependencias:
- Redis (Upstash) e opcional: se nao configurar, cai em memoria e o token existe so enquanto o processo estiver vivo.

## Integracao Qase

Onde usa Qase:
- rotas `app/api/v1/*` (proxy/ETL leve)
- `app/integrations/qase.ts` (kanban, stats, etc)

Como configurar token:
- Global: `QASE_API_TOKEN` (compatibilidade com rotas legacy)
- Por empresa (recomendado para multi-tenant interno):
  - `QASE_API_TOKEN_<SLUG>` (ex.: `QASE_API_TOKEN_GRIAULE`)
  - o slug e normalizado em uppercase com `_` para separadores (ver `lib/qaseConfig.ts`)

Se token/projeto estiver ausente:
- varias telas retornam lista vazia com warning, sem travar o resto do app.

## O Que Ainda Depende De Banco (Prisma) - Legacy

Prisma existe, mas nao e requisito do modo interno.

Indicacoes de dependencia:
- `lib/prismaClient.ts` so habilita Prisma se `DATABASE_URL` (ou `POSTGRES_URL`/`POSTGRES_PRISMA_URL`) existir.
- Rotas legacy podem retornar warning/erro controlado se o banco nao existir.

Exemplo:
- `GET /api/admin/audit-logs` tenta usar storage configurado; sem DB, retorna warning.

Scripts antigos em `scripts/*.ts` podem exigir Postgres/Prisma (nao sao necessarios para o fluxo interno diario).

## Como "Resetar" Dados Rapido (QA)

Como os dados sao locais, o reset e simples:
- Apagar os JSONs em `data/` (ou `.tmp/e2e` quando E2E):
  - `data/defects.json`
  - `data/support-requests.json`
  - `data/user-notes.json`
  - `data/releases-manual.json`
  - `data/releases-manual-cases.json`
- Para resetar usuarios/empresas:
  - apagar `data/local-auth-store.json` (o sistema volta pro sample)

## Comandos Uteis

- dev: `npm run dev`
- lint: `npm run lint`
- unit: `npm test`
- e2e smoke: `npm run test:e2e:smoke`

## Onde Ler O "Codigo Verdade"

- `ARCHITECTURE.md` (premissas e mapa)
- `src/core/auth/localStore.ts` (usuarios/empresas/vinculos)
- `src/core/session/session.store.ts` (sessao e fallback)
- `lib/redis.ts` (Upstash ou memoria)
- `lib/manualReleaseStore.ts` (runs/defeitos manuais)
- `data/*Store.ts` (stores locais por JSON)
