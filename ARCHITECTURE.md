# Architecture

## Goals
- Keep UI fast and focused; keep domain rules in the backend.
- Make boundaries explicit to avoid duplication as the team grows.
- Make local dev and CI predictable.

## System map
- Next.js app (app/): UI and BFF.
- app/api: BFF endpoints used by the UI.
- backend/ (Nest): domain API and integrations.
- Supabase: auth and data (mockable).

## Boundaries (current -> target)
app/api (BFF):
- UI-facing API, cookies/session, SSR helpers.
- Compose and shape data for screens.
- Do not own domain rules or persistence.

backend/ (Nest):
- Source of truth for domain data and rules.
- Authorization and audit.
- Integrations (Qase, etc).

## Auth flow (current)
1. UI -> POST /api/auth/login (app/api) -> Supabase auth (or mock).
2. UI -> GET /api/me to resolve current user.
3. Protected pages use RequireAuth.

## Auth flow (target)
- UI -> app/api -> backend auth.
- Backend issues token; app/api sets cookie and returns session data.

## Contract strategy
- Short term: shared types via packages/contracts (Zod + TS).
- Long term: OpenAPI on Nest + generated client in Next.

## Testing strategy
- Smoke E2E in CI (login + clientes list).
- Full E2E locally when needed.

## Run modes
- SUPABASE_MOCK=true bypasses external services for local/CI.
