# testes/api/automacoes

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/automacoes
```

## Arquivos e casos de teste

### `automation-access.test.ts` (unit/integracao (jest))

**Describe:** resolveAutomationAccess, resolveAutomationAllowedCompanySlugs

- libera configuração para líder TC
- mantém usuário TC na mesma tela, porém sem configuração global
- libera empresa apenas no próprio escopo
- mantém usuário da empresa com a mesma visão da empresa
- combina slugs sem duplicar

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/automacoes/automation-access.test.ts
```
