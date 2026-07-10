# testes/bd/login/esqueci-senha/lider-tc

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/bd/login/esqueci-senha/lider-tc
```

## Arquivos e casos de teste

### `esqueci-senha-lider-tc.test.ts` (unit/integracao (jest))

- 1. usuário cria solicitação PASSWORD_RESET
- 2. solicitação está PENDING no requestsStore
- 3. Líder TC aprova a solicitação e token é gerado no Redis
- 4. usuário redefine a senha usando o token
- 5. token é invalidado após uso (não pode ser reutilizado)
- 6. Suporte Técnico (it_dev) também aprova PASSWORD_RESET

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/bd/login/esqueci-senha/lider-tc/esqueci-senha-lider-tc.test.ts
```
