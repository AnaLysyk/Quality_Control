# testes/ui/dashboard

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/dashboard
```

## Arquivos e casos de teste

### `alerts-dashboard.spec.ts` (e2e (playwright))

- dashboard mostra leitura executiva e alertas quando existem

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/dashboard/alerts-dashboard.spec.ts
```

### `business-benchmark.spec.ts` (e2e (playwright))

- admin compara metricas entre empresas

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/dashboard/business-benchmark.spec.ts
```

### `business-mttr.spec.ts` (e2e (playwright))

- mttr aparece apos fechar defeito manual no modal

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/dashboard/business-mttr.spec.ts
```

### `business-quality-gate.spec.ts` (e2e (playwright))

- quality gate reprova run com falhas

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/dashboard/business-quality-gate.spec.ts
```

### `dashboard-executive.spec.ts` (e2e (playwright))

- company loads the current dashboard shell and key summary blocks

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/dashboard/dashboard-executive.spec.ts
```

### `export-quality.spec.ts` (e2e (playwright))

- company consegue exportar CSV de qualidade

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/dashboard/export-quality.spec.ts
```

### `health-score.spec.ts` (e2e (playwright))

- health score attention aparece no dashboard

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/dashboard/health-score.spec.ts
```

### `mttr-dashboard.spec.ts` (e2e (playwright))

- dashboard exibe MTTR médio

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/dashboard/mttr-dashboard.spec.ts
```

### `mttr-manual.spec.ts` (e2e (playwright))

- MTTR é calculado ao fechar defeito manual

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/dashboard/mttr-manual.spec.ts
```

### `quality-gate-history.spec.ts` (e2e (playwright))

- histórico de quality gate é registrado

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/dashboard/quality-gate-history.spec.ts
```

### `quality-goal.spec.ts` (e2e (playwright))

- meta de qualidade mantém leitura executiva disponível

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/dashboard/quality-goal.spec.ts
```

### `quality-score.spec.ts` (e2e (playwright))

- release exibe quality score

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/dashboard/quality-score.spec.ts
```

### `quality-trend.spec.ts` (e2e (playwright))

- tendÃƒªncia improving aparece no dashboard

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/dashboard/quality-trend.spec.ts
```

### `risco-qualidade-runs.spec.ts` (e2e (playwright))

- release com risco aparece na leitura executiva

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/dashboard/risco-qualidade-runs.spec.ts
```

### `sla-dashboard.spec.ts` (e2e (playwright))

- dashboard indica defeitos e sinais de SLA

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/dashboard/sla-dashboard.spec.ts
```

### `trend-dashboard.spec.ts` (e2e (playwright))

- dashboard mostra tendÃƒªncia de MTTR

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/dashboard/trend-dashboard.spec.ts
```
