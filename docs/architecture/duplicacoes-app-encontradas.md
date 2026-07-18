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

- `api/me`, `api/profile`, `api/user/[id]` e `api/user/settings` parecem
  tratar do mesmo conceito ("usuário autenticado atual") em três lugares
  diferentes. Páginas espelham com `app/me` e `app/profile` separados.

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
