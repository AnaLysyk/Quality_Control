🇧🇷 Leia também: db-security-checks.pt-BR.md

# DB Security Checks (RLS & SECURITY DEFINER)

## Purpose

Automated CI checks to prevent common database security regressions:
- Views declared with `SECURITY DEFINER`
- Sensitive tables without Row-Level Security (RLS) enabled
- Sensitive views still accessible by `PUBLIC`
- (Optional) `SECURITY DEFINER` functions outside an allowlist

These scripts are intended to run in CI (GitHub Actions, GitLab CI, etc.) and fail the pipeline if any policy violation is detected.

## Files

- `./scripts/db-security-check.sh`
  - Core checks: `SECURITY DEFINER` views, sensitive tables without RLS, sensitive views accessible by `PUBLIC`.
- `./scripts/db-security-check-allowlist.sh`
  - All checks from above + allowlist check for `SECURITY DEFINER` functions.
- `./.gitlab-ci.yml`
  - Example GitLab CI jobs to run the scripts.

## Environment variables

- `DATABASE_URL` (required)
  - Full Postgres connection string used by `psql`. If missing, scripts exit with code `2`.

- `SENSITIVE_TABLES` (optional)
  - Comma-separated list of fully-qualified tables to treat as sensitive.
  - Format: `schema.table`
  - Default: `public.global_admins`
  - Example: `SENSITIVE_TABLES="public.global_admins,admin.critical_table"`

- `SENSITIVE_VIEWS` (optional)
  - Comma-separated list of view names (no schema) to check for `PUBLIC` privileges.
  - If not set, the script builds defaults by appending `_view` to each sensitive table name.
    - Example: `public.global_admins` → `global_admins_view`
  - Example: `SENSITIVE_VIEWS="global_admins_view,critical_table_view"`

- `ALLOWED_SECURITY_DEFINER_FUNCTIONS` (optional; allowlist script only)
  - Comma-separated list of fully-qualified function names that are permitted to be `SECURITY DEFINER`.
  - Format: `schema.function_name`
  - Example: `ALLOWED_SECURITY_DEFINER_FUNCTIONS="public.safe_fn,admin.minimal_helper"`

## Behavior and exit codes

- Exit `0`: all checks passed
- Exit `1`: one or more checks failed (CI should treat this as failure)
- Exit `2`: missing `DATABASE_URL`

## Examples

Local (quick):

- `export DATABASE_URL="postgres://user:pass@host:5432/dbname"`
- `./scripts/db-security-check.sh`

Override sensitive tables:

- `export SENSITIVE_TABLES="public.global_admins,admin.critical_table"`
- `./scripts/db-security-check.sh`

Allowlist script:

- `export ALLOWED_SECURITY_DEFINER_FUNCTIONS="public.safe_fn,admin.minimal_helper"`
- `./scripts/db-security-check-allowlist.sh`

## Maintenance notes

- Keep `SENSITIVE_TABLES` explicit to force conscious decisions about what is sensitive.
- Update `ALLOWED_SECURITY_DEFINER_FUNCTIONS` only via approved PRs with rationale (audit trail).
- Periodically review any new `SECURITY DEFINER` functions; they are high-risk by design.
