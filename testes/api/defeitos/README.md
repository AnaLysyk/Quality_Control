# testes/api/defeitos

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/api/defeitos
```

## Arquivos e casos de teste

### `rbac-defects-api.spec.ts` (e2e (playwright))

**Describe:** rbac - api defeitos manuais

- company não consegue deletar defeito manual via API (403)

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/api/defeitos/rbac-defects-api.spec.ts
```
