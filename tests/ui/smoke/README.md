# testes/ui/smoke

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/smoke
```

## Arquivos e casos de teste

### `happy-path.spec.ts` (e2e (playwright))

**Describe:** happy path mocks

- admin é redirecionado para /admin
- company vai para /empresas/[slug]/home
- user vai para /user/home

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/smoke/happy-path.spec.ts
```

### `prod-smoke.spec.ts` (e2e (playwright))

**Describe:** Prod smoke

- login and dashboard loads

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/smoke/prod-smoke.spec.ts
```

### `smoke.spec.ts` (e2e (playwright))

- @smoke login and load clientes
- @smoke perfil suporte - rotas criticas carregam sem erro fatal

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/smoke/smoke.spec.ts
```
