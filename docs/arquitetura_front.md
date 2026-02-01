# Arquitetura – Frontend (Next.js)

## Visão geral
Este projeto usa **Next.js (App Router)** com **TypeScript**.

- Rotas e páginas: pasta `app/`.
- Componentes compartilhados: `app/components/` (alguns ainda em `components/`).
- Contextos e hooks globais: `app/context/`.
- Utilitários reutilizáveis: `lib/`.
- Dados de apoio (mock e fixtures): `data/`.

> Regra importante: módulos de `lib/` marcados como server-only devem ser importados apenas por **Server Components** ou rotas de API.

## Estrutura do App Router
Padrões convencionados:

- `app/layout.tsx`: layout global com CSS, providers e inicialização do tema.
- `app/page.tsx`: página inicial.
- `app/<segment>/page.tsx`: páginas por funcionalidade.
- `app/api/**/route.ts`: endpoints HTTP (GET, POST, PATCH, DELETE).

## Estilo e UI
O projeto usa **Tailwind v4** com tokens acessados por **CSS Variables**.

- Prefira classes na forma canônica, por exemplo:
  - `text-(--tc-text-muted)`
  - `bg-(--tc-surface)`
  - `border-(--tc-border)`
- Evite a sintaxe antiga `text-[var(--tc-text-muted)]`; use o parêntese simples.
- Para estilos dinâmicos (status, métricas), reutilize CSS Modules existentes (pills, cards etc.).

## Tema (claro/escuro)
O tema é controlado com classe (`.dark`) e variáveis CSS.

- O `app/layout.tsx` aplica uma inicialização antes da hidratação para evitar flash de tema.
- As preferências ficam em `localStorage` com chave por usuário (ex.: `tc-settings:<userId>`) e há uma chave auxiliar para lembrar o último usuário logado.

## Autenticação (resumo)
- O login gera `session_id` e, quando configurado, `auth_token`.
- As telas do cliente consomem os dados do usuário via `/api/me`.
- Os componentes acessam configurações e permissões pelo contexto `UserContext`.
