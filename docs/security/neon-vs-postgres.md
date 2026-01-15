# Neon API token vs Postgres connection string

Este projeto usa Postgres via `@vercel/postgres` (server-only). Para isso, você **precisa de connection strings do banco**.

## O que é o token `napi_...` (Neon)

- É um token da **API/console do Neon** (control-plane).
- Serve para **gerenciar** recursos (projetos, branches, settings) via API do Neon.
- **Não** é uma credencial de acesso ao banco (não funciona como `postgresql://...`).
- **Não** deve ser colocado nas env vars do app.

Se um token `napi_...` foi colado em chat/issue/commit, trate como comprometido:
- Revogue/rotacione imediatamente no Neon Console.

## O que o app precisa (Postgres)

O runtime do app (Next.js) precisa das **connection strings do Postgres**:

- `POSTGRES_URL` — conexão **pooled/pgbouncer** (recomendado para runtime)
- `POSTGRES_URL_NON_POOLING` — conexão **direta** (útil para tarefas administrativas/migrações)

Aliases (opcionais) usados por scripts/docs:
- `DATABASE_URL` — pode apontar para o mesmo valor de `POSTGRES_URL`
- `DATABASE_URL_UNPOOLED` — pode apontar para o mesmo valor de `POSTGRES_URL_NON_POOLING`

## Onde configurar (sem commitar segredos)

- Local: criar `.env.local` a partir de `.env.example` ou `.env.local.example`.
- Vercel: Project → Settings → Environment Variables.

Dicas:
- Nunca commite `.env.local`.
- Prefira configurar secrets no provedor (Vercel) e usar `.env.local` só no dev local.

## Checklist rápido

- [ ] Token `napi_...` revogado/rotacionado (se exposto)
- [ ] `POSTGRES_URL` configurado (pooled)
- [ ] `POSTGRES_URL_NON_POOLING` configurado (direct)
- [ ] (Opcional) `DATABASE_URL` e `DATABASE_URL_UNPOOLED` configurados como aliases
- [ ] Redeploy no Vercel após mudar env vars
