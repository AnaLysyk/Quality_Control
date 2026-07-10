# testes/api/contratos

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/contratos
```

## Arquivos e casos de teste

### `validar-contrato-api.test.ts` (unit/integracao (jest))

**Describe:** validarContratoApi

- aceita uma resposta compativel com o schema
- informa o caminho dos campos invalidos
- tem fallback quando o AJV nao fornece detalhes

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/contratos/validar-contrato-api.test.ts
```
