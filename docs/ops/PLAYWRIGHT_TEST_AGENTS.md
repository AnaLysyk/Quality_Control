# Playwright Test Agents no painel-qa

Status: ativo
Data: 2026-05-09

## O que foi inicializado

Arquivos gerados via `npx playwright init-agents --loop=vscode`:

- `.github/agents/playwright-test-planner.agent.md`
- `.github/agents/playwright-test-generator.agent.md`
- `.github/agents/playwright-test-healer.agent.md`
- `.vscode/mcp.json`
- `specs/README.md`
- `tests-e2e/seed.spec.ts`

## Pré-requisitos

- VS Code v1.105+ para experiência agentic completa.
- Node + Playwright instalados no projeto.
- MCP habilitado no GitHub Copilot com o servidor `playwright-test`.

Config MCP esperada (já incluída em `.vscode/mcp.json`):

```json
{
  "mcpServers": {
    "playwright-test": {
      "type": "stdio",
      "command": "npx",
      "args": ["playwright", "run-test-mcp-server"],
      "tools": ["*"]
    }
  }
}
```

## Fluxo recomendado

1. Planner
- Objetivo: gerar plano em `specs/*.md`.
- Entrada mínima: pedido claro + `tests-e2e/seed.spec.ts`.

Prompt exemplo:
- "Use `tests-e2e/seed.spec.ts` e gere plano para fluxo de criação de run com plano manual e validação de status em `specs/runs-basic-operations.md`."

2. Generator
- Objetivo: transformar plano em specs executáveis.
- Saída esperada: arquivos em `tests-e2e/` seguindo convenções locais.

Prompt exemplo:
- "Gere testes Playwright a partir de `specs/runs-basic-operations.md` em `tests-e2e/` com tags `@case` e seletores por `data-testid` quando possível."

3. Healer
- Objetivo: reparar falhas reais de execução.
- Entrada: arquivo de teste com falha e mensagem de erro.

Prompt exemplo:
- "Heal `tests-e2e/runs-quality.spec.ts` após falha de locator no botão de salvar run."

## Convenções deste repositório

- Diretório de testes E2E: `tests-e2e/`
- Seed oficial dos agentes: `tests-e2e/seed.spec.ts`
- Projetos segmentados: `playwright.projects.ts`
- Config principal: `playwright.config.ts`
- Autenticação mock para E2E: `tests-e2e/helpers/mockAuth.ts`

## Comandos úteis

- Inicializar/atualizar agentes:
  - `npx playwright init-agents --loop=vscode`
- Executar suite completa:
  - `npm run test:e2e`
- Executar suites específicas já existentes:
  - `npm run test:e2e:cases`
  - `npm run test:e2e:runs`
  - `npm run test:e2e:automation-link`
  - `npm run test:e2e:profile-cycle`
- Debug local com um worker:
  - `npx playwright test --workers=1 --project=chromium --debug`

## Observações

- Sempre regenerar agentes após upgrade do Playwright para receber novas tools/instruções.
- Preferir specs com IDs/rastreabilidade (`@case=...`) para facilitar integração com run/report.
- Em caso de healer loop, limitar escopo por arquivo e cenário para evitar mudanças amplas.