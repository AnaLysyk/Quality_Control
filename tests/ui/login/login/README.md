# testes/ui/login/login

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/login/login
```

## Arquivos e casos de teste

### `login-real.ui.spec.ts` (e2e (playwright))

- auth: login admin and resolve /api/me from UserCompany
- auth: login user and resolve /api/me role= user
- auth: /api/me without session returns 401

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/login/login/login-real.ui.spec.ts
```

### `menu-autenticado.ui.spec.ts` (e2e (playwright))

- admin global only sees admin menu
- admin sees company menu inside company context
- client user lands in company and cannot access admin

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/login/login/menu-autenticado.ui.spec.ts
```
