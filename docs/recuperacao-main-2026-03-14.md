# Recuperacao e consolidacao na main

Status em 2026-03-14:

- A `main` e a unica branch de deploy e contem as integracoes mais recentes ja levadas do fluxo `integracao-upstash`.
- Ainda existem branches com patches fora da `main`. Elas nao devem ser apagadas antes de uma revisao tecnica, porque algumas contem trabalho real misturado com commits de sync, backup e debug.
- Os stashes locais foram arquivados nesta mesma branch em `docs/recovery/` para que deixem de existir apenas no computador local.

Branches com trabalho ainda fora da `main`:

- `origin/feat/upstash-integration`
- `origin/feat/chamados-fixes`
- `origin/e2e/stabilize-tests`
- `origin/feature/testing-metric-finalize`
- `origin/fix/create-user-modal-single-client`
- `origin/Nova`
- branches locais de backup: `backup-antes-de-voltar`, `backup-main-20260210224133`, `refactor/arquitetura-base`, `versao-dia-13`

Observacoes:

- `integracao-upstash` ja foi absorvida na `main`.
- `feat/upstash-integration` e `feat/chamados-fixes` ainda mostram muitos patches fora da `main`; nao e seguro fazer merge cego.
- Parte dos commits fora da `main` mexe em E2E, logs, backups e dados de suporte. Isso precisa de triagem antes de entrar no fluxo principal.

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

