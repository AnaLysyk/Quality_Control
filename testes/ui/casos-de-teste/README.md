# testes/ui/casos-de-teste

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/casos-de-teste
```

## Arquivos e casos de teste

### `navigation-central-cases.spec.ts` (e2e (playwright))

**Describe:** Navegação central de casos

- @case=TC-NAV-001 Sidebar Casos navega para rota canônica
- @case=TC-NAV-002 Atalho Casos do UI Studio navega para rota canônica

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/casos-de-teste/navigation-central-cases.spec.ts
```

### `test-case-automation-link.spec.ts` (e2e (playwright))

**Describe:** Automação Playwright vinculada ao caso existente

- @case=TC-AUTOMATION-LINK-${scenario.role} ${scenario.label} vincula automação sem duplicar caso

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/casos-de-teste/test-case-automation-link.spec.ts
```

### `test-cases-repository.spec.ts` (e2e (playwright))

**Describe:** Repositorio central de casos de teste

- @case=TC-CASES-001 abre o repositorio central e mostra a tela unica

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/casos-de-teste/test-cases-repository.spec.ts
```
