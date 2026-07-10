# testes/bd/sessao

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/bd/sessao
```

## Arquivos e casos de teste

### `session.store.test.ts` (unit/integracao (jest))

**Describe:** session.store

- getSessionPayload reads session from redis using session cookie
- getSessionPayload decodes JWT when JWT_SECRET present and Authorization header used
- getAccessContext returns null if no session
- getAccessContext returns AccessContext when user active and linked
- getAccessContext preserves suporte tecnico mesmo com empresa ativa vinculada

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/bd/sessao/session.store.test.ts
```
