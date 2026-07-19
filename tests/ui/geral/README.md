# testes/ui/geral

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/geral
```

## Arquivos e casos de teste

### `admin-create.spec.ts` (e2e (playwright))

- admin cria empresa e usuario

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/geral/admin-create.spec.ts
```

### `admin-ranking.spec.ts` (e2e (playwright))

- admin ve ranking de empresas

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/geral/admin-ranking.spec.ts
```

### `block-non-admin.spec.ts` (e2e (playwright))

- user não acessa /admin

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/geral/block-non-admin.spec.ts
```

### `regression-guard.spec.ts` (e2e (playwright))

- @regression-guard home renderiza
- @regression-guard dashboard operações renderiza
- @regression-guard repositório casos de teste renderiza
- @regression-guard admin users renderiza
- @regression-guard admin clients renderiza
- @regression-guard admin permissões renderiza
- @regression-guard audit logs renderiza
- @regression-guard audit-logs redirect funciona
- @regression-guard defeitos redirect funciona
- @regression-guard playwright studio renderiza
- @regression-guard api lab renderiza
- @regression-guard ferramentas automação renderiza
- @regression-guard base64 studio renderiza
- @regression-guard ui studio renderiza
- @regression-guard execuções automação renderiza
- @regression-guard arquivos automação renderiza
- @regression-guard brain/brian renderiza
- @regression-guard brain perguntar renderiza
- @regression-guard documentos renderiza
- @regression-guard repositório documentos renderiza
- @regression-guard kanban-it renderiza
- @regression-guard suporte redireciona sem loop
- @regression-guard solicitações renderiza
- @regression-guard chat renderiza
- @regression-guard planos de teste por empresa renderiza
- @regression-guard runs por empresa renderiza

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/geral/regression-guard.spec.ts
```

### `seed.spec.ts` (e2e (playwright))

**Describe:** playwright test agents seed

- seed @agent-seed

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/geral/seed.spec.ts
```
