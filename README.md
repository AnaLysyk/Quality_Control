# painel-qa

Next.js (App Router) + TypeScript. Frontend em `app/`, utilitários server-only em `lib/`, dados em `data/`, e testes em `tests/` e `tests-e2e/`.

## Rodar localmente (Windows)

1) Instalar deps:

```bash
npm install
```

2) Criar variáveis de ambiente:

- Copie `.env.example` para `.env.local`
- (Recomendado) Se preferir, use `.env.local.example` como base (inclui Qase + Postgres).
- Preencha as variáveis do Supabase:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	- `NEXT_PUBLIC_SITE_URL` (importante para links de reset de senha; use o domínio fixo do deploy)
	- (server-only) `SUPABASE_SERVICE_ROLE_KEY`
- Banco (Postgres) para persistência (server-only, via `@vercel/postgres`):
	- `POSTGRES_URL` (pool/pgbouncer)
	- `POSTGRES_URL_NON_POOLING` (conexão direta, sem pooling)
	- (aliases opcionais, usados em scripts/docs) `DATABASE_URL` e `DATABASE_URL_UNPOOLED`
- (Opcional, recomendado para Qase) Preencha também `QASE_API_TOKEN` (ou `QASE_TOKEN`) e `QASE_PROJECT_CODE`.

> Segurança: token `napi_...` do Neon (API/console) **não** é a string de conexão do Postgres. Nunca use token Neon como variável do app; use apenas as connection strings (`POSTGRES_URL*`) e mantenha-as em `.env.local`/Vercel (não commit).

Guia rápido: `docs/security/neon-vs-postgres.md`.

3) Subir o servidor:

```bash
npm run dev
```

Se o `npm run dev` encerrar no terminal e o browser mostrar `ERR_CONNECTION_REFUSED`, use o modo daemon:

```bash
npm run dev:daemon
```

Logs ficam em `dev.out.log` / `dev.err.log`. Para parar:

```bash
npm run dev:stop
```

Abrir: http://localhost:3000

## Supabase Auth (reset de senha)

Para o link de recuperação de senha não cair em `DEPLOYMENT_NOT_FOUND` (Vercel preview expira), use sempre o domínio de produção.

No Supabase Dashboard → **Authentication** → **URL Configuration**:

- **Site URL**: `https://painel-qa-jpjv.vercel.app`
- **Additional Redirect URLs** (adicione pelo menos):
	- `https://painel-qa-jpjv.vercel.app/login/reset-password`

Se você adicionar um domínio de preview (ex.: `https://testing-metric-....vercel.app/login/reset-password`), ele pode parar de funcionar quando o preview mudar/expirar. O recomendado é manter apenas o domínio de produção.

No app, a variável `NEXT_PUBLIC_SITE_URL` deve bater com o **Site URL** do Supabase (é ela que o frontend usa para montar o `redirectTo` do recovery).

## Validar que está tudo OK

```bash
npm run lint
npm test
npm run build
npm run test:e2e:smoke
```

## Notas sobre Qase

- A integração usa o header `Token: <API_TOKEN>` (conforme docs oficiais da Qase).
- Sem token configurado, as telas/rotas que dependem da Qase tendem a retornar dados vazios (sem quebrar o app).
