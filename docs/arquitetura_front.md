# Arquitetura — Frontend (Next.js)

## Visão geral
Este projeto usa **Next.js (App Router)** com **TypeScript**.

- Rotas e páginas: pasta `app/`.
- Componentes compartilhados: `app/components/` (e alguns em `components/`).
- Lógica de contexto (ex.: settings): `app/context/`.
- Utilitários compartilhados: `lib/`.
- Dados locais (modo mock e fixtures): `data/`.

> Regra importante: módulos de `lib/` que são *server-only* (ex.: `lib/supabaseServer.ts`) devem ser importados apenas em **Server Components** ou **API routes**.

## Estrutura do App Router
Padrões comuns:

- `app/layout.tsx`: layout global (inclui CSS, providers, e inicialização de tema).
- `app/page.tsx`: home.
- `app/<segment>/page.tsx`: páginas por feature.
- `app/api/**/route.ts`: endpoints (GET/POST/PATCH/DELETE).

## Estilo / UI
O projeto usa **Tailwind v4** + tokens via **CSS Variables**.

- Preferir classes com variáveis no formato canônico:
  - `text-(--tc-text-muted)`
  - `bg-(--tc-surface)`
  - `border-(--tc-border)`
- Evitar a forma antiga `text-[var(--tc-text-muted)]` (prefira `text-(--tc-text-muted)`).
- Para cores dinâmicas por status/métrica, preferir **CSS Modules** existentes (ex.: componentes de pills/cards).

## Tema (dark/light)
O tema é controlado via classe (ex.: `.dark`) e variáveis.

- Há uma inicialização pré-hidratação no `app/layout.tsx` para evitar “flash” (escuro → claro ou vice-versa).
- Settings persistem em `localStorage` com chave por usuário (ex.: `tc-settings:<userId>`), e uma chave auxiliar para lembrar o último usuário.

## Autenticação (visão rápida)
- O login gera um cookie `auth_token`.
- Telas/client-side consomem dados de usuário via `/api/me`.

## Onde mexer (checklist)
- UI nova: preferir `app/components/`.
- Nova página: `app/<feature>/page.tsx`.
- Nova API: `app/api/<feature>/route.ts`.
- Integrações/clients: `lib/`.
