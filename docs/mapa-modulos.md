# Mapa de módulos

| Módulo | Telas e rotas principais | Regras e dados atuais |
| --- | --- | --- |
| Autenticação | `app/login/`, `app/api/auth/`, `app/api/me/` | `lib/auth/`, `lib/core/auth/`, `lib/core/session/` |
| Permissões | `app/admin/users/permissions/`, `app/admin/permissoes/` | `lib/permissions/`, `lib/permissionMatrix.ts`, `lib/rbac/` |
| Usuários | `app/admin/users/`, `app/settings/profile/` | `lib/adminUsers.ts`, `lib/profile/`, `lib/store/permissionsStore.ts` |
| Empresas | `app/admin/clients/`, `app/empresas/[slug]/` | arquivos `lib/company*` e conteúdo legado em `data/` |
| Suporte | `app/suporte/`, `app/chamados/`, `app/meus-chamados/` | `lib/supportAccess.ts` e stores de tickets |
| Testes manuais | casos, planos, runs, releases e defeitos | `lib/test-cases/`, `lib/testPlansStore.ts`, `lib/testPlanCases.ts` |
| Automação | `app/automacoes/`, APIs de automação e Playwright | `lib/automations/`, `lib/playwright/`, conteúdo legado em `data/` |
| Dashboards | dashboards gerais, operacionais e de empresa | `lib/dashboard/` e APIs de métricas |
| Documentos | `app/documentos/`, `app/docs/` e documentos de empresa | stores distribuídos em `lib/` e `data/` |
| Chat e assistente | `app/chat/`, `app/conversas/`, APIs do assistente | `lib/chatStore.ts`, `lib/chatContacts.ts`, `lib/assistente/` |
| Brain | `app/brain/`, `app/admin/brain/`, `app/api/brain/` | `lib/brain/`, `lib/brain.ts` e scripts |
| Integrações | APIs administrativas, empresas e automações | Jira, Qase, S3, Redis, e-mail e BrasilAPI em `lib/` e `app/api/` |

## Pontos de atenção

- Há páginas grandes que devem ser divididas apenas quando a feature for alterada.
- `data/` mistura dados locais e código executável.
- `src/` contém somente design system e menu lateral; não é a raiz oficial do App Router.
- Nomes genéricos como `service.ts`, `data.ts` e `helpers.ts` devem ser tratados junto da responsabilidade real, não isoladamente.

## Piloto de usuários

- Regra compartilhada: `lib/permissions/validarAcessoUsuarios.ts`.
- Validação do servidor: `lib/permissions/validarAcessoUsuariosNoServidor.ts`.
- Estado visual local: `app/admin/users/components/EstadoAcessoUsuarios.tsx`.
- Telas preservadas: `app/admin/users/` e `app/admin/users/permissions/`.

O suporte técnico mantém leitura quando autorizada pela matriz. Criação, edição e alteração de permissões continuam protegidas no frontend e nas APIs.
