# Qase API - Master Map (v1 + extras)

Single reference for product + integration. This is written to match how this repo integrates with Qase.

## Base + auth

- Base: `https://api.qase.io/v1`
- Auth (backend only):
  - `Token: QASE_API_TOKEN`
- JSON: `Content-Type: application/json`
- Do not expose tokens in the browser. Use server-only calls or a backend proxy.

Repo notes:
- SDK: `lib/qaseSdk.ts` (sends `Token` header by default).
- Server integration: `app/services/qase.ts` (server-only).
- Backend (Nest): `backend/src/qase/*`.

## Product architecture (this stack)

1) Backend proxy layer
- Frontend calls server functions or `/api/*` routes.
- Backend talks to Qase, normalizes payloads, caches, and handles retries/rate limit.

2) Data model (raw vs derived)
- Raw: `qase_projects`, `qase_suites`, `qase_cases_raw`, `qase_runs`, `qase_run_cases_raw`, `qase_results_raw`.
- Derived: `kanban_cases`, `run_metrics`, `releases`, `release_runs`.
- Full ETL SQL: `docs/qase_etl.sql`.

3) Mature flow
- Sync projects -> suites -> cases (raw).
- ETL -> kanban + metrics.
- Create run when pipeline starts or release opens.
- Playwright afterEach sends results.
- Dashboard reads metrics in real time.

## Endpoints by domain (v1)

### Projects
- `GET /project` (list)
- `GET /project/{code}` (details)

Use cases:
- Admin integration selector.
- Validate project code.

### Suites (folders)
- `GET /suite/{code}`
- `POST /suite/{code}`

Use cases:
- Catalog hierarchy.
- Kanban filters and navigation.

### Test cases
- `GET /case/{code}` (list; supports `suite_id`, `limit`, `offset`)
- `GET /case/{code}/{id}` (details)
- `POST /case/{code}`
- `PATCH /case/{code}/{case_id}`
- `DELETE /case/{code}/{case_id}`
- `POST /case/{code}/bulk` (bulk create)

Use cases:
- Catalog sync.
- Internal editor (future).
- Governance and coverage tracking.

### Runs (core for dashboard)
- `GET /run/{code}` (history)
- `POST /run/{code}` (create)
- `GET /run/{code}/{run_id}` (totals: passed/failed/blocked/untested)
- `POST /run/{code}/{run_id}/complete` (close run)
- `GET /run/{code}/{run_id}/cases` (cases within run)

Use cases:
- Timeline and comparisons.
- Release status + metrics.

### Results (test results)
- `GET /result/{code}` (list; use query params like `run_id`, `limit`, `offset`)
- `GET /result/{code}/{hash}` (get a specific result by hash)
- `POST /result/{code}/{run_id}` (single result)
- `POST /result/{code}/{run_id}/bulk` (bulk results)

### Milestones (releases)
- `GET /milestone/{code}`
- `POST /milestone/{code}`

Use cases:
- Release grouping and quality gate.

### Users
- `GET /user` (limited)

Use cases:
- Ownership/assignees.

### Configuration / Environment
- `GET /configuration/{code}`
- `POST /configuration/{code}`
- `GET /environment/{code}`
- `POST /environment/{code}`

Use cases:
- QA/Staging/Prod context for runs.

### Attachments
- `POST /attachment/{code}` (multipart/form-data)
- `GET /attachment` (list)

Use cases:
- Evidence, screenshots, logs.

### Defects (v2)
- `GET /defect/{code}`

Use cases:
- Defect dashboards (admin/company).

## Quick cURL

```bash
curl -H "Token: $QASE_API_TOKEN" \
  https://api.qase.io/v1/project

curl -X POST https://api.qase.io/v1/run/SFQ \
  -H "Token: $QASE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Release 1.2.0","cases":[1,2]}'
```

## Playwright integration (real hooks)

This repo already includes a hook in `tests-e2e/fixtures/test.ts`.

Env:
- `QASE_API_TOKEN` (or `QASE_TOKEN`)
- `QASE_PROJECT_CODE`
- `QASE_RUN_ID`
- `QASE_DISABLED=true` to turn off sending

Usage:
- Tag tests with `@qase=123` in the title or a `qase` annotation.
- Hook sends status after each test.
- Missing case id -> logs and continues.

## Quality gate (executive dashboard)

Computed in `app/dashboard/page.tsx` and rendered in `app/dashboard/DashboardClient.tsx`.

Default thresholds (override with env):
- `QUALITY_GATE_PASS_RATE` (default 92)
- `QUALITY_GATE_MAX_FAIL_RATE` (default 5)
- `QUALITY_GATE_MAX_BLOCKED_RATE` (default 3)
- `QUALITY_GATE_MAX_NOTRUN_RATE` (default 12)
- `QUALITY_GATE_MIN_TOTAL` (default 1)

Status rules:
- Fail if fail rate > max OR blocked rate > max.
- Warn if pass rate < min OR not run rate > max.
- No data if total < min.

## What this enables (product view)

- Kanban based on real execution data.
- Release health score and quality gate.
- Run comparisons and trends.
- Flaky detection and defect audit trail.

## Next steps (optional)

- Extend the proxy layer `/api/qase/*` for consistent cache/retry.
- Add scheduled sync jobs for raw tables.
- Add trend/flaky views on top of `run_metrics`.
