# Playwright visual

Este projeto usa Playwright como base de automacao E2E. Cypress fica fora do primeiro ciclo.

## Projetos de qualidade

A suite esta separada por projetos Playwright para evitar misturar smoke, acesso, runs, dashboards, IA, automacao e repositorio de casos no mesmo bloco.

| Projeto | Escopo |
| --- | --- |
| `quality-smoke` | Smoke, producao e happy path |
| `quality-access` | Login, solicitacao de acesso, perfis, usuarios e permissoes |
| `quality-test-cases` | Repositorio central de casos de teste |
| `quality-automation` | Studio/automacao Playwright |
| `quality-ai` | Brain, agentes e contexto da IA |
| `quality-runs` | Runs, defeitos, gates, releases e SLA |
| `quality-dashboards` | Dashboards, metricas e exports |
| `quality-ui` | Responsivo, menu mobile e tema |
| `quality-uncategorized` | Specs ainda nao classificadas |

```bash
npm run test:e2e:projects
npm run test:e2e:cases
npm run test:e2e:access
npm run test:e2e:runs
```

Tambem da para combinar qualquer modo visual com um projeto especifico:

```bash
npm run test:e2e:headed -- --project=quality-access
npm run test:e2e:edge -- --project=quality-test-cases
```

## Execucao local com navegador aberto

```bash
npm run test:e2e:headed
```

Esse comando abre o Chromium, aplica `slowMo` padrao e gera trace, video e screenshot.

## Execucao com Microsoft Edge

```bash
npm run test:e2e:edge
```

Requer o Edge instalado na maquina. Internamente o comando usa `PLAYWRIGHT_CHANNEL=msedge`.

## Visualizador interativo

```bash
npm run test:e2e:ui
```

Use para selecionar specs, acompanhar passos e reexecutar cenarios sem rodar a suite inteira.

## Debug passo a passo

```bash
npm run test:e2e:debug
```

Use quando precisar pausar em cada acao, inspecionar seletores e ver o que esta sendo clicado/preenchido.

## Trace viewer

```bash
npm run test:e2e:trace -- playwright-report/data/trace.zip
```

Tambem funciona com qualquer `trace.zip` gerado nos artifacts do Playwright.

## Variaveis uteis

- `PLAYWRIGHT_HEADED=1`: forca navegador visivel.
- `PLAYWRIGHT_HEADLESS=0`: alternativa para navegador visivel.
- `PLAYWRIGHT_CHANNEL=msedge`: usa Microsoft Edge.
- `PLAYWRIGHT_SLOW_MO=250`: deixa a execucao mais lenta para observacao.
- `PLAYWRIGHT_TRACE=on`: grava trace em todas as execucoes.
- `PLAYWRIGHT_VIDEO=on`: grava video em todas as execucoes.
- `PLAYWRIGHT_SCREENSHOT=on`: grava screenshots em todas as execucoes.

## Hospedagem recomendada

- Local: desenvolvimento com navegador visivel e debug.
- GitHub Actions: execucao headless com artifacts de trace/video/screenshot.
- Runner externo/self-hosted: quando os testes precisarem acessar redes ou ambientes privados.
- Repo separado: recomendado quando a suite Playwright crescer e precisar versionamento/esteira independente.
