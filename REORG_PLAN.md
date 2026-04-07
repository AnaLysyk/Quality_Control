# REORG_PLAN.md — Reorganização de Pastas

> Plano detalhado para reduzir duplicação, remover código morto e simplificar a estrutura do projeto.
> Executar em fases para manter o build funcional a cada passo.

---

## Situação atual (resumo)

| Problema | Impacto |
|---|---|
| `src/` é camada de re-exports quase toda morta | Confusão de onde vive o código real |
| `components/`, `hooks/`, `data/` duplicados no top-level e em `app/` | Import ambíguos via aliases |
| `data/backups/` e `data/versions/` com 50+ JSONs de dev | Poluição do repo |
| `demo/.env` com chave de API exposta | **RISCO DE SEGURANÇA** |
| `debug/` com artefatos descartáveis | Lixo no repo |
| 7+ markdowns temporários na raiz | Ruído |
| Scripts diagnósticos one-shot em `scripts/` | Difícil saber quais são úteis |

---

## Fase 0 — Segurança (URGENTE)

| Ação | Comando |
|---|---|
| Revogar a chave OpenAI em `demo/.env` | Manual no dashboard OpenAI |
| Deletar `demo/` | `rm -rf demo/` |
| Adicionar `demo/` ao `.gitignore` | Adicionar linha |

---

## Fase 1 — Deletar código morto (`src/`)

### 1.1 Deletar subpastas sem consumidores externos:

```
src/services/   → 0 imports fora de src/
src/stores/     → 0 imports fora de src/
src/utils/      → re-exports puros de app/utils/
```

### 1.2 Consolidar `src/types/`

- **Mover** `src/types/release.ts` (canonical) → `app/types/release.ts`
- Fazer `src/types/release.ts` virar re-export temporário (ou atualizar imports diretamente)
- `src/types/kanban.ts`, `user.ts`, `index.ts` já são re-exports → deletar
- `src/types/README.ts` → deletar

### 1.3 Consolidar `src/core/auth/`

Os componentes `RequireAuth`, `RequireGlobalAdmin`, `RequireGlobalDeveloper`, `RequireCapability`, `RequireClient` existem em **ambos**:
- `src/core/auth/Require*.tsx`
- `app/components/Require*.tsx`

→ **Manter** somente `app/components/Require*.tsx`
→ Atualizar os 1-2 imports que apontam para `@/core/auth/`

### 1.4 Mover o que sobrou de `src/lib/`

- `src/lib/store/permissionsStore.ts` → mover para `lib/store/permissionsStore.ts`
- `src/lib/permissions/roleDefaults.ts` → mover para `lib/permissions/roleDefaults.ts`
- `src/lib/store/modulesStore.ts` — verificar se é usado, se não → deletar
- `src/lib/store/redisClient.ts` — verificar se é usado, se não → deletar

### 1.5 Deletar `src/` inteiro

### 1.6 Atualizar `tsconfig.json`

Remover aliases mortos:
```diff
- "@/core/*":     ["./src/core/*"],
- "@/services/*": ["./src/services/*"],
- "@/stores/*":   ["./src/stores/*"],
+ "@/utils/*":    ["./app/utils/*"],         ← redirecionar
+ "@/types/*":    ["./app/types/*"],          ← redirecionar
```

---

## Fase 2 — Consolidar top-level duplicados

### 2.1 `hooks/` (top-level) → `app/hooks/`

| Arquivo | Ação |
|---|---|
| `hooks/useAuthUser.ts` | Re-export de `app/hooks/` → **deletar** |
| `hooks/useSWRSystemMetrics.ts` | **Mover** para `app/hooks/` |
| `hooks/useSystemMetrics.ts` | **Mover** para `app/hooks/` |

→ Deletar `hooks/` top-level
→ Remover fallback do tsconfig: `"@/hooks/*": ["./app/hooks/*"]` (sem segundo path)

### 2.2 `components/` (top-level)

| Arquivo | Ação |
|---|---|
| `CompanyIntegrationForm.tsx` | Verificar se é usado. Se órfão → **deletar** |
| `useSWRCompanyData.ts` | Mesmo check |
| `useSWRQaseProjects.ts` | Mesmo check |

→ Se algum for usado, mover para `app/components/`
→ Deletar `components/` top-level

### 2.3 `data/` (top-level) — simplificar

| Item | Ação |
|---|---|
| `data/backups/` (30 JSONs) | **Deletar** ou `.gitignore` |
| `data/versions/` (20 JSONs) | **Deletar** ou `.gitignore` |
| `data/s3/` | Verificar uso → provavelmente deletar |
| `app/data/requestsStore.ts` | Re-export de `data/requestsStore` → **inlinar** ou inverter dependência |
| `app/data/usersStore.ts` | Re-export de `data/usersStore` → **inlinar** ou inverter dependência |

→ `data/` fica como camada de persistência JSON pura, `app/data/` como API layer

---

## Fase 3 — Limpeza de artefatos

### 3.1 Deletar `debug/`

```
debug/diagnose-browser-login/ → artefatos de debugging one-time
```

### 3.2 Deletar markdowns temporários da raiz

```
PR_BODY.md
DEPLOYMENT_REPORT_dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u.md
GITHUB_ISSUE_DRAFT_DEPLOYMENT_ERROR.md
SUPPORT_TICKET_VERCEL_dpl_HU6mZ5A1mo7qrBJSsTvYdXBwvx4u.md
PULL_REQUEST_URL.md
REPORT_language_summary.md
status-report.txt
```

### 3.3 Mover markdowns de referência para `docs/`

```
RENDER_OUTBOUND_IPS.md         → docs/ops/
README-TESTING-METRIC.md       → docs/
PRS_MIGRATION_INSTRUCTIONS.md  → docs/
```

### 3.4 Limpar `scripts/` diagnósticos descartáveis

Candidatos a deletar:
```
scripts/check-thiago.mjs
scripts/dump-bytes.js
scripts/check-mobile-menu-browser-login.mjs
scripts/debug-login-dom.mjs
scripts/inspect-login-headers.mjs
scripts/diagnose-browser-login.mjs
```

### 3.5 Outros arquivos de raiz descartáveis

```
debug-admin-home.fixed.html
debug-admin-home.html
patch-griaule-qase.http
UTF8
```

---

## Fase 4 — Atualizar configurações

### 4.1 `tsconfig.json` — aliases finais

```jsonc
{
  "paths": {
    "@/components/*": ["./app/components/*"],
    "@/hooks/*":      ["./app/hooks/*"],
    "@/data/*":       ["./app/data/*", "./data/*"],
    "@/types/*":      ["./app/types/*"],
    "@/utils/*":      ["./app/utils/*"],
    "@/lib/*":        ["./lib/*"],
    "@/contracts/*":  ["./packages/contracts/src/*"],
    "@/*":            ["./app/*"]
  }
}
```

### 4.2 `.gitignore` — adicionar

```
data/backups/
data/versions/
demo/
```

---

## Estrutura final esperada

```
painel-qa/
├── app/                    ← Next.js App Router (pages, components, hooks, types, utils, data, api)
│   ├── components/         ← Todos os componentes
│   ├── hooks/              ← Todos os hooks
│   ├── types/              ← Todos os types (User, kanban, release)
│   ├── utils/              ← Helpers client-safe
│   ├── data/               ← Repository layer (auditLog, requests, users, manual)
│   ├── api/                ← API routes
│   └── ...                 ← Pages (admin/, dashboard/, etc.)
├── lib/                    ← Server-only: auth, stores, Prisma, Redis, Qase, etc.
├── data/                   ← JSON persistence files (runtime data, not source code)
├── packages/contracts/     ← Zod schemas compartilhados
├── prisma/                 ← Schema + migrations
├── scripts/                ← Build, seed, ops scripts (limpo)
├── tests/                  ← Jest unit tests
├── tests-e2e/              ← Playwright E2E tests
├── docs/                   ← Developer documentation
├── public/                 ← Static assets
├── README.md
├── ARCHITECTURE.md
├── CHECKLIST_PRODUCAO.md
└── (configs: tsconfig, next.config, eslint, tailwind, etc.)
```

---

## Ordem de execução

| # | Fase | Risco | Validação |
|---|---|---|---|
| 0 | Segurança (demo/.env) | **CRÍTICO** | Revogar chave, deletar pasta |
| 1 | Deletar `src/` + ajustar imports | Médio | `npx tsc --noEmit && npm run build` |
| 2 | Consolidar duplicados (hooks, components, data) | Médio | `npx tsc --noEmit && npm run build` |
| 3 | Limpeza de artefatos | Baixo | `git status` — só deleções |
| 4 | Atualizar tsconfig + gitignore | Baixo | `npm run build` |

> **Confirme para eu executar fase por fase, validando o build a cada passo.**
