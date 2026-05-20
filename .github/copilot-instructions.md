# Copilot Instructions — painel-qa

## Regras obrigatórias dos agentes

Antes de qualquer implementação no Painel QA, leia e siga:

- `docs/agents/QA_AGENTS.md`
- `docs/architecture/QA_PLATFORM_CONTRACT.md`
- `docs/product/QA_SCREEN_FLOW.md`
- `docs/ops/CODE_CLEANUP_AUDIT.md`
- `docs/ops/REORG_PLAN.md`

Toda alteração deve passar mentalmente pelos agentes:

1. Product Flow Guardian
2. Code Cleanup Guardian
3. RBAC Guardian
4. Manual QA Flow Guardian
5. Brian Guardian
6. UI Screen Guardian
7. Build Safety Guardian

Regra principal:

Primeiro analisar, depois implementar.

Nenhum agente deve:

- criar pasta nova sem justificar;
- criar tela nova se já existir tela canônica;
- criar endpoint novo se já existir rota canônica;
- apagar arquivo sem inventário;
- alterar schema sem plano de migration;
- ignorar empresa, usuário, perfil ou permissão;
- implementar Playwright ou automação avançada nesta fase;
- misturar fluxo manual com automação sem decisão explícita;
- expor dados no Brian ou Assistente sem RBAC.

Fluxo funcional prioritário:

Flow → Caso de Teste → Step → Data Element → Plano de Teste → Execução → Resultado → Defeito → Brian → Assistente

Resumo prático para agentes:

- Arquitetura: frontend Next.js (App Router) em `app/`; backend independente em `backend/`; utilitários em `lib/` e dados em `data/`.
- Comandos úteis:
  - Dev (Windows): `npm run dev`
  - Build: `npm run build`
  - Unit tests: `npm run test` (Jest)
  - E2E: `npm run test:e2e` (Playwright). Smoke: `npm run test:e2e:smoke`
  - Lint: `npm run lint`
- Regras importantes:
  - `lib/` contém clientes e helpers server-only (ex.: `getSupabaseServer()` in `lib/supabaseServer.ts`). Importar esses módulos apenas em server components ou API routes.
  - Não vazar chaves/tokens de serviço para o cliente (service role, Qase tokens, etc.).
  - Styling: Tailwind v4 + CSS modules. Preferir CSS modules para cores dinâmicas (ex.: `app/components/StatusPill.tsx`).
  - Tests: há dois arquivos de config do Jest — escolha um (`--config`) ou remova o duplicado em CI.

Pontos de verificação (onde olhar primeiro): `package.json`, `next.config.ts`, `app/`, `lib/`, `data/`, `tests/`, `tests-e2e/`, `backend/`.

Próximo passo proposto: aplicar reorganização de pastas para reduzir duplicação e facilitar manutenção. O plano detalhado está em `docs/ops/REORG_PLAN.md`. Confirme para eu executar os movimentos e atualizar imports automaticamente.

Se quiser exemplos imediatos, posso mostrar a maneira correta de usar `getSupabaseServer()` em um API route ou script de servidor.
# Copilot Instructions for painel-qa

## Project overview
- Next.js 13+ app (App Router) written in TypeScript. UI lives under `app/`, with shared components in `app/components/`. API routes reside in `app/api/**`.
- There is a secondary `backend/` folder with NestJS-style services; keep frontend and backend changes isolated unless necessary.
- Styling uses Tailwind (v4 config) plus custom CSS modules. Prefer the canonical variable syntax in classes, e.g. `text-(--tc-text-muted)` / `bg-(--tc-accent,#ef0001)`, not `text-[var(--tc-text-muted)]`.
- Some components rely on CSS modules for dynamic colors (e.g., `StatusPill.module.css`, `StatCard.module.css`), so avoid reintroducing inline styles.

## Commands
- Dev: `npm run dev` (disables Turbopack), or `npm run dev:ci`.
- Lint: `npm run lint` (rules are relaxed: `no-explicit-any` is a warning). Expect warnings; treat failures seriously.
- Test: `npm test` (Jest). There are **two** configs (`jest.config.js` and `jest.config.ts`); pick one via `--config` or remove the unused file before running.
- E2E: `npm run test:e2e` or `npm run test:e2e:smoke` (Playwright).

## Conventions & patterns
- Tailwind: keep gradients `bg-linear-to-*`; use canonical variable forms for borders/text/bg; avoid `text-[var(--tc-text-muted)]`.
- Accessibility: hidden file inputs/buttons use `aria-label` and `title` (see `UserProfileMenu.tsx`).
- Status/metrics pills: color comes from CSS modules; pass `colorKey` (`pass|fail|blocked|notRun|total`) instead of raw colors.
- Avoid inline styles; use CSS modules or Tailwind tokens. When dynamic colors are needed, set CSS vars and apply via classes.
- API handlers in `app/api/**` currently use `any` in places; the linter only warns. Don’t escalate warning-only rules back to errors.
- React hooks: follow dependency arrays; note `AppSettingsContext` warns on dependencies—keep changes minimal unless refactoring.

## Key files to reference
- `package.json` scripts for workflows.
- `eslint.config.mjs` for rule expectations (relaxed `any`, require-imports off).
- UI patterns: `app/components/StatusPill.tsx`, `StatCard.tsx`, `Card.tsx`, `ManualReleaseActions.tsx`, `ManualStatsForm.tsx`.
- Data utilities: `data/requestsStore.ts` (mutates in-memory list; use typed error with `.code`).

## Gotchas
- Jest multiple configs cause “Multiple configurations found”; resolve before running tests.
- Many lint warnings remain (`any`, unused vars). Address only if touching those files or requested.
- Avoid reintroducing inline keyframes or color-mix without fallbacks; see `RunStatusCard.module.css` for the pattern.

## PR hygiene (apply to agent edits)
- Keep changes localized; don’t flip linter rules back to strict.
- Prefer Tailwind classes and CSS modules over inline styles.
- If adding colors/metrics, reuse existing tokens/vars (`--tc-*`) and patterns from current components.
