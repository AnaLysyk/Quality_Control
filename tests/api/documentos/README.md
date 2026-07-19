# testes/api/documentos

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/documentos
```

## Arquivos e casos de teste

### `company-wiki-access.test.ts` (unit/integracao (jest))

**Describe:** company wiki access

- permite leitura quando o usuario tem escopo na empresa
- permite edicao para admin da empresa mesmo sem userOrigin client_company
- permite edicao para usuario da empresa vinculado
- bloqueia edicao fora do escopo da empresa

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/documentos/company-wiki-access.test.ts
```
