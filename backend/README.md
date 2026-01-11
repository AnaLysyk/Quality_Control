# Painel QA – Backend (NestJS)

API usada pelo painel. Endpoints principais (prefixo `/api`):

- `GET /api/projects` – lista projetos do Qase (requer login).
- `GET /api/runs` – lista runs do projeto padrão ou do `?project=CODE` (requer login).
- `GET /api/runs/:id` – detalhe de run (requer login).
- `GET /api/health` – health check.

## Configuração

1) Copie `backend/.env.example` para `backend/.env` e preencha:
- `SUPABASE_JWT_SECRET` (chave de assinatura JWT do Supabase; usada pelo guard para validar tokens Bearer)
- `QASE_API_TOKEN` e `QASE_DEFAULT_PROJECT`
- `DATABASE_URL` (placeholder, sem uso direto neste stub)
- `CORS_ORIGIN` (ex.: `http://localhost:3000`)

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
