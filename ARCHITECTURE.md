# Architecture

## Goals
- Keep UI fast and focused; keep domain rules in the backend.
- Make boundaries explicit to avoid duplication as the team grows.
- Make local dev and CI predictable.

## System map
- Next.js app (app/): UI and BFF.
- app/api: BFF endpoints used by the UI.
- PostgreSQL + Prisma: data source and schema of record.
- Redis (optional): sessions and lightweight caches.
- Qase: external test management data.

## Boundaries
app/api (BFF):
- UI-facing API, cookies/session, SSR helpers.
- Compose and shape data for screens.
- Owns auth/session and tenant resolution.

Database (Postgres/Prisma):
- Source of truth for users, companies and relationships.
- Prisma is the only schema authority.

## Auth flow
1. UI -> POST /api/auth/login -> Prisma validates credentials.
2. Session stored in Redis + JWT cookie issued.
3. UI -> GET /api/me to resolve current user + companies.

## Contract strategy
- Shared types via packages/contracts (Zod + TS).
- API contracts documented in the docs folder.

## Testing strategy
- Smoke E2E in CI (login + core pages).
- Full E2E locally when needed.

## Run modes
- Prisma + JWT only.
