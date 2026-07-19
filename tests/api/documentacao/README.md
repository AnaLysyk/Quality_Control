# testes/api/documentacao

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/documentacao
```

## Arquivos e casos de teste

### `quality-control-docs.test.ts` (unit/integracao (jest))

**Describe:** quality control official docs

- exposes manual and OpenAPI content for Testing Company
- keeps UI screenshots and project context in the company wiki
- documents critical operations in the OpenAPI spec
- detects API routes that are still undocumented
- normalizes dynamic route paths and method extraction

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/documentacao/quality-control-docs.test.ts
```
