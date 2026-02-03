# Quality Control

Next.js (App Router) + TypeScript. Front-end em `app/`, utilitarios restritos ao servidor em `lib/`, dados auxiliares em `data/` e testes em `tests-e2e/`.

Sem Docker: use um PostgreSQL local ou remoto e aponte o `DATABASE_URL`.

## Fluxo de desenvolvimento (Windows)

1. Instale dependencias:

```bash
npm install
```

2. Configure variaveis de ambiente:

- Copie `.env.local.example` para `.env.local`.
- Preencha:
  - `DATABASE_URL` (PostgreSQL local ou remoto)
  - `JWT_SECRET`
  - (opcional) tokens do Qase (`QASE_API_TOKEN`, `QASE_PROJECT_MAP`)
  - (opcional) Redis Upstash (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)

3. Valide o ambiente:

```bash
npm run env:check
```

4. Prepare o banco (PostgreSQL):

```bash
npx prisma migrate dev
```

5. Suba o servidor:

```bash
npm run dev
```

Abra http://localhost:3000 no navegador.

## Verificacoes recomendadas

```bash
npm run lint
npm run build
npm run test:e2e:smoke
```

## Credenciais de teste (E2E)

Quando `E2E_USE_JSON=1`, o login usa o arquivo `data/local-auth-store.json` (ou `data/local-auth-store.sample.json` como fallback).

- Admin: `admin@griaule.test` / senha `Griaule@123`
- Usuario: `user@griaule.test` / senha `Griaule@123`

## Notas sobre Qase

- A integracao envia o header `Token: <API_TOKEN>` (conforme a documentacao da Qase).
- Sem o token, as telas/rotas dependentes da Qase retornam dados vazios, mas o app continua operacional.
