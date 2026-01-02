# Painel QA – Backend (NestJS)

API usada pelo painel. Endpoints principais (com prefixo `/api`):

- `POST /api/login` e `POST /api/logout` – autenticação por cookie.
- `GET /api/projects` – lista projetos do Qase (require login).
- `GET /api/runs` – lista runs do projeto padrão ou do `?project=CODE` (require login).
- `GET /api/runs/:id` – detalhe de run (opcional, require login).
- `GET /api/health` – health check.

## Configuração

1. Copie `backend/.env.example` para `backend/.env` e preencha:
   - `ADMIN_USER` / `ADMIN_PASSWORD`
   - `QASE_API_TOKEN` e `QASE_DEFAULT_PROJECT`
   - `DATABASE_URL` (placeholder, sem uso direto neste stub)
   - `CORS_ORIGIN` (ex.: `http://localhost:3000`)
2. Instale as dependências:
   ```bash
   cd backend
   npm install
   ```
3. Rodar em desenvolvimento:
   ```bash
   npm run start:dev
   ```
   Servidor padrão em `http://localhost:8080`.

## Testes

```bash
npm test
```
