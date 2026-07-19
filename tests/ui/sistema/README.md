# testes/ui/sistema

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/sistema
```

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/ui/sistema
```

## Arquivos e casos de teste

### `dashboard-context.test.ts` (unit/integracao (jest))

**Describe:** resolveDashboardContext

- locks company scope for company users
- treats all allowed companies as the internal all selection
- keeps restricted internal users inside their permitted companies

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/ui/sistema/dashboard-context.test.ts
```

### `dashboard-contextual.test.ts` (unit/integracao (jest))

**Describe:** contextual dashboard composer

- filters by selected company, module and actionable flags
- composes comparison and risk widgets only when data supports them
- creates insights from real risk signals without inventing empty cards

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/ui/sistema/dashboard-contextual.test.ts
```

### `menu-lateral-estrutura.test.ts` (unit/integracao (jest))

**Describe:** estrutura organizada do menu lateral

- reaproveita o catalogo real como fonte da verdade
- resolve o perfil visual sem criar tela duplicada
- filtra itens pelo perfil e pelas permissoes atuais

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/ui/sistema/menu-lateral-estrutura.test.ts
```

### `menu-reorganization.spec.ts` (e2e (playwright))

**Describe:** Menu lateral por perfil

_Nenhum teste identificado automaticamente neste arquivo._

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/sistema/menu-reorganization.spec.ts
```

### `mobile-menu.spec.ts` (e2e (playwright))

- mobile menu opens on small viewport

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/sistema/mobile-menu.spec.ts
```

### `playwright-inspired-shell.spec.ts` (e2e (playwright))

**Describe:** Playwright-inspired shell

- desktop sidebar is clean, searchable and ready for local validation
- mobile menu keeps the clean shell available

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/sistema/playwright-inspired-shell.spec.ts
```

### `responsive.spec.ts` (e2e (playwright))

**Describe:** responsive layout audit - public, responsive layout audit - admin, responsive layout audit - company

- public routes @ ${viewport.label}
- admin routes @ ${viewport.label}
- company routes @ ${viewport.label}

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/sistema/responsive.spec.ts
```

### `system-map.spec.ts` (e2e (playwright))

**Describe:** Mapa do Sistema

- lista e filtra módulos, rotas e status
- remove o menu e mostra acesso negado sem permissions.view

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/sistema/system-map.spec.ts
```

### `theme-visibility.spec.ts` (e2e (playwright))

**Describe:** theme visibility - public, theme visibility - admin, theme visibility - company

- public routes @ ${theme}
- admin routes @ ${theme}
- company routes @ ${theme}

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/sistema/theme-visibility.spec.ts
```
