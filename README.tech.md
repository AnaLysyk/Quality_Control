# Quality Control - Technical Guide

Detailed setup, architecture, testing, and deployment instructions.

## Architecture

- Frontend: Next.js App Router + React + TypeScript
- Backend/API: in-app server routes and service layer
- Database: PostgreSQL + Prisma
- Session/cache: Upstash Redis (with fallback)
- Testing: Jest + Playwright (E2E + smoke)

Main structure:
- app/
- lib/
- data/
- tests-e2e/

## Local Setup (Windows)

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

- Copy `.env.example` to `.env.local`
- Minimum variables:
  - DATABASE_URL
  - JWT_SECRET
- Optional:
  - QASE_API_TOKEN
  - QASE_PROJECT_MAP
  - UPSTASH_REDIS_REST_URL
  - UPSTASH_REDIS_REST_TOKEN

3. Validate environment:

```bash
npm run env:check
```

4. Run migrations:

```bash
npx prisma migrate dev
```

5. Start app:

```bash
npm run dev
```

Open http://localhost:3000

## Recommended Checks

```bash
npm run lint
npm run build
npm run test:e2e:smoke
```

## Render Deployment

Minimum recommended environment variables:
- DATABASE_URL
- JWT_SECRET
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
- NEXT_PUBLIC_SITE_URL=https://quality-control-qwqs.onrender.com
- AUTH_COOKIE_SECURE=true
- EMAIL_SMTP_HOST
- EMAIL_SMTP_PORT
- EMAIL_SMTP_USER
- EMAIL_SMTP_PASS
- EMAIL_FROM

Optional:
- EMAIL_SMTP_SECURE=true
- DASHBOARD_DEBUG=true

Notes:
- If Redis is not configured, fallback mode in `lib/redis.ts` is used.
- The repository includes `render.yaml` as baseline config.

## E2E Credentials

When E2E_USE_JSON=1:
- Admin: admin@griaule.test / Griaule@123
- User: user@griaule.test / Griaule@123

## IT Kanban / Tickets

- IT Kanban: /kanban-it
- My Tickets: /meus-chamados
- Seed files:
  - data/support-tickets.json
  - data/ticket-comments.json
  - data/ticket-events.json

UI flow:
1. Login as itdev or admin
2. Open /kanban-it and move ticket columns
3. Login as user and open /meus-chamados

Postman flow:
1. POST /api/tickets
2. PATCH /api/tickets/{id}/status
3. POST /api/tickets/{id}/comments
4. GET /api/notifications?unread=true

## Qase Integration

- Header used: Token: <API_TOKEN>
- Without token, Qase-dependent routes return empty data and app remains operational.

## Related Docs

- README (portfolio view): README.md
- Profile kit: docs/ops/GITHUB_PROFILE_KIT.md
- Career one-pager template: docs/ops/CAREER_ONE_PAGER_TEMPLATE.md
