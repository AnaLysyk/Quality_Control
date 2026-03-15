# Recuperacao e consolidacao na main

Status em 2026-03-14:

- A `main` e a unica branch de deploy e contem as integracoes mais recentes ja levadas do fluxo `integracao-upstash`.
- Ainda existem branches com patches fora da `main`. Elas nao devem ser apagadas antes de uma revisao tecnica, porque algumas contem trabalho real misturado com commits de sync, backup e debug.
- Os stashes locais foram arquivados nesta mesma branch em `docs/recovery/` para que deixem de existir apenas no computador local.
- Branches sem patch exclusivo em relacao a `main` podem ser removidas para reduzir ruido operacional.
- Antes de deploy ou release, rode `npm run audit:branches`.
- O snapshot mais recente da auditoria de branches foi salvo em `docs/branch-audit-main-2026-03-14.md`.
- O inventario detalhado por branch remota fica em `docs/branch-inventory/` e pode ser regenerado com `npm run inventory:branches`.

Branches com trabalho ainda fora da `main`:

- `origin/feat/upstash-integration` - head `2179cbc` - `63` patches exclusivos
- `origin/feat/chamados-fixes` - head `b870166` - `58` patches exclusivos
- `origin/e2e/stabilize-tests` - head `8ea3a9e` - `35` patches exclusivos
- `origin/feature/testing-metric-finalize` - head `f29aab2` - `6` patches exclusivos
- `origin/fix/create-user-modal-single-client` - head `359bf80` - `1` patch exclusivo
- `origin/Nova` - head `d3c7e5b` - `4` patches exclusivos
- branches locais de backup:
  - `backup-antes-de-voltar` - head `d58f87b` - `61` patches exclusivos
  - `backup-main-20260210224133` - head `a0f57da` - `3` patches exclusivos
  - `refactor/arquitetura-base` - head `d58f87b` - `61` patches exclusivos
  - `versao-dia-13` - head `7d773a7` - `14` patches exclusivos

Branches ja equivalentes a `main` em termos de patch:

- remotas: `origin/chore/accessibility-lint-fixes`, `origin/chore/remove-prisma-backendclient`, `origin/feature/ajuste`, `origin/feature/ajuste-sidebar`, `origin/i18n/translate-to-pt`, `origin/pr/salvar-mudancas-2026-02-11`
- locais: `backup-antes-de-voltar-20260313`, `chore/accessibility-lint-fixes`, `chore/remove-prisma-backendclient`, `feature/ajuste`, `feature/ajuste-sidebar`, `i18n/translate-to-pt`, `pr/salvar-mudancas-2026-02-11`

Observacoes:

- `integracao-upstash` ja foi absorvida na `main`.
- `feat/upstash-integration` e `feat/chamados-fixes` ainda mostram muitos patches fora da `main`; nao e seguro fazer merge cego.
- Parte dos commits fora da `main` mexe em E2E, logs, backups e dados de suporte. Isso precisa de triagem antes de entrar no fluxo principal.
- O cherry-pick direto de `359bf80` (`fix/create-user-modal-single-client`) foi abortado porque ele tenta reintroduzir fluxo antigo de autenticacao/cookies em arquivos que hoje estao mais novos na `main`.
- A auditoria atual mostra que as branches restantes ainda tocam `data/`, auth/session, CI ou E2E. Por isso nao e seguro absorver tudo na `main` via merge cego ou merge `-s ours` sem revisao.
- Trechos seguros ja portados manualmente para a `main`:
  - melhoria de erro/autenticacao no `app/kanban-it/page.tsx`
  - ajustes de acessibilidade no `app/components/CreateManualReleaseButton.tsx`
  - ampliacao do tipo `role` em `data/usersStore.ts` para aceitar `global_admin`

Commits exclusivos pequenos e mapeados:

- `origin/feature/testing-metric-finalize`
  - `f29aab2` Ajustes
  - `6889e0b` ajustes
  - `347effa` ci: fix workflow YAML formatting
  - `a09d3f7` test: make supabaseServer import tolerant to mocked module shape
  - `537134b` ci: add GitHub Actions workflow for tests
  - `b1b4ab1` testing-metric: add .env.local and docs for running mock backend
- `origin/fix/create-user-modal-single-client`
  - `359bf80` Apply adjustments
- `origin/Nova`
  - `d3c7e5b` fix: remove preferCSSPageSize for Vercel TypeScript build
  - `d7c9c23` feat: versao estavel com painel e exportacao de PDF
  - `4ceee9e` first commit
  - `996f4dc` Initial commit from Create Next App

Stashes locais arquivados na `main`:

- `docs/recovery/stash-0-tsconfig.patch`
- `docs/recovery/stash-1-company-metrics.patch`
- `docs/recovery/stash-2-login.patch`

Resumo dos stashes:

- `stash@{0}`: ajuste pequeno em `tsconfig.json` para incluir tipos de `.next/types`.
- `stash@{1}`: ajuste visual em `CompanyMetricsCard.tsx` para selo de data e botao de PDF.
- `stash@{2}`: variacao antiga da tela de login em `LoginClient.tsx` e `LoginClient.module.css`.

Politica daqui para frente:

- Alteracao importante deve virar commit na `main` ou PR com destino na `main`.
- Nada critico deve ficar so em `stash`.
- Arquivos locais e sensiveis ficam fora do Git via `.gitignore`.
