# QA Flow — Gestão de Perfis / Profile Management

## Objetivo

Validar se a Gestão de Perfis controla permissões por perfil e por usuário, refletindo em API, banco, menu lateral, rotas, componentes visíveis e restauração de padrões.

## Mapa técnico

- Tela principal: app/admin/users/permissions/page.tsx
- Catálogo de módulos/funções: lib/permissionCatalog.ts
- Mapa de rotas/telas: lib/navigation/route-map.ts
- Defaults por perfil: lib/permissions/roleDefaults.ts
- Store de perfil: lib/store/profilePermissionsStore.ts
- Store de usuário: lib/store/userPermissionsStore.ts
- API perfil:
  - GET /api/admin/profile-permissions/[role]
  - PATCH /api/admin/profile-permissions/[role]
  - DELETE /api/admin/profile-permissions/[role]
- API usuários do perfil:
  - GET /api/admin/profile-permissions/[role]/users
- API usuário:
  - GET /api/admin/user-permissions/[userId]
  - PATCH /api/admin/user-permissions/[userId]
  - DELETE /api/admin/user-permissions/[userId]

## Fluxo 1 — Perfil padrão

1. Acessar /admin/users/permissions
2. Selecionar Líder TC
3. Selecionar Padrão do perfil
4. Desligar applications:create
5. Salvar
6. Atualizar a tela
7. Confirmar que applications:create continua desligado
8. Restaurar padrão
9. Confirmar que voltou ao default

Resultado esperado:
- O perfil continua Líder TC.
- Apenas as permissões mudam.
- O menu e as rotas obedecem a permissão efetiva.

## Fluxo 2 — Usuário dentro do perfil

1. Selecionar um perfil
2. Escolher um usuário listado no perfil
3. Desligar applications:view
4. Salvar
5. Atualizar
6. Selecionar o mesmo usuário
7. Confirmar override individual salvo
8. Restaurar usuário
9. Confirmar que voltou ao padrão efetivo do perfil

Resultado esperado:
- O usuário não muda de perfil.
- Ele recebe allow/deny individual.
- Ao restaurar, o override individual é removido.

## Fluxo 3 — Menu lateral

1. Desligar applications:view para um usuário
2. Entrar ou simular o usuário
3. Verificar menu lateral

Resultado esperado:
- Gestão de Empresas/Listagem some.
- /admin/clients não deve abrir funcionalmente para o usuário sem permissão.

## Fluxo 4 — Criar separado de listar

1. Manter applications:view ligado
2. Desligar applications:create
3. Validar menu e rota

Resultado esperado:
- Listagem de empresas continua visível.
- Criar empresa some ou bloqueia.
- /admin/clients?modal=create aparece como oculta/bloqueada.

## Fluxo 5 — Telas visíveis e invisíveis

1. Buscar "empresa"
2. Validar:
   - Listagem de empresas
   - Buscar empresa
   - Criar empresa
3. Conferir:
   - path
   - mainFile
   - módulo
   - permissão
   - visível/oculta

Resultado esperado:
- A informação vem do route-map.
- A tela sabe onde cada rota está dentro do sistema.

## Fluxo 6 — Auditoria

1. Salvar perfil
2. Restaurar perfil
3. Salvar usuário
4. Restaurar usuário

Resultado esperado:
- profile.permissions.updated
- profile.permissions.reset
- user.permissions.updated
- user.permissions.reset

## Fluxo 7 — PT/EN

PT-BR:
- Gestão de Perfis
- Padrão do perfil
- Telas visíveis
- Restaurar usuário

EN-US:
- Profile Management
- Profile default
- Visible screens
- Restore user

Resultado esperado:
- A tela não deve ter texto hardcoded sem chave de tradução.
