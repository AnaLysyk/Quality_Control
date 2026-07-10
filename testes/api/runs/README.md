# testes/api/runs

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/api/runs
```

## Arquivos e casos de teste

### `rbac-runs-api.spec.ts` (e2e (playwright))

**Describe:** rbac - runs API

- user nao consegue criar run via API
- company nao consegue deletar run via API

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/api/runs/rbac-runs-api.spec.ts
```
