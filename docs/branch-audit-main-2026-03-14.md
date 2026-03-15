# Branch Audit Snapshot

Base: `origin/main`
Generated on: `2026-03-14`

This snapshot exists so the current `main` carries a readable record of what is still outside it.

| Branch | Head | Unique commits | Flags | Hotspots |
| --- | --- | ---: | --- | --- |
| `origin/feat/upstash-integration` | `2179cbc` | 63 | `app, auth, ci, data, docs, e2e` | `app/api`, `data/companies`, `app/components` |
| `origin/feat/chamados-fixes` | `b870166` | 58 | `app, ci, data, docs, e2e` | `app/api`, `data/companies`, `app/components` |
| `origin/e2e/stabilize-tests` | `8ea3a9e` | 35 | `app, auth, ci, data, docs, e2e` | `app/api`, `app/components`, `src` |
| `origin/feature/testing-metric-finalize` | `f29aab2` | 6 | `app, auth, ci, data, docs, e2e, env` | `app/api`, `tests-e2e`, `app/components`, `src` |
| `origin/Nova` | `d3c7e5b` | 4 | `app, auth, ci, data, docs, e2e, env` | `app/api`, `tests-e2e`, `app/components`, `src` |
| `origin/fix/create-user-modal-single-client` | `359bf80` | 1 | `app, auth, data, docs, e2e, env` | `app/api`, `app/components`, `data/company-documents-files`, `app/admin` |

Why these branches were not force-merged into `main`:

- They still touch `data/`, auth/session code, CI or E2E in the same patch series.
- Some also touch env-like files or operational fixtures.
- A blind merge would bring noisy or risky changes that are not acceptable for deploy.

Latest commits per remaining remote branch:

- `origin/feat/upstash-integration`
  - `2179cbc` `fix: align support auth and force webpack dev`
  - `0fcb3a4` `fix(ts): corrige erros de tipo que quebravam o build no Render`
  - `dcf7263` `feat: ajustes UI ChatButton e correções gerais`
- `origin/feat/chamados-fixes`
  - `b870166` `fix(kanban-it): mensagem clara para erro 401 e credentials: include no fetch`
  - `b5c2222` `fix(kanban-it): endpoint correto, validação de content-type e erro limpo no loadTickets`
  - `b486bcb` `fix: remove patch code, build clean for meus-chamados/page.tsx`
- `origin/e2e/stabilize-tests`
  - `8ea3a9e` `fix: css hygiene, unify .logoEnergyPremium, clean media queries`
  - `c18e924` `fix: css syntax error, authLog privacy, rate limit, RBAC helpers`
  - `17d4c40` `fix(api): usa apenas docsUrl (remove docsLink) na criação de company`
- `origin/feature/testing-metric-finalize`
  - `f29aab2` `Ajustes`
  - `6889e0b` `ajustes`
  - `347effa` `ci: fix workflow YAML formatting`
- `origin/Nova`
  - `d3c7e5b` `fix: remove preferCSSPageSize for Vercel TypeScript build`
  - `d7c9c23` `feat: versao estavel com painel e exportacao de PDF`
  - `4ceee9e` `first commit`
- `origin/fix/create-user-modal-single-client`
  - `359bf80` `Apply adjustments`

Operational rule added on `main`:

- Before deploy or release work, run `npm run audit:branches`.
- If the report shows unique commits outside `origin/main`, do not assume the repo is consolidated.
- Only port selected patches to `main` after review or open a PR targeting `main`.
