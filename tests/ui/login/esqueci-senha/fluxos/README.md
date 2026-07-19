# testes/ui/login/esqueci-senha/fluxos

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/login/esqueci-senha/fluxos
```

## Arquivos e casos de teste

### `recuperar-senha-por-perfil.ui.spec.ts` (e2e (playwright))

**Describe:** Esqueci senha - fluxo por perfil

- ${perfil.label} recupera senha pelo fluxo atual

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/login/esqueci-senha/fluxos/recuperar-senha-por-perfil.ui.spec.ts
```

### `validacoes-publicas.ui.spec.ts` (e2e (playwright))

**Describe:** Esqueci senha - validacoes publicas

- tela publica abre sem login
- resposta nao permite enumerar e-mail cadastrado
- token invalido nao pode ser validado nem consumido

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/login/esqueci-senha/fluxos/validacoes-publicas.ui.spec.ts
```
