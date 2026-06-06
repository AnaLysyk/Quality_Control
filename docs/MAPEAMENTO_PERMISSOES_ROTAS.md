# Mapeamento inicial — Permissões, rotas e navegação

## Objetivo

Mapear onde estão hoje as regras de permissões, perfis, rotas e navegação antes de mover qualquer arquivo.

## Arquivos/pastas candidatos

### Permissões e RBAC

- lib/permissions
- lib/rbac
- lib/core/auth
- lib/auth
- tests/system-roles.test.ts

### Navegação e rotas

- lib/navigation
- lib/companyRoutes.ts
- app/admin
- app/dashboard
- app/empresas
- app/profile
- app/settings

## Direção provável

Permissões devem ir para:

src/features/permissoes/

Rotas e navegação devem ir para:

src/config/
src/shared/

Autenticação deve ir depois para:

src/features/autenticacao/

## Regra para mover

Não mover arquivo sem antes saber:

- quem importa
- quem usa
- se é regra de negócio
- se é componente visual
- se é configuração
- se é reutilizável

## Arquivos encontrados no mapeamento real

### Permissões / RBAC / Autenticação

- lib/permissions/checkPermission.ts
- lib/permissions/roleDefaults.ts
- lib/rbac/companyAccess.ts
- lib/rbac/defects.ts
- lib/rbac/devAccess.ts
- lib/rbac/requireAccessRequestReviewer.ts
- lib/rbac/requireGlobalAdmin.ts
- lib/rbac/runs.ts
- lib/rbac/suportes.ts
- lib/rbac/tickets.ts
- lib/rbac/validateCompanyAccess.ts
- lib/auth/roles.ts
- lib/auth/specialAccess.ts
- lib/core/auth/RequireAuth.tsx
- lib/core/auth/RequireCapability.tsx
- lib/core/auth/RequireGlobalAdmin.tsx
- lib/core/auth/RequireGlobalSupportOperator.tsx

### Navegação

- lib/navigation/favoritesTypes.ts
- lib/navigation/navigationCatalog.ts
- lib/navigation/navigationContext.ts
- lib/navigation/navigationPermissions.ts
- lib/companyRoutes.ts

### Telas e rotas relacionadas

- app/admin
- app/api/admin
- app/dashboard
- app/empresas
- app/profile
- app/settings
- app/components/profile
- app/components/RequireGlobalAdmin.tsx

## Decisão inicial

Antes de mover arquivos, vamos separar por responsabilidade:

1. permissões puras
2. guardas de acesso
3. autenticação/session
4. navegação/catálogo de rotas
5. telas que apenas consomem essas regras

A primeira movimentação segura deve começar por arquivos de permissão/configuração, não por páginas grandes.
