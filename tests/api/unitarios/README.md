# testes/api/unitarios

Suite gerada automaticamente em 2026-07-10.

## Como rodar esta suite (Jest), todos os arquivos juntos

```powershell
npx jest --config jest.config.ts testes/api/unitarios
```

## Arquivos e casos de teste

### `accessRequestsStore.test.ts` (unit/integracao (jest))

**Describe:** accessRequestsStore

- should list access requests (empty initially if mock/memory)

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/accessRequestsStore.test.ts
```

### `adminClientAccess.test.ts` (unit/integracao (jest))

**Describe:** adminClientAccess - Controle Rígido de Ferramentas de Cliente Admin, hasAdminClientToolAccess

- deve autorizar imediatamente se flags booleanas diretas de global admin estiverem disparadas
- deve autorizar acessos usando qualquer alias legado de LEADER_TC perfeitamente e em qualquer chave de propriedade
- deve autorizar acessos usando qualquer alias legado de TECHNICAL_SUPPORT de infra/dev e em qualquer chave de propriedade
- deve BLOQUEAR estritamente usuários comuns, empresas e QAs (bypass failure)
- deve esmagar payloads inseguros, nulos, vazios e undefined (crash test)

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/adminClientAccess.test.ts
```

### `adminUserDeleteAccess.test.ts` (unit/integracao (jest))

**Describe:** adminUserDeleteAccess - Rigorous Access Control Tests, canManageInstitutionalProfiles - Permissões Administrativas Root, canDeleteUserByProfile - Regras de Deleção

- cenários VÁLIDOS: devem ser estritamente permitidos
- cenários INVÁLIDOS: devem ser estritamente bloqueados
- cenários EXTREMOS: nulls, undefines, empty objects
- Líderes TC têm poder absoluto sobre todos os perfis válidos
- Suporte Técnico pode deletar qualquer perfil
- Usuários de QA comuns (Testing Company Users) são bloqueados
- Administradores de Empresas são estritamente bloqueados
- Alvos extremanente inválidos barram a execução independente de quem pede

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/adminUserDeleteAccess.test.ts
```

### `automationCases.test.ts` (unit/integracao (jest))

**Describe:** automationCases

- should have valid export or data

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/automationCases.test.ts
```

### `automationCatalog.test.ts` (unit/integracao (jest))

**Describe:** automationCatalog

- should have valid catalog

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/automationCatalog.test.ts
```

### `brain-product-contract.test.ts` (unit/integracao (jest))

**Describe:** Brain product contract

- ranks operational dashboard from synonyms
- keeps external token permissions separate from user actions

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/brain-product-contract.test.ts
```

### `clientsRepository.test.ts` (unit/integracao (jest))

**Describe:** clientsRepository

- should list and map clients correctly

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/clientsRepository.test.ts
```

### `companyAccess.test.ts` (unit/integracao (jest))

**Describe:** companyAccess - Controles Rígidos de Isolamento de Empresa, isCompanyUser

- deve bloquear acesso sumariamente se user for nulo ou undefined
- deve reconhecer perfil explicitamente como SYSTEM_ROLES.EMPRESA (role direto)
- deve reconhecer via fallback companyRole = 'empresa' mesmo se role primário for vazio ou outro
- deve validar se company_user rigorosamente possui vínculo de ID (companyId)
- deve validar se company_user possui vínculo por slugs (via array ou metadata)
- deve rejeitar outros papéis que tentarem by-pass sem as validações estritas corporativas

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/companyAccess.test.ts
```

### `local-auth-user-uniqueness.test.ts` (unit/integracao (jest))

**Describe:** local auth user uniqueness

- rejects creating two users with the same usuario
- rejects usuario equal to another user's email
- rejects updating usuario to another user's usuario

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/local-auth-user-uniqueness.test.ts
```

### `permissionMatrix.test.ts` (unit/integracao (jest))

**Describe:** permissionMatrix - Matriz Rígida de Autorização baseada em Módulos, normalizePermissionMatrix, resolveEffectivePermissionMatrix, hasPermissionAccess, applyPermissionOverride, Scooped Views, getTicketViewScope, getUsersViewScope, toVisibilityMap

- deve rejeitar lixos (null, strings, arrays) devolvendo interface limpa {}
- deve remover arrays corrompidos, chaves não-string, e formatar strings vazias
- deve preservar apenas actions únicas evitando duplicidades
- deve retornar permissions diretos, caso existam, ignorando roles
- deve garantir matriz completa para o perfil existente leader_tc
- fallback em cascata rigidamente priorizado: permissionRole > role > companyRole > globalRole > isGlobalAdmin
- deve retornar matriz em branco caso nenhum fallback funcione
- valida match strict contra action em modulo especifico
- barra acessos nulls ou corrompidos sem falhar
- deve dar merge de allow e subtrair deny de rolesDefaults
- na colisão entre allow e deny sobre a mesma policy: subtrai (prioritário ao deny)
- retorna hierarquia rigorosa: all > company > own
- retorna hierarquia rigorosa: all > company > own
- plana matriz convertendo cada modulo pra view booelan se houver modulo.view

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/permissionMatrix.test.ts
```

### `rbacTickets.test.ts` (unit/integracao (jest))

**Describe:** rbac/tickets - Controles Rígidos do Repositório de Suporte (Tickets), Delegações Diretas (Admin & IT Dev), canManageAllTickets & canAccessGlobalTicketWorkspace, Regras da Entidade Ticket, hasTicketEnteredSupportFlow, canViewTicket, canCommentTicket & canEditTicketContent, canAssignTicket & canMoveTicket (Operacionais Puros)

- deve delegar checagens nominais para supportAccess.ts rigidamente
- bloqueia Null users e repassa validação dos globais para funções do supportAccess de workflow e scope
- reconhece entrada em fluxo se sair de 'backlog' (ex: in_progress)
- reconhece entrada em fluxo MESMO sendo 'backlog' SE já há assignee (assignedToUserId)
- diz false p/ 'backlog' limpo e null checks contra crashes
- bloqueia instaneamente caso o User não possua View Global Board permissão (canViewSupportBoard)
- libera se possuir Scope Workspace Global total da listagem (Admin/TI Operator)
- libera se NÃƒO FOR Global mas FOR dono do ticket exato (own ticket restrictio)
- comentário depende de canViewTicket AND canCommentSupportTickets (perm do modulo)
- edição pesada exige ManageSupportWorkflow ou ser o autor material do ticket via Id
- bloqueiam sumariamente falhas nulas do target ou user
- exigem explicitamente as DUAS FLAGS juntas: AccessGlobalWorkspace AND ManageWorkflow

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/rbacTickets.test.ts
```

### `requestsStore.test.ts` (unit/integracao (jest))

**Describe:** requestsStore

- should list all requests
- should list user requests
- should create a new request
- should list requests with filters

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/requestsStore.test.ts
```

### `runs.test.ts` (unit/integracao (jest))

**Describe:** rbac/runs - Matriz Permissiva para Casos de Execução, resolveRunRole, Acesso Baseado no Perfil Resolveido

- deve delegar a resolução exata para resolveDefectRole via payload recebido
- deve esmagar falhas na resolução (throws) retornando um perfil fechado de base (testing_company_user)
- canCreateRun: restrito a Leader TC ou Empresa
- canEditRun: restrito a Leader TC, Empresa e Operacional QA (Testing Company User)
- canDeleteRun: hiper-restrito apenas ao Global Admin Leader TC
- canLinkDefect: restrito a Leader TC e Empresa

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/runs.test.ts
```

### `supportAccess.test.ts` (unit/integracao (jest))

**Describe:** supportAccess - Matriz Rígida de Permissões de Suporte/Chamados, Identidades Base e Papéis de Suporte, Habilidades do Fluxo Básico do Ticket, Fluxo Avançado do Operador Global (Workspace / Workflow)

- isTechnicalSupportUser: valida sinônimos de TI/Dev
- isSupportAdminUser: requer global flag OU role leader_tc explicitly
- isSupportOperatorUser & isSupportDeveloperUser devem repassar para a base técnica (Technical Support)
- canViewSupportBoard: exige permissão tickets.view OU support.view explícita ou via Defaults
- canCreateSupportTickets: exige tickets.create OU support.create
- canCommentSupportTickets: exige tickets.comment OU support.comment
- canAccessGlobalSupportScope: proíbe acesso vertical se não for Support Operator (TI) OU se n tiver view_board
- canManageSupportWorkflow: exige ser Operator E ter permissões para assign/status

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/supportAccess.test.ts
```

### `userScopePolicy.test.ts` (unit/integracao (jest))

**Describe:** userScopePolicy - Matriz Rígida de Escopos de Usuários, resoveUserScopePolicy, Visibilidade e Criação Controlada: canViewCompanyUsersByScope & canCreateCompanyUsersByScope

- deve mapear Leader TC com escopo total (all_companies, multi-link)
- deve mapear Empresa restringindo acesso apenas à própria empresa (own_company)
- deve mapear Technical Support com acesso global, mas não-admin focado apenas em suporte
- deve cair para TESTING_COMPANY_USER como fallback rigoroso por segurança ao fornecer lixos (nulls, espaços, lixos de string)
- devem autorizar Líder TC para ambas as funções
- devem autorizar Perfis Empresa para ambas as funções
- devem bloquear bloqueio de Suporte Técnico sobre criação de usuários empresariais
- devem bloquear policies inválidas/nulas instantaneamente

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/userScopePolicy.test.ts
```

### `usersStore.test.ts` (unit/integracao (jest))

**Describe:** usersStore

- should get user by id
- should return null for non-existent user
- should update user email
- should update user company

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/usersStore.test.ts
```

### `validateCompanyAccess.test.ts` (unit/integracao (jest))

**Describe:** validateCompanyAccess - Matriz Rígida de Isolamento Multitenant (Empresa), requireCompanyIdPresent, assertCompanyAccess

- deve lançar MISSING_COMPANY_ID para lixos (null, undefined, string vazia)
- deve passar livremente se for string com conteúdo
- deve bloquear sumariamente user inválido e companyId inexistente
- deve BYPASS global admins (Leader TC, Support) pois acessam visões root e modules cross-company
- deve PERMITIR company users e empresa STRICTLY aprentando exatamente o seu companyId base
- deve REJEITAR company users e empresa tentando acessar o tenant de outra empresa
- deve PERMITIR testing_company_user acessar tenant se for sua base direta (companyId user payload)
- deve PERMITIR testing_company_user acessar tenant externo APENAS SE existir Link Mapeado no Store
- deve REJEITAR testing_company_user tentar tenant externo se não houver Link Mapeado

Rodar só este arquivo (isolado):
```powershell
npx jest --config jest.config.ts testes/api/unitarios/validateCompanyAccess.test.ts
```
