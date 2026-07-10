# testes/api/suporte

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/suporte
```

## Arquivos e casos de teste

### `support-access.test.ts` (unit/integracao (jest))

**Describe:** supportAccess

- libera a tela para perfil empresa mesmo sem matriz carregada
- libera lider tc para o fluxo global de suporte
- mantem suporte tecnico com escopo global do kanban
- normaliza it_dev legado para suporte tecnico global
- libera admin global para o fluxo global de suporte

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/suporte/support-access.test.ts
```
