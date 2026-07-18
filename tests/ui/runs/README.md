# testes/ui/runs

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/runs
```

## Arquivos e casos de teste

### `exportar-runs.spec.ts` (e2e (playwright))

- admin consegue exportar run

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/runs/exportar-runs.spec.ts
```

### `linha-tempo-runs.spec.ts` (e2e (playwright))

- timeline de quality gate aparece na run

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/runs/linha-tempo-runs.spec.ts
```

### `rbac-runs.spec.ts` (e2e (playwright))

**Describe:** rbac - runs UI

- usuario da empresa nao ve botao de criar run
- empresa ve botao de criar run
- empresa nao ve deletar run
- admin acessa repositorio de runs da empresa

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/runs/rbac-runs.spec.ts
```

### `risco-por-run.spec.ts` (e2e (playwright))

- run falha aparece como risco no dashboard

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/runs/risco-por-run.spec.ts
```

### `run-drilldown.spec.ts` (e2e (playwright))

**Describe:** drill-down de run

- exibe link da base detalhada para o detalhe da run

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/runs/run-drilldown.spec.ts
```

### `runs-list.spec.ts` (e2e (playwright))

**Describe:** runs - lista

- user vÃƒª runs da empresa ativa

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/runs/runs-list.spec.ts
```

### `runs-quality.spec.ts` (e2e (playwright))

- dashboard mostra qualidade por run

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/runs/runs-quality.spec.ts
```

### `runs-search.spec.ts` (e2e (playwright))

**Describe:** runs - busca

- user filtra runs pela busca

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/runs/runs-search.spec.ts
```
