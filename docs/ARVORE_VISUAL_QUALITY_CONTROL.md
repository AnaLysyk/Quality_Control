# Arvore visual do Quality Control

## Regra principal

O sistema tem uma estrutura unica.

As telas nao devem ser duplicadas por perfil.

O menu lateral e a referencia principal do front-end. Cada perfil apenas filtra:

- quais modulos aparecem no menu;
- quais telas podem ser acessadas;
- quais acoes podem ser executadas;
- qual contexto de empresa/usuario sera usado dentro da mesma tela.

Nada deve ser apagado ou movido sem antes mapear uso, importacoes e testes.

## Fonte da verdade atual

Hoje a navegacao ja tem um centro importante:

- Catalogo do menu: `lib/navigation/navigationCatalog.ts`
- Filtro por perfil/permissao: `lib/navigation/navigationPermissions.ts`
- Hook consumido pelo shell: `app/hooks/navigation/useNavigationItems.ts`
- Shell principal: `app/components/AppShell.tsx`
- Sidebar: `app/components/Sidebar.tsx`
- Pecas do sidebar: `app/components/navigation/*`
- Guardas de acesso: `lib/core/auth/*`
- RBAC/API: `lib/rbac/*` e `lib/permissions/*`

Essa e a base que deve guiar a reorganizacao. O `app/` continua sendo rota do Next.js.

## Front-end visto pelo menu lateral

Esta arvore representa o front-end do jeito que a pessoa ve o sistema: pelo menu lateral.

```text
FRONT-END
app/
  home/
    page.tsx
    HomeContent.tsx

  admin/
    clients/                 -> Empresas / Listagem
    users/                   -> Gestao de usuarios
    permissoes/              -> Admin / Permissoes
    access-requests/         -> Solicitacoes de acesso
    audit-logs/              -> Admin / Audit Logs
    brain/                   -> Brain administrativo

  empresas/
    [slug]/
      home/                  -> Home da empresa
      dashboard/             -> Operacoes / Dashboard
      metrics/               -> Operacoes / Metricas
      planos-de-teste/       -> Repositorio de Testes / Planos
      defeitos/              -> Repositorio de Testes / Defeitos
      documentos/            -> Documentos da empresa
      aplicacoes/            -> Aplicacoes da empresa

  operacoes/
    dashboard/               -> Operacoes / Dashboard
    metricas/                -> Operacoes / Metricas
    buscar/                  -> Operacoes / Buscar

  casos-de-teste/            -> Repositorio de Testes / Casos
  runs/                      -> Repositorio de Testes / Runs
  defeitos/                  -> Repositorio de Testes / Defeitos

  automacoes/
    playwright/              -> Automacao / Playwright
    ui-studio/               -> Automacao / UI Studio
    execucoes/               -> Automacao / Execucoes
    fluxos/                  -> Automacao / Fluxos
    casos/                   -> Automacao / Casos
    scripts/                 -> Automacao / Scripts
    base64/                  -> Automacao / Base64 / Biblioteca

  suporte/                   -> Suporte / Abrir chamado
    kanban/                  -> Suporte / Andamento
  chamados/                  -> Suporte / Chamados

  chat/                      -> Chat
  conversas/                 -> Redirecionamento/compatibilidade de chat

  brain/                     -> Brain / Grafico
    perguntar/               -> Brain / Perguntar ao assistente

  documentos/                -> Documentos / Central
    repositorio/             -> Documentos / Repositorio
  docs/                      -> Wiki/documentacao interna
  documentacao/              -> Documentacao tecnica/entrada legada

  settings/                  -> Configuracoes/perfil
  profile/                   -> Perfil legado/redirecionamento
```

## Menu lateral canonico

O menu deve continuar nascendo de `NAV_CATALOG`.

```text
MENU LATERAL
NAV_CATALOG
  home
    Home

  companies
    Listagem
    Buscar empresa
    Criar empresa

  operations
    Dashboard
    Metricas
    Buscar

  quality
    Casos de Teste
    Planos de Teste
    Runs
    Defeitos

  automation
    Playwright
    UI Studio
    Execucoes
    Fluxos automatizados
    Casos automatizados
    Scripts
    Ferramentas
    API Lab
    Base64 / Encoders
    Biblioteca
    Logs

  requests
    Listagem
    Buscar solicitacao

  support
    Abrir chamado
    Andamento dos chamados
    Chamados
    Meus chamados

  chat
    Lista de conversas
    Buscar conversa

  brain
    Grafico do Brain
    Perguntar ao assistente

  documents
    Central de documentos
    Repositorio de documentos

  users
    Criar Lider TC
    Criar Suporte Tecnico
    Criar Usuario TC
    Criar Usuario da Empresa
    Listagem usuarios
    Listagem empresas

  admin
    Gestao de permissoes
    Audit Logs
```

## Perfis nao duplicam telas

```text
PERFIS
  leader_tc
    ve praticamente todos os modulos internos;
    pode administrar usuarios, permissoes, empresas, solicitacoes e auditoria.

  technical_support
    ve modulos operacionais;
    pode apoiar empresas, suporte, solicitacoes e usuarios conforme permissao.

  testing_company_user
    ve modulos internos com menos privilegios administrativos.

  empresa
    ve a estrutura da propria empresa;
    nao precisa de tela duplicada, so contexto filtrado.

  company_user
    ve a estrutura da propria empresa com permissoes menores.
```

Regra: se a tela existe para mais de um perfil, a tela e a mesma. O filtro acontece em:

- `NAV_CATALOG.allowedRoles`
- `NAV_CATALOG.onlyRoles`
- `requiredPermission`
- `buildNavigationForUser`
- guardas `Require*`
- RBAC das APIs
- contexto de empresa ativo

## Back-end por dominio

O back-end visual nao deve ser lido como uma lista solta de APIs. Ele deve ser lido por dominio.

```text
BACK-END
app/api/
  admin/
    users/                  -> usuarios administrativos
    clients/                -> empresas administradas
    access-requests/        -> solicitacoes de acesso
    audit-logs/             -> auditoria
    tickets/                -> chamados administrativos
    qase/                   -> integracao Qase administrativa

  auth/
    login/
    refresh/
    forgot-password/
    reset-password/
    reset-request/
    reset-via-token/
    me/

  me/
    company-profile/        -> perfil da empresa do usuario logado
    company-users/          -> usuarios da empresa
    profile-summary/
    avatar/

  clients/
  companies/
  company/
  empresas/

  tickets/
  suportes/
  support/
    access-request/

  brain/
    commands/
    graph/
    memories/

  automations/
    qc/
    http/
    griaule/
    manual-links/

  playwright/
    agents/

  test-cases/
  test-plans/
  test-data-assets/
```

## Testes por visao do sistema

Os testes precisam acompanhar a leitura por menu, perfil e fluxo.

```text
TESTES
tests/
  menu-e-perfis/
    navigation-permissions.test.ts
    frontend-multitenant.test.tsx
    company-user-scope.test.ts
    user-scope-policy.test.ts
    support-access.test.ts
    adminClientAccess.test.ts

  usuarios-e-permissoes/
    system-roles.test.ts
    permissionMatrix-effective.test.ts
    admin-user-profiles-classification.test.ts
    createUserModal.test.tsx
    CreateUserFlow.test.ts

  empresas/
    company-routes.test.ts
    company-record.test.ts
    company-wiki-access.test.ts
    edit-company.test.ts
    vinculo-empresa-visibilidade.test.ts

  suporte-e-solicitacoes/
    access-request-accept-route.test.ts
    access-request-lookup.test.ts
    solicitacoes-acesso.test.ts
    solicitacoes-usuario.test.ts
    fluxo-solicitacao-acesso.test.ts
    chamados-suporte.test.ts

  brain-e-assistente/
    brian-contextual-foundation.test.ts
    brain-ingest-contract.test.ts
    brain-commands-confirmation.test.ts
    assistant-ask-route.test.ts
    assistant/*.test.ts

  automacoes/
    automation-access.test.ts
    automation-cases.test.ts
    automation-catalog-griaule.test.ts
    automation-page-smoke-route.test.ts

  integracoes/
    qase-token-mask.test.ts
    sc-integration-collection.test.ts
    jira-sync.test.ts
```

Regra dos testes: se aparece no menu, precisa ter teste de visibilidade e teste de acesso direto por rota/API.

## Estrutura alvo sem mover tudo agora

Esta e a estrutura alvo para a leitura do codigo. Ela nao substitui `app/`; ela organiza a regra que as rotas consomem.

```text
src/
  features/
    menu-lateral/
      catalogo/
        menuLateral.catalog.ts
      acessos/
        filtrarMenuPorPerfil.ts
        resolverPerfilVisual.ts
      componentes/
        Sidebar.tsx
        SidebarItem.tsx
      hooks/
        useMenuLateral.ts

    home/
    empresas/
    operacoes/
    repositorio-testes/
    automacoes/
    solicitacoes/
    suporte/
    chat/
    brain/
    documentos/
    usuarios/
    configuracoes/

  backend/
    admin/
      usuarios/
      empresas/
      permissoes/
      solicitacoes/
      auditoria/

    empresas/
      perfil/
      dashboard/
      defeitos/
      releases/
      runs/

    suporte/
      chamados/
      comentarios/
      solicitacoes-acesso/

    brain/
      grafo/
      contexto/
      ingestao/

    automacoes/
    repositorio-testes/
    integracoes/

  shared/
    components/
    hooks/
    services/
    utils/
    types/
```

## Como evoluir sem baguncar

Quando criar ou ajustar uma tela:

1. Achar primeiro o modulo no menu lateral.
2. Conferir se o item existe em `NAV_CATALOG`.
3. Conferir se o perfil correto ve o item pelo `allowedRoles`/`requiredPermission`.
4. Conferir se a rota tem guarda de acesso.
5. Conferir se a API valida permissao no servidor.
6. Criar ou ajustar teste de visibilidade do menu.
7. Criar ou ajustar teste de acesso direto da rota/API.

## Primeiros movimentos seguros

1. Nao mover paginas grandes ainda.
2. Consolidar mapa menu -> rota -> perfil -> teste.
3. Padronizar nomes do menu antes de mover pasta.
4. Mover primeiro arquivos pequenos de regra pura, como navegacao/permissao.
5. So depois mover componentes/telas por modulo.

## Decisao de arquitetura

`app/` continua sendo a camada de rotas do Next.js.

`src/features/` sera a leitura humana por area do produto.

`src/backend/` sera a leitura humana por dominio de API/regra server-side.

`tests/` deve espelhar menu, perfil e fluxo real do sistema.

Nenhuma funcionalidade sera excluida por reorganizacao. Se algo parecer duplicado, primeiro sera marcado como:

- rota atual;
- rota legada;
- redirecionamento;
- componente compartilhado;
- regra de negocio;
- candidato a consolidacao.
