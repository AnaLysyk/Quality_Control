# Quality Control

Ferramenta interna de QA.

Next.js (App Router) + TypeScript. Front-end em `app/`, utilitarios server-only em `lib/`, stores locais em `data/` e testes em `tests-e2e/`.

Por padrao o sistema roda **sem banco** (stores locais JSON). PostgreSQL/Prisma fica como opcional/legacy para poucas rotas e scripts.

## Fluxo de desenvolvimento (Windows)

1. Instale dependencias:

```bash
npm install
```

2. Configure variaveis de ambiente:

- Copie `.env.local.example` para `.env.local`.
- Preencha:
  - `JWT_SECRET` (recomendado)
  - (opcional) Qase (`QASE_API_TOKEN`, `QASE_PROJECT_MAP`, e/ou `QASE_API_TOKEN_<SLUG>` ex.: `QASE_API_TOKEN_GRIAULE`)
  - (opcional) Redis Upstash (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
  - (opcional/legacy) Postgres/Prisma (`DATABASE_URL`)

3. Valide o ambiente:

```bash
npm run env:check
```

4. Suba o servidor:

```bash
npm run dev
```

Abra http://localhost:3000 no navegador.

## Documentacao rapida (como esta funcionando hoje)

- `ARCHITECTURE.md`
- `docs/RELATORIO_SISTEMA_INTERNO.md`

## Verificacoes recomendadas

```bash
npm run lint
npm test
npm run build
npm run test:e2e:smoke
```

## Credenciais (interno)

Quando `E2E_USE_JSON=1`, o login usa o arquivo `data/local-auth-store.json` (ou `data/local-auth-store.sample.json` como fallback).

- Admin: `admin@griaule.test` / senha `Griaule@123`
- Usuario: `user@griaule.test` / senha `Griaule@123`

Seeds internos (QA):
- `griaule` / `griaule123`
- `analysyk` / `analysyk123`
- `admin` / `griaule4096PD$` (global_admin)
- `bravo` / `bravo123` (company_admin em griaule)

## Notas sobre Qase

- A integracao envia o header `Token: <API_TOKEN>` (conforme a documentacao da Qase).
- Sem o token, as telas/rotas dependentes da Qase retornam dados vazios, mas o app continua operacional.
