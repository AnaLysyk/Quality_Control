# painel-qa

Next.js (App Router) + TypeScript. Frontend em `app/`, utilitários server-only em `lib/`, dados em `data/`, e testes em `tests/` e `tests-e2e/`.

## Rodar localmente (Windows)

1) Instalar deps:

```bash
npm install
```

2) Criar variáveis de ambiente:

- Copie `.env.example` para `.env.local`
- Preencha as variáveis do Supabase:
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	- (server-only) `SUPABASE_SERVICE_ROLE_KEY`
- (Opcional, recomendado para Qase) Preencha também `QASE_API_TOKEN` (ou `QASE_TOKEN`) e `QASE_PROJECT_CODE`.

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
