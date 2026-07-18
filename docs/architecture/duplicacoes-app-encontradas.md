# Duplicações encontradas em `app/` (não tratadas nesta reorganização)

Este documento existe porque a reorganização de pastas (branch
`refactor/estrutura-de-pastas`) mapeou `app/` para decidir o que reorganizar,
e encontrou uma quantidade grande de nomes duplicados em inglês/português —
que não são só "pasta com nome feio", são features inteiras duplicadas ou
quase-duplicadas. Isso é decisão de produto (qual é a oficial, o que
descontinuar), não simples renomeação de pasta, então ficou fora do escopo
da reorganização. Registrado aqui para virar um trabalho futuro deliberado.

## Domínio de usuário

- Páginas: `app/usuarios` (com `vinculos`) vs `app/admin/users` (com
  `permissions`, `vinculos`).
- API: `api/user` (singular) vs `api/users` (plural) vs `api/usuarios`
  (português) vs `api/admin/users` (escopo admin).

**Investigado na Fase 5 (2026-07-18):**

- `api/usuarios/*` só tem `vinculos` (business-users, history, leadership,
  search) — feature de "gestão de vínculos", não duplica CRUD de usuário.
  Nenhuma ação necessária.
- **Vulnerabilidade corrigida nesta branch**: `api/users/route.ts`
  (GET/POST/PATCH) não tinha nenhuma autenticação — qualquer request direto
  listava, criava ou editava usuário de qualquer empresa (só o `DELETE` era
  protegido). Corrigido aplicando `requireGlobalAdminWithStatus` nos 3
  métodos, mesmo padrão já usado no `DELETE` desta rota, com teste cobrindo
  os cenários sem autenticação/sem privilégio (commit
  `fix(security): exige admin global em GET/POST/PATCH de /api/users`).
- Com a vulnerabilidade corrigida, ficou claro que **existem 3 caminhos
  paralelos de criação/edição de usuário** com regras de negócio
  divergentes, não só nomes diferentes:
  - `api/admin/users` (GET/POST/PATCH) — o caminho real e completo: usa
    `resolveOperationalContext`/`validarAcessoUsuariosNoServidor` (permissão
    granular, não só "é admin global"), grava auditoria
    (`addAuditLogSafe`), envia e-mail de boas-vindas, bloqueia
    escalonamento de privilégio sem ser Líder TC. É o único chamado pela
    UI real: `app/admin/users/page.tsx` e seus modais
    (`CreateUserModal.tsx`, `UserDetailsModal.tsx`,
    `UserPermissionsPanel.tsx`).
  - `api/users` (plural) — GET é usado por `CreateSupportTicketButton.tsx`
    (dropdown de operadores de suporte por empresa). POST/PATCH/DELETE
    **não têm nenhum chamador no frontend** — órfãos, sem auditoria, sem
    e-mail, sem as mesmas checagens de escalonamento de privilégio do
    `api/admin/users`.
  - `api/user` (singular, só POST) e `api/user/[id]` (singular, só PATCH) —
    o único chamador de `api/user` é `app/components/CreateUserForm.tsx`,
    que por sua vez **não é importado em lugar nenhum do repositório**
    (componente órfão). `api/user/[id]` PATCH não tem nenhum chamador
    encontrado no frontend, mas tem um teste unitário dedicado
    (`tests/api/unitarios/userIdRoutePatch.test.ts`) focado em não vazar
    segredos/headers e no gate de mock E2E — sinal de que pode ter sido
    mantido de propósito (ex.: consumidor externo, script, ferramenta de
    suporte) mesmo sem uso na UI atual.
  - **Recomendação (avaliada, não executada nesta branch)**: migrar o único
    caso de uso real fora do painel admin (se `CreateUserForm.tsx` for
    reativado) para `api/admin/users`, e então remover `api/user`,
    `api/user/[id]` e os métodos órfãos de `api/users` (mantendo só o GET).
    Não fiz essa remoção agora porque (1) esta branch é sobre reorganizar
    pastas + corrigir a vulnerabilidade ativa, não redesenhar fluxos de
    negócio; (2) um grep no `app/` não prova ausência de consumidores
    externos (scripts, Postman, integrações) dessas rotas; (3) o teste
    dedicado do `api/user/[id]` sugere manutenção intencional recente que
    merece confirmação direta antes de apagar.

## Domínio de empresa/cliente

- Páginas: `app/empresas` (22 páginas, a maior árvore fora de admin) vs
  `app/clients` vs `app/clients-list` vs `app/admin/clients`.
- API: `api/company` (singular) vs `api/companies` (plural) vs `api/empresas`
  (português) vs `api/company-defects`/`api/company-docs`/
  `api/company-documents` (variantes compostas, `-docs` vs `-documents`
  inconsistente entre si).

## Domínio de suporte/chamados

- Páginas: `app/suporte` vs `app/chamados` vs `app/meus-chamados`.
- API: `api/support` vs `api/suportes` (plural português) vs `api/chamados`
  vs `api/tickets` (inglês).

## Domínio de vínculos ("Gestão de Vínculos")

- Duas rotas vivas, ambas guardadas no servidor e explicitamente excluídas do
  mapa automático de páginas (`SYSTEM_PAGE_MAP_EXCLUSIONS` em
  `backend/navigation/systemPageAudit.ts`), nenhuma linkada em menu:
  `app/usuarios/vinculos` (usa `RelationshipManagementClient`) e
  `app/admin/users/vinculos` (usa `RelationshipManagementWorkspace` →
  `RelationshipManagementClientV4`).
- `RelationshipManagementClientV2.tsx` e `V3.tsx` já foram removidos (branch
  `fix/profile-user-management-hardening`, confirmado sem nenhuma
  referência no repositório inteiro antes de apagar).

## Domínio de releases

- Páginas: `app/release` vs `app/painel-releases-manuais` vs
  `app/painel-releases-manuais-autenticado` (a autenticada parece uma
  variante da anterior).
- API: `api/release-calendar` vs `api/release-manual` (singular) vs
  `api/releases` (plural) vs `api/releases-manual` (plural) — quatro
  namespaces para o que lê como um domínio só.

## Domínio de documentação

- Páginas: `app/docs` vs `app/documentacao` vs `app/documentos`.
- API: `api/company-docs` vs `api/company-documents` vs `api/platform-docs`.

## Domínio de solicitações/acesso

- Páginas: `app/requests` vs `app/solicitacoes`.
- API: `api/requests` vs `api/access-requests`.

## Domínio de kanban

- `api/kanban` (board genérico, com `export`/`import`/`link`) vs
  `api/kanban-columns` (namespace separado) vs página `app/kanban-it`.

## Domínio "usuário atual" (me/profile)

- `api/me`, `api/profile` e `api/user/settings` parecem tratar do mesmo
  conceito ("usuário autenticado atual") em lugares diferentes. Páginas
  espelham com `app/me` e `app/profile` separados.
- Correção (Fase 5): `api/user/[id]` **não** é sobre o usuário atual — é
  edição administrativa de qualquer usuário por ID (exige
  `requireGlobalAdminWithStatus`), então na verdade pertence à discussão do
  domínio de usuário acima, não a este grupo. Só compartilha o prefixo
  singular `api/user` com `api/user/settings`.

## Outros

- `api/assistant/ask` e `api/assistente/ask` — mesmo endpoint em inglês e
  português, lado a lado.
- `app/admin/permissions` vs `app/admin/permissoes` (inglês/português).
- `api/runs` (1 rota) vs `api/test-runs` (2 rotas) — não investigado se são
  redundantes ou coisas diferentes.
- `app/casos-de-teste` (página, português) mapeia para `api/test-cases`
  (API, inglês) — o resto do cluster `test-*` (`test-data-assets`,
  `test-data-packs`, `test-plans`, `test-projects`, `test-runs`) é
  consistente em inglês, só a página que não bate com a API.

## Como decidir o que fazer com cada um

Para cada duplicação acima, antes de mexer:

1. Confirmar com `grep`/build se ambas as variantes estão realmente em uso
   (algumas podem já estar mortas, como aconteceu com
   `RelationshipManagementClientV2`/`V3`).
2. Decidir qual é a oficial (geralmente: a mais usada, ou a mais recente).
3. Migrar os consumidores da variante descontinuada para a oficial.
4. Só então remover a variante descontinuada — nunca antes de confirmar que
   nada mais aponta pra ela.

Isso é o mesmo processo que já foi usado nesta branch para confirmar e
remover `RelationshipManagementClientV2`/`V3` com segurança.
