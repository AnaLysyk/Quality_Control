# testes/api/brain

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/brain
```

## Arquivos e casos de teste

### `brain-graph-layout.test.ts` (unit/integracao (jest))

**Describe:** brain graph layout filters

- keeps the connected profile flow for user/profile governance
- keeps connected project children even when child nodes do not store projectId directly

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/brain/brain-graph-layout.test.ts
```

### `brain-provider-config-runtime.test.ts` (unit/integracao (jest))

**Describe:** brain provider config runtime

- config ausente mantem fallback por env
- provider desativado nao entra na ordem de execucao
- fallback mock continua funcionando quando nao ha chave disponivel

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/brain/brain-provider-config-runtime.test.ts
```

### `brain-provider-config-security.test.ts` (unit/integracao (jest))

**Describe:** brain provider config admin security

- GET nao retorna tokens, apenas status booleano das chaves
- usuario sem permissao nao consegue alterar

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/brain/brain-provider-config-security.test.ts
```
