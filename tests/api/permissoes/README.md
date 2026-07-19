# testes/api/permissoes

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/permissoes
```

## Arquivos e casos de teste

### `admin-user-permissions-route-security.test.ts` (unit/integracao (jest))

**Describe:** admin user permissions API security

_Nenhum teste identificado automaticamente neste arquivo._

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/permissoes/admin-user-permissions-route-security.test.ts
```

### `gestao-permissoes.test.ts` (unit/integracao (jest))

- A1. releases: view permitido; escrita bloqueada
- A2. runs: view permitido; escrita/export bloqueados
- A3. defects: view permitido; escrita bloqueada
- A4. users: view/create por empresa; edit/delete globais bloqueados
- A5. permissions: view/edit/reset/clone todos bloqueados
- A6. audit: view/export bloqueados
- A7. access_requests: view bloqueado
- A8. tickets: ações privilegiadas bloqueadas (edit/delete/assign/status/view_all/view_company)
- A9. notes: edit/delete bloqueados (view/create permitidos)
- B1. users: view/create liberados; edit/delete bloqueados
- B1b. company_user também pode ver e criar usuários
- B2. permissions: view/edit/reset/clone todos bloqueados
- B3. access_requests: view/comment/approve/reject todos bloqueados
- B4. audit: view/export bloqueados
- B5. releases: apenas view (create/edit/delete bloqueados)
- B6. runs: apenas view (create/edit/delete/export bloqueados)
- B7. defects: apenas view (create/edit/delete bloqueados)
- B8. applications: delete/export bloqueados (view/create/edit permitidos)
- B9. tickets: ações privilegiadas bloqueadas (edit/delete/assign/status/view_all/view_company)
- B10. notes: edit/delete bloqueados (view/create permitidos)
- C1. applications: mesma visão do lider_tc
- C2. releases: view permitido
- C3. runs: view permitido
- C4. defects: view permitido
- C5. notes: view/create permitidos
- C6. settings: view permitido (edit bloqueado)
- C7. audit: view permitido (adicionado ao perfil support)
- C8. permissions: somente view (sem edit)
- C9. support possui tickets/suporte com permissões corretas + view_all
- C10. support v\u00ea access_requests mas n\u00e3o pode aprovar/rejeitar
- C11. users: somente view (sem create/edit)
- D1. effectivePermissions com deny remove ação disponível do leader_tc
- D2. effectivePermissions com allow adiciona ação ao 'user'
- D3. deny não afeta outros módulos
- D4. applyPermissionOverride: deny remove, allow adiciona na mesma chamada
- D5. effectivePermissions múltiplos deny no mesmo módulo
- D6. toVisibilityMap retorna false para módulos sem view
- D7. getTicketViewScope retorna 'own' para perfil user
- D8. getTicketViewScope retorna 'all' para suporte tecnico
- E1. Usuário viewer legado → permissionRole 'testing_company_user'
- E2. Membership company_admin legado → permissionRole 'empresa'
- E3. Membership it_dev legado → permissionRole 'technical_support'
- E4. Usuário global_admin legado → permissionRole 'leader_tc'
- E5. Sem links e sem role → permissionRole 'testing_company_user'
- E6. it_dev legado tem precedência sobre company_admin legado
- E7. company_admin legado tem precedência sobre viewer legado
- F1. Usuário viewer/TC → roleKey='testing_company_user', operação visível por empresa
- F2. Usuário company_admin → roleKey='company', users liberados e permissões/audit bloqueados
- F3. Usuário it_dev → roleKey='technical_support', mesma visão lider_tc + tickets view_all
- F4. Usuário global_admin → roleKey='admin', permissões completas

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/permissoes/gestao-permissoes.test.ts
```

### `permission-inheritance-overrides.test.ts` (unit/integracao (jest))

**Describe:** heranca e excecoes da matriz central de permissoes

- aplica sobrescrita de perfil para todos os usuarios daquele perfil
- mantem permissao extra isolada no usuario que recebeu allow individual
- remove acesso via deny individual sem alterar o perfil nem outros usuarios

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/permissoes/permission-inheritance-overrides.test.ts
```

### `permission-runtime.test.ts` (unit/integracao (jest))

**Describe:** runtime central de permissoes

- resolve os defaults do perfil sem espalhar regra na tela
- mapeia usuario global legado para Lider TC sem ignorar matriz efetiva
- trata a matriz efetiva vazia como override autoritativo
- aceita escopos de leitura como acesso de visualizacao
- usa a permissao declarada na rota para liberar ou bloquear

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/permissoes/permission-runtime.test.ts
```

### `permissionMatrix-effective.test.ts` (unit/integracao (jest))

**Describe:** resolveEffectivePermissionMatrix

- falls back to role defaults when the matrix is empty
- keeps explicit permissions when the matrix already has actions
- resolves full permissions for the existing leader_tc profile

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/permissoes/permissionMatrix-effective.test.ts
```

### `sensitive-api-guard.test.ts` (unit/integracao (jest))

**Describe:** sensitive API server-side guards

- mantem endpoints sensiveis com validacao server-side explicita

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/permissoes/sensitive-api-guard.test.ts
```

### `user-permissions-store-json.test.ts` (unit/integracao (jest))

**Describe:** userPermissionsStore JSON fallback

- persiste allow/deny locais para o resolver oficial ler depois

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/permissoes/user-permissions-store-json.test.ts
```
