# painel-qa

Next.js (App Router) + TypeScript. Front-end em `app/`, utilitários restritos ao servidor em `lib/`, dados em `data/` e testes em `tests/` e `tests-e2e/`.

## Executar localmente (Windows)

1) Instalar dependências:

```bash
npm install
```

2) Criar e ajustar variáveis de ambiente:

- Copie `.env.example` para `.env.local`.
- (Recomendado) Use `.env.local.example` como base (ele já traz Qase + Postgres).
- Autenticação (modo sugerido: JWT sem Supabase):
	- `SUPABASE_DISABLED=true`
	- `JWT_SECRET` (somente no servidor)
- Supabase (legado; apenas se ainda usar autenticação do Supabase ou redefinição de senha):
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	- `NEXT_PUBLIC_SITE_URL` (fundamental para links de redefinição; deve ser o domínio final do deploy)
	- (somente servidor) `SUPABASE_SERVICE_ROLE_KEY`
- Banco Postgres (persistência em `@vercel/postgres`, apenas no servidor):
	- `POSTGRES_URL` (conexão com pool/pgbouncer)
	- `POSTGRES_URL_NON_POOLING` (conexão direta, sem pooling)
	- (aliases opcionais usados por scripts/docs) `DATABASE_URL` e `DATABASE_URL_UNPOOLED`
- (Opcional, recomendável para Qase) Informe também `QASE_API_TOKEN` (ou `QASE_TOKEN`) e `QASE_PROJECT_CODE`.
- (Opcional) Redis Upstash (somente servidor): defina `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`. O endpoint de verificação do admin é `/api/admin/redis/ping`.
	- Para testes sem autenticação (preview ou primeiro setup), configure `REDIS_PING_SECRET` e acesse `/api/public/redis/ping?secret=...` (ou envie o cabeçalho `x-redis-ping-secret`).

> Segurança: o token `napi_...` do Neon (API/console) **não** é a string de conexão do Postgres. Nunca exponha esse token no app; utilize apenas as strings de conexão (`POSTGRES_URL*`) e mantenha-as em `.env.local`/Vercel (não commit).

Guia rápido: `docs/security/neon-vs-postgres.md`.

### Schema do Postgres (Neon / Vercel Postgres)

Além das variáveis, o banco precisa das tabelas esperadas por `@vercel/postgres`:

- `public.clients`
- `public.users`
- `public.user_clients`

Script idempotente para criar o schema mínimo: `scripts/99_vercel_postgres_schema.sql`.

3) Subir o servidor:

```bash
npm run dev
```

Se o `npm run dev` encerrar e o navegador exibir `ERR_CONNECTION_REFUSED`, use o modo daemon:

```bash
npm run dev:daemon
```

Os logs ficam em `dev.out.log` / `dev.err.log`. Para encerrar o daemon:

```bash
npm run dev:stop
```

Abra http://localhost:3000 no navegador.

## Redefinição de senha (legado / Supabase)

Se `SUPABASE_DISABLED=true`, este fluxo não é utilizado.

Para evitar o erro `DEPLOYMENT_NOT_FOUND` em previews (o Vercel expira), use sempre o domínio de produção nos links de recuperação.

No painel do Supabase, navegue em **Authentication** > **URL Configuration**:

- **Site URL**: `https://painel-qa-jpjv.vercel.app`
- **Additional Redirect URLs** (adicione ao menos):
	- `https://painel-qa-jpjv.vercel.app/login/reset-password`

Se incluir um domínio de preview (ex.: `https://testing-metric-....vercel.app/login/reset-password`), ele pode parar de funcionar quando o preview mudar/expirar. O ideal é manter apenas o domínio de produção.

No app, a variável `NEXT_PUBLIC_SITE_URL` precisa ser igual ao **Site URL** do Supabase (é ela que o front end utiliza para montar o `redirectTo` do recovery).

## Verificações recomendadas

```bash
npm run lint
npm test
npm run build
npm run test:e2e:smoke
```

## Notas sobre Qase

- A integração envia o header `Token: <API_TOKEN>` (conforme a documentação da Qase).
- Sem o token, as telas/rotas dependentes da Qase retornam dados vazios, mas o app continua operacional.
