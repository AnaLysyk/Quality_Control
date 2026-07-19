# testes/api/empresas

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/empresas
```

## Arquivos e casos de teste

### `company-user-scope.test.ts` (unit/integracao (jest))

**Describe:** company user scope

- builds closed scope metadata for company-created users
- blocks linking a company_only user to another company
- keeps testing company users shareable by default

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/empresas/company-user-scope.test.ts
```
