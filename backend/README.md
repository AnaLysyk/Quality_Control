# Painel QA – Backend (NestJS)

API usada pelo painel. Endpoints principais (prefixo `/api`):

- `POST /api/auth/login` – login via Supabase (email/usuario + senha). Opcionalmente seta cookie `auth_token`.
- `GET /api/auth/me` – retorna usuário do token/cookie.
- `POST /api/auth/logout` – limpa cookie de autenticação.
- `GET /api/projects` – lista projetos do Qase (requer login).
- `GET /api/runs` – lista runs do projeto padrão ou do `?project=CODE` (requer login).
- `GET /api/runs/:id` – detalhe de run (requer login).
- `GET /api/health` – health check.

## Configuração

1) Copie `backend/.env.example` para `backend/.env` e preencha:
- `NEXT_PUBLIC_SUPABASE_URL` (ou `SUPABASE_URL`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou `SUPABASE_ANON_KEY`) – usado no login senha
- `SUPABASE_SERVICE_ROLE_KEY` – usado para validar Bearer token (server-only)
- `QASE_API_TOKEN` e `QASE_DEFAULT_PROJECT`
- `DATABASE_URL` (placeholder, sem uso direto neste stub)
- `CORS_ORIGIN` (ex.: `http://localhost:3000`)

Opcional:
- `AUTH_COOKIE_NAME` (default: `auth_token`)

2) Instale dependências:
```bash
cd backend
npm install
```

3) Rodar em desenvolvimento:
```bash
npm run start:dev
```
Servidor padrão em `http://localhost:8080`.

## Testes

```bash
npm test
```
