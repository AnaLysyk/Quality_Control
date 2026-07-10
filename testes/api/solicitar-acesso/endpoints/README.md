# testes/api/solicitar-acesso/endpoints

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/api/solicitar-acesso/endpoints
```

## Arquivos e casos de teste

### `endpoints-publicos.api.spec.ts` (e2e (playwright))

- consulta publica rejeita chave inexistente sem expor erro interno
- listagem administrativa exige autenticacao

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/api/solicitar-acesso/endpoints/endpoints-publicos.api.spec.ts
```
