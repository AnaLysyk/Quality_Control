Testing Metric — Run & Dev Guide

Quick start (development)

1) Start the backend mock server (optional, provides persistent demo data):

Windows PowerShell

```powershell
cd backend
npm install
npm run start:mock
```

The mock server listens on a dynamic free port and logs the URL. To run on a fixed port set `PORT=3334` before starting.

2) Start the frontend (Next.js):

In repo root:

```bash
npm install
# If using the backend mock server on a fixed port, set NEXT_PUBLIC_GOVERNANCE_API_BASE
# e.g. on Windows PowerShell:
# $env:NEXT_PUBLIC_GOVERNANCE_API_BASE = 'http://localhost:3334'
npm run dev
```

3) Open the app:

- Frontend: http://localhost:3000/testing-metric (or navigate in app)
- Mock backend endpoints (if started): http://localhost:3334/governance/companies

Docker (optional)

To run the mock backend in Docker with persisted data:

```bash
docker compose up --build
```

This will run the governance mock on http://localhost:3334 and persist `backend/data/governance.json` on the host.

If `docker` is not available on your machine (PowerShell reports "docker: command not found"), run the mock backend locally instead (recommended for quick development on Windows):

Windows PowerShell

```powershell
cd backend
npm install
npm run start:mock
```

The mock will log the URL it listens on (for example `http://localhost:61828`). Create a `.env.local` file in the repo root with this value so the frontend calls the mock directly:

```text
NEXT_PUBLIC_GOVERNANCE_API_BASE=http://localhost:61828
```

Then restart the frontend dev server (`npm run dev`) so Next.js picks up the `.env.local` variable.

Seeding scenarios

You can seed predefined scenarios to demo different risk states:

```bash
cd backend
node src/scripts/seed-scenarios.js stable
# or: mixed, crisis
```


Notes
- The frontend will use `NEXT_PUBLIC_GOVERNANCE_API_BASE` when present; otherwise it falls back to built-in Next API routes under `/api/governance/*`.
- Actions created via the UI are persisted to `backend/data/governance.json` when the mock server is used.

Testing

- Run the Testing Metric unit test only (from repo root):

```bash
npm run test:tm
```

Files added/changed
- `app/testing-metric/*` — UI and components (TrendLine, DetailDrawer)
- `app/testing-metric/types.ts` — types + score function
- `app/api/governance/*` — Next API mocks (companies, summary, company/:id, trends, actions)
- `backend/src/mock-server.ts` — express mock server (file persistence)
- `backend/data/governance.json` — initial data for mock server
- `tests/testing-metric.types.test.ts` — unit tests for score

If you want, I can:
- Move backend mock to a docker container for an isolated demo
- Add visual polish (animations + tooltips)
- Prepare a demo script that seeds different risk scenarios
