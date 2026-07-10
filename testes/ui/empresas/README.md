# testes/ui/empresas

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/empresas
```

## Arquivos e casos de teste

### `business-export-csv.spec.ts` (e2e (playwright))

- exporta relatorio CSV com dados do kanban

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/empresas/business-export-csv.spec.ts
```

### `business-export-pdf.spec.ts` (e2e (playwright))

- exporta relatorio PDF da run

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/empresas/business-export-pdf.spec.ts
```

### `business-gate-block.spec.ts` (e2e (playwright))

- quality gate falho bloqueia aprovacao de run manual

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/empresas/business-gate-block.spec.ts
```

### `persist-active-company.spec.ts` (e2e (playwright))

- empresa ativa persiste após reload

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/empresas/persist-active-company.spec.ts
```

### `switch-company.spec.ts` (e2e (playwright))

- admin seleciona empresa no dashboard global

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/empresas/switch-company.spec.ts
```
