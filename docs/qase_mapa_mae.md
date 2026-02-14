# Qase API – mapa mestre (v1 + extras)

Referência central para integração e produto, conforme o consumo do repositório.

## Base e autenticação
- Base: `https://api.qase.io/v1`
- Autenticação (backend): cabeçalho `Token: QASE_API_TOKEN`
- JSON enviado com `Content-Type: application/json`
- Nunca exponha o token no navegador; use chamadas server-only ou rotas de API

Notas do repositório:
- SDK interno: `lib/qaseSdk.ts` (header `Token` por padrão)
- Integração servidor: rotas `app/api/*`, utilitários em `lib/qaseConfig.ts` e `lib/qaseRuns.ts`

## Arquitetura do produto (camadas)
1. **BFF (app/api)**: front chama `/api/*`, backend comunica com Qase, normaliza payloads, trata cache, retry e rate limit
2. **Modelo de dados**:
   - Raw: `qase_projects`, `qase_suites`, `qase_cases_raw`, `qase_runs`, `qase_run_cases_raw`, `qase_results_raw`
   - Derivado: `kanban_cases`, `run_metrics`, `releases`, `release_runs`
   - ETL completo em SQL: `docs/qase_etl.sql`
3. **Fluxo consolidado**:
   - Sincroniza projetos → suítes → casos (raw)
   - Executa ETL para popular kanban e métricas
   - Cria run ao iniciar pipeline ou abrir release
   - Cada `afterEach` do Playwright envia resultados
   - Dashboard lê métricas em tempo real

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

> Use sempre o header `Token` e trate erros de rate limit com retries exponenciais.
