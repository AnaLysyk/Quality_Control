# testes/api/rotas

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/rotas
```

## Arquivos e casos de teste

### `access-request-accept-route.test.ts` (unit/integracao (jest))

- links company_user requests to the selected company instead of creating another company

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/rotas/access-request-accept-route.test.ts
```

### `api-suportes-status-notification.test.ts` (unit/integracao (jest))

**Describe:** api/suportes/[id]/status notifications

- notifica o criador quando o suporte move o ticket pelo kanban

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/rotas/api-suportes-status-notification.test.ts
```

### `automation-page-smoke-route.test.ts` (unit/integracao (jest))

**Describe:** api/automations/qc/page-smoke

- uses the local Render port for internal page fetches
- rejects protocol-relative paths instead of fetching external hosts

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/rotas/automation-page-smoke-route.test.ts
```

### `brain-convert-route.test.ts` (unit/integracao (jest))

**Describe:** api/brain/convert

- converte texto para base64
- formata json
- converte json para csv
- gera pdf para texto executivo
- rejeita formato sem target
- retorna erro claro para conversao invalida

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/rotas/brain-convert-route.test.ts
```

### `brasilApiCnpjRoute.test.ts` (unit/integracao (jest))

**Describe:** GET /api/brasilapi/cnpj/[cnpj]

- normaliza o CNPJ e retorna o nome da empresa
- rejeita CNPJ invalido

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/rotas/brasilApiCnpjRoute.test.ts
```

### `company-routes.test.ts` (unit/integracao (jest))

**Describe:** companyRoutes

- usa rota curta para conta institucional da empresa
- usa rota curta para usuario direto da empresa
- mantem rota longa para perfis internos
- converte rota publica curta para a rota interna e vice-versa
- nao trata automacoes como slug de empresa

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/rotas/company-routes.test.ts
```

### `jira-sync.test.ts` (unit/integracao (jest))

- upserts applications for returned JIRA issues

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/rotas/jira-sync.test.ts
```

### `notification-service-access-request.test.ts` (unit/integracao (jest))

**Describe:** notificationService access request recipients

- notifica vinculados da empresa na criacao da solicitacao
- notifica vinculados da empresa em comentario
- notifica vinculados da empresa em aceite e rejeicao
- nao adiciona vinculados da empresa quando fan-out estiver desativado

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/rotas/notification-service-access-request.test.ts
```

### `notification-service-support.test.ts` (unit/integracao (jest))

**Describe:** notificationService support recipients

- notifica o criador quando o suporte comenta no ticket
- notifica usuarios vinculados da empresa em mudanca de status
- notifica usuarios vinculados da empresa em comentario
- nao adiciona vinculados da empresa quando fan-out estiver desativado

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/rotas/notification-service-support.test.ts
```

### `qase-token-mask.test.ts` (unit/integracao (jest))

**Describe:** maskQaseToken

- returns null when token is empty
- keeps only the last 4 characters visible

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/rotas/qase-token-mask.test.ts
```
