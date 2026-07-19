# testes/api/integracao

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/integracao
```

## Arquivos e casos de teste

### `clients-patch-qase.test.ts` (unit/integracao (jest))

**Describe:** Clients PATCH Qase semantics

- clears projects when PATCH sends empty qase_project_codes array
- accepts legacy qase_project_code for backward compatibility

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/integracao/clients-patch-qase.test.ts
```

### `company-integrations.test.ts` (unit/integracao (jest))

**Describe:** Company integrations persistence

- creates a company with Qase and Jira integrations
- finds integrations saved in the database

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/integracao/company-integrations.test.ts
```

### `qase-persistence.test.ts` (unit/integracao (jest))

**Describe:** Qase persistence integration

- creates applications when client is created with qase project codes

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/integracao/qase-persistence.test.ts
```
