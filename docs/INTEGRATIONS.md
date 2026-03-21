# Integrations and scheduled JIRA sync

This document explains how to configure and run the scheduled JIRA sync workflow.

Secrets required (set in GitHub repository Settings → Secrets):

- `SITE_BASE_URL` — public base URL of the deployed site (e.g., https://painel.example.com)
- `JIRA_SYNC_BEARER` — bearer token to call the admin sync endpoint (create a service account or use an existing admin token)
- `JIRA_SYNC_COMPANIES` — comma-separated list of company slugs to sync (e.g., `acme,acme-pt,griaule`)

How the workflow works:

- A scheduled GitHub Actions workflow `.github/workflows/sync-jira.yml` runs daily (or can be triggered manually) and POSTs to `/api/admin/integrations/sync-jira` for each slug in `JIRA_SYNC_COMPANIES`.
- The endpoint requires a Bearer token in the `Authorization` header; configure `JIRA_SYNC_BEARER` accordingly.

Local/manual testing:

1. Ensure your local `.env.local` has `DATABASE_URL` and developer auth tokens configured.
2. You can run the migration script to convert legacy `qase_*/jira_*` fields into `company_integrations` rows (recommended before enabling the workflow):

```bash
npx tsx scripts/migrate-legacy-integrations.ts --dry-run
# Inspect output, then run without --dry-run to apply
npx tsx scripts/migrate-legacy-integrations.ts
```

3. To manually trigger a sync for a company (local or remote), POST to the endpoint with a bearer token:

```bash
curl -X POST "$SITE_BASE_URL/api/admin/integrations/sync-jira" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"companySlug":"my-company"}'
```

Notes:
- Tokens stored in `company_integrations.config` are not encrypted by default — consider using a secrets manager in production or encrypting tokens before storing them.
- The workflow expects the admin endpoint to accept the supplied bearer token — if you use a different auth mechanism, adapt the workflow accordingly.
# Multi-integration support (Qase + Jira)

This project has been updated to support multiple integrations per company. Summary:

- Added `CompanyIntegration` model in Prisma (`prisma/schema.prisma`).
- Added enum `IntegrationType` with values `QASE`, `JIRA`, `MANUAL`, `OTHER`.
- Created migration `add-company-integrations` and applied it to the local database when requested.
- The Company now has a one-to-many relation `integrations` storing per-integration `config` as JSON.
- API endpoints (`app/api/clients/route.ts` and `app/api/clients/[id]/route.ts`) now accept an `integrations` array in the payload and return `integrations` in responses. Legacy fields (`qase_token`, `qase_project_codes`, `jira_*`) remain supported for backward compatibility.
- `pgStore` was updated to persist and read `CompanyIntegration` records and to expose them through the same local API surface.
- Frontend: the admin clients UI (`app/admin/clients/page.tsx` and `CreateClientModal`) now surface both Qase and Jira integrations; lists and details show combined labels like `Qase, Jira`.
- `lib/applicationsStore.ts` still syncs Qase projects into `applications` as before. The flow uses Qase project lists provided by the client payload.

Notes & recommendations:

- Tokens are kept in the `CompanyIntegration.config` JSON; consider encrypting these values at rest in production.
- Back up your DB before applying migrations in production.
- Update any external scripts or integrations that relied on the single `integration_mode` column.

If you want, I can:
- Add migration rollback guidance and a small data-migration script to convert existing `qase_*` and `jira_*` columns into `CompanyIntegration` rows.
- Implement Jira-specific sync logic to create Jira-based applications or mirror projects (currently only Qase projects are synced into `applications`).
