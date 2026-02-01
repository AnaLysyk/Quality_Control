# Qase API – mapa mestre (v1 + extras)

Referência única para produto e integração. Este documento segue o modo como o repositório consome a Qase.

## Base e autenticação

- Base: `https://api.qase.io/v1`
- Autenticação (apenas no backend):
  - Cabeçalho `Token: QASE_API_TOKEN`
- JSON enviado com `Content-Type: application/json`
- Nunca exponha o token no navegador; use chamadas server-only ou rotas de API.

Notas do repositório:
- SDK interno: `lib/qaseSdk.ts` (envia o header `Token` por padrão).
- Integração de servidor: rotas `app/api/*` e utilitários em `lib/qaseConfig.ts` e `lib/qaseRuns.ts`.

## Arquitetura do produto (camadas)

1. Camada BFF (app/api)
   - O front chama rotas `/api/*`.
   - O backend se comunica com a Qase, normaliza payloads, trata cache, retry e rate limit.
2. Modelo de dados (raw vs derivado)
   - Raw: `qase_projects`, `qase_suites`, `qase_cases_raw`, `qase_runs`, `qase_run_cases_raw`, `qase_results_raw`.
   - Derivado: `kanban_cases`, `run_metrics`, `releases`, `release_runs`.
   - ETL completo em SQL: `docs/qase_etl.sql`.
3. Fluxo consolidado
   - Sincroniza projetos → suítes → casos (raw).
   - Executa ETL para popular kanban e métricas.
   - Cria um run quando o pipeline inicia ou uma release abre.
   - Cada `afterEach` do Playwright envia os resultados.
   - O dashboard lê métricas em tempo real.

## Endpoints por domínio (v1)

### Projects
- `GET /project`: lista projetos
- `GET /project/{code}`: detalhes de um projeto

### Runs
- `GET /run/{id}`: detalhes de um run
- `GET /run/{id}/case`: casos de um run específico
- `GET /run/{code}`: pesquisa por código (fallback)

### Cases
- `GET /case/{id}`: detalhes do caso
- `GET /case/{id}/result`: resultados associados

> Use o header `Token` em todas as chamadas e trate erros de rate limit com retries exponenciais.
