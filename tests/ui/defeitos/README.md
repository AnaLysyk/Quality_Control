# testes/ui/defeitos

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite E2E (Playwright), todos os arquivos juntos

```powershell
npx playwright test testes/ui/defeitos
```

## Arquivos e casos de teste

### `business-run-defect.spec.ts` (e2e (playwright))

- empresa cria run e defeito com vinculo basico

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/defeitos/business-run-defect.spec.ts
```

### `defect-create.spec.ts` (e2e (playwright))

**Describe:** defeitos - criação manual

- user cria defeito na empresa ativa

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/defeitos/defect-create.spec.ts
```

### `defect-link-run.spec.ts` (e2e (playwright))

- vincula defeito manual a uma run

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/defeitos/defect-link-run.spec.ts
```

### `defect-permissions.spec.ts` (e2e (playwright))

**Describe:** defeitos - permissÃƒµes

- user não vÃƒª botão de edição de defeito manual
- admin acessa página de defeitos

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/defeitos/defect-permissions.spec.ts
```

### `defects-list.spec.ts` (e2e (playwright))

**Describe:** defeitos - listagem por empresa ativa

- user vÃƒª página e lista de defeitos na empresa ativa

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/defeitos/defects-list.spec.ts
```

### `kanban-move.spec.ts` (e2e (playwright))

**Describe:** kanban - movimentação

- admin move card para outra coluna

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/defeitos/kanban-move.spec.ts
```

### `kanban-permission.spec.ts` (e2e (playwright))

**Describe:** kanban - permissão

- user não vÃƒª controles de movimentação

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/defeitos/kanban-permission.spec.ts
```

### `kanban-persist.spec.ts` (e2e (playwright))

**Describe:** kanban - persistÃƒªncia local

- status persiste após reload

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/defeitos/kanban-persist.spec.ts
```

### `kanban-view.spec.ts` (e2e (playwright))

**Describe:** kanban - visualização

- user vÃƒª colunas do kanban

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/defeitos/kanban-view.spec.ts
```

### `rbac-defects.spec.ts` (e2e (playwright))

**Describe:** rbac - defeitos

- user não vÃƒª açÃƒµes protegidas
- company vÃƒª editar/link em defeito manual, mas não delete
- admin vÃƒª todas as açÃƒµes

Rodar só este arquivo (isolado):
```powershell
npx playwright test testes/ui/defeitos/rbac-defects.spec.ts
```
