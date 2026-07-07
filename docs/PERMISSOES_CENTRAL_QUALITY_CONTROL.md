# Permissoes centrais do Quality Control

Este documento define a regra oficial de permissao da plataforma Quality Control da Testing Company.

## Regra principal

As telas sao reaproveitadas entre perfis e usuarios. O que muda e o contexto de acesso:

- perfil efetivo do usuario;
- sobrescritas da Gestao de Perfil;
- sobrescritas da Gestao de Usuario;
- empresa vinculada;
- escopo da empresa;
- matriz efetiva de permissoes.

O front-end pode apenas ocultar menu, card, botao, tela e acao. A autorizacao real precisa acontecer no back-end.

## Fontes oficiais

- Catalogo de modulos e acoes: `lib/permissionCatalog.ts`.
- Catalogo de rotas visuais: `lib/navigation/route-map.ts`.
- Catalogo de menu: `lib/navigation/navigationCatalog.ts`.
- Defaults por perfil: `lib/permissions/roleDefaults.ts`.
- Sobrescritas por perfil: `lib/store/profilePermissionsStore.ts`.
- Sobrescritas por usuario: `lib/store/userPermissionsStore.ts`.
- Resolver efetivo: `lib/serverPermissionAccess.ts`.
- Guard server-side: `lib/rbac/requirePermission.ts`.

## Documentacao viva

Este documento e fonte funcional do Quality Control, nao apenas nota tecnica. Ele deve ser usado por Produto, QA, suporte, lideranca tecnica e automacoes futuras como referencia para:

- validar regra de negocio de acesso;
- escrever casos de teste e roteiros manuais;
- revisar PRs que criam telas, menus, botoes ou APIs;
- documentar excecoes de perfil, usuario e empresa;
- manter a plataforma alinhada com a matriz central de permissoes.

## Contrato tecnico

Toda tela visual deve ter uma entrada em `SYSTEM_ROUTES` com:

- `id` unico;
- `moduleId` existente em `SYSTEM_MODULES`;
- `path`;
- `requiredPermission`;
- `mainFile` existente;
- `expectedProfiles`;
- `status`.

Toda permissao usada por uma rota deve existir em `PERMISSION_MODULES`.

Toda API sensivel deve chamar `requirePermission(req, moduleId, action)` ou um guard que use o mesmo resolver oficial. Exemplos:

- listar matriz: `requirePermission(req, "permissions", "view")`;
- editar matriz: `requirePermission(req, "permissions", "edit")`;
- restaurar matriz: `requirePermission(req, "permissions", "reset")`;
- criar empresa: `requirePermission(req, "applications", "create")`;
- exportar auditoria: `requirePermission(req, "audit", "export")`;
- alterar status de chamado: `requirePermission(req, "tickets", "status")`.

## Como criar uma nova tela com permissão

1. Registrar o modulo:
   - Se o modulo ainda nao existir, adicionar uma entrada em `lib/navigation/module-map.ts`.
   - Se a permissao ainda nao existir, adicionar modulo/acoes em `lib/permissionCatalog.ts`.

2. Registrar a rota visual:
   - Adicionar a tela em `lib/navigation/route-map.ts`.
   - Definir `id` unico, `moduleId`, `path`, `mainFile`, `expectedProfiles`, `status` e `requiredPermission`.
   - `requiredPermission` nunca deve ficar nulo em rota visual sensivel.

3. Aplicar filtro no menu:
   - Vincular a tela em `lib/navigation/navigationCatalog.ts`.
   - Usar o mesmo `routeId` registrado em `SYSTEM_ROUTES`.
   - O menu so pode ocultar; ele nao substitui o bloqueio do servidor.

4. Proteger a API:
   - Toda API sensivel da tela deve chamar `requirePermission(req, moduleId, action)` ou helper equivalente que use a matriz efetiva.
   - Use permissoes diferentes para acoes diferentes: `view`, `create`, `edit`, `remove`, `export`, `approve`, `reject`, `assign`, `status`.
   - Respeite o contexto de empresa com `resolveOperationalContext`, `assertCompanyAccess` ou helper de dominio equivalente quando houver dados por empresa.

5. Adicionar teste:
   - Atualizar ou criar teste de catalogo quando a rota/menu mudar.
   - Adicionar teste de acesso permitido.
   - Adicionar teste de acesso negado com retorno 403 em chamada direta de API.
   - Quando houver empresa, testar usuario da Empresa A contra dados da Empresa B.

6. Documentar cenario manual:
   - Informar perfil usado, empresa vinculada, permissao liberada, permissao negada, URL direta e API direta.
   - Registrar evidencia de que o front ocultou e o servidor bloqueou.

## Fluxo de permissao efetiva

1. O login valida credenciais e monta sessao com identidade, contexto de empresa e `permissionRole`.
2. `/api/me` e `/api/auth/me` retornam a matriz atual resolvida.
3. O resolver combina:
   - defaults do perfil;
   - sobrescrita da Gestao de Perfil;
   - sobrescrita da Gestao de Usuario.
4. A UI usa essa matriz para esconder itens.
5. Cada endpoint sensivel valida novamente no servidor.
6. Alteracao em Gestao de Perfil invalida o cache geral de permissoes.
7. Alteracao em Gestao de Usuario invalida somente o cache daquele usuario.

## Contexto de empresa

- Usuario de empresa ve somente empresas vinculadas ou a propria empresa ativa.
- Usuario Testing Company ve somente o que o perfil e a matriz permitirem.
- Lider TC e Suporte Tecnico podem acessar contexto global somente quando a permissao efetiva permitir.
- Permissao individual de usuario nunca altera outros usuarios do mesmo perfil.

## Comportamento esperado por perfil

- Empresa: acesso administrativo da propria empresa, limitado ao escopo vinculado.
- Usuario Empresa: acesso operacional da propria empresa, com acoes reduzidas.
- Usuario Testing Company: acesso interno limitado aos modulos liberados no perfil.
- Suporte Tecnico: acesso interno amplo conforme matriz atual.
- Lider TC: acesso global e administrativo conforme matriz atual.

## Documentacao de API

Endpoints que retornam usuario autenticado:

- `GET /api/me`: fonte principal para o front obter usuario, empresas e `permissions`.
- `GET /api/auth/me`: contrato compatibilizado com `/api/me`, tambem resolvendo permissoes atuais.

Endpoints de permissao:

- `GET /api/admin/user-permissions/{userId}`: consulta permissao efetiva e override por usuario.
- `PATCH /api/admin/user-permissions/{userId}`: salva `allow` e `deny` individuais.
- `DELETE /api/admin/user-permissions/{userId}`: restaura usuario para a heranca do perfil.
- `GET/PATCH/DELETE /api/admin/users/{id}/permissions`: endpoint legado mantido por compatibilidade, usando a mesma store oficial e `requirePermission`.
- `GET/PATCH/DELETE /api/admin/profile-permissions/{role}`: consulta, altera e restaura sobrescrita de perfil.

## Matriz de cenarios de seguranca

1. Criacao de empresa:
   - Criar empresa com usuario autorizado.
   - Validar que aparece apenas para usuarios com contexto/permissao compativel.
   - Validar que usuario sem vinculo nao acessa dados dessa empresa.

2. Criacao de usuario por perfil:
   - Criar Empresa, Usuario Empresa, Usuario Testing Company, Suporte Tecnico e Lider TC.
   - Validar que cada usuario nasce com as permissoes padrao do perfil.

3. Heranca por perfil:
   - Alterar permissao na Gestao de Perfil.
   - Validar que todos daquele perfil recebem a alteracao.
   - Validar que outros perfis nao sao impactados.

4. Excecao por usuario:
   - Adicionar permissao extra para um usuario.
   - Validar que so ele ve/acessa a tela.
   - Validar que outro usuario do mesmo perfil nao recebe a permissao.

5. Remocao por usuario:
   - Aplicar `deny` individual.
   - Validar que o usuario perde acesso.
   - Validar que perfil e outros usuarios continuam acessando.

6. Bloqueio de front:
   - Validar que menu, tela, botao e card somem sem permissao.

7. Bloqueio de back-end:
   - Acessar URL direta sem permissao.
   - Chamar API sensivel via fetch/Postman sem permissao.
   - Esperar 403 e nenhum dado sensivel.

8. Contexto de empresa:
   - Usuario da Empresa A nao ve dados da Empresa B.
   - Usuario de empresa ve apenas a propria empresa.
   - Perfil global ve dados globais somente quando autorizado.

9. Cache e sessao:
   - Alterar permissao de perfil e validar invalidacao global.
   - Alterar permissao de usuario e validar invalidacao daquele usuario.
   - Validar que `/api/me` retorna matriz atualizada.

10. Nova tela:
   - Registrar a tela no `SYSTEM_ROUTES`.
   - Registrar modulo/acao em `PERMISSION_MODULES` quando necessario.
   - Ligar menu em `NAV_CATALOG`.
   - Proteger API com `requirePermission`.
   - Validar front ocultando e back retornando 403.

## Checklist manual

- Rodar `npm run typecheck`.
- Rodar `npm run guard:permissions-catalog`.
- Rodar `npm run test:permissions`.
- Entrar com usuario sem `permissions.view`.
- Confirmar que `/admin/users/permissions` e `/admin/permissions` redirecionam ou bloqueiam.
- Chamar `/api/admin/users/{id}/permissions` sem permissao e confirmar 403.
- Alterar permissao de perfil e confirmar que usuarios daquele perfil recebem a alteracao.
- Alterar permissao individual e confirmar que outro usuario do mesmo perfil nao muda.
- Aplicar `deny` individual e confirmar que o perfil original continua intacto.

## Evidencia automatizada atual

- `testes/api/geral/system-map.test.ts`: garante ids unicos, rotas de menu mapeadas, arquivo existente e permissao cadastrada.
- `testes/api/permissoes/permission-runtime.test.ts`: garante que a runtime usa a permissao declarada na rota.
- `testes/api/permissoes/permission-inheritance-overrides.test.ts`: cobre heranca de perfil, allow individual e deny individual.
- `testes/api/permissoes/admin-user-permissions-route-security.test.ts`: prova que chamada direta ao endpoint sensivel sem permissao retorna 403.
- `testes/api/permissoes/user-permissions-store-json.test.ts`: garante persistencia local de `allow`, `deny` e `updatedBy`.
- `testes/api/permissoes/sensitive-api-guard.test.ts`: varre APIs sensiveis e falha se nao houver guarda server-side explicito.
- `npm run test:permissions`: executa catalogo, sessao, matriz, heranca, excecoes e seguranca de API.
