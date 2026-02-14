#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL is not set. Export it in the CI environment."
  exit 2
fi

SENSITIVE_TABLES="${SENSITIVE_TABLES:-public.global_admins}"
SENSITIVE_VIEWS="${SENSITIVE_VIEWS:-}"
ALLOWED_SECURITY_DEFINER_FUNCTIONS="${ALLOWED_SECURITY_DEFINER_FUNCTIONS:-}"

# Lista de checagens
CHECKS=(
  "Views with SECURITY DEFINER"
  "Sensitive tables without RLS"
  "Sensitive views accessible by PUBLIC"
  "SECURITY DEFINER functions allowlist"
)

OK_COUNT=0
TOTAL_COUNT=0

run_check() {
  local name="$1"
  local sql="$2"

  if [[ -n "${ONLY_CHECK:-}" && "$name" != "$ONLY_CHECK" ]]; then
    return
  fi

  ((TOTAL_COUNT++))
  echo "🔍 ${name}"

  local result
  if ! result=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atq \
    -v sensitive_tables="$SENSITIVE_TABLES" \
    -v sensitive_views="$SENSITIVE_VIEWS" \
    -v allowed_sd_funcs="$ALLOWED_SECURITY_DEFINER_FUNCTIONS" \
    -c "$sql"); then
    echo "❌ FAIL: ${name}"
    exit 1
  fi

  if [[ -n "$result" ]]; then
    echo "❌ FAIL: ${name}"
    echo "$result"
    exit 1
  fi

  echo "✅ OK: ${name}"
  ((OK_COUNT++))
}

# Permite rodar apenas uma checagem: ./script.sh --only "Sensitive tables without RLS"
ONLY_CHECK=""
if [[ "${1:-}" == "--only" && -n "${2:-}" ]]; then
  ONLY_CHECK="$2"
fi

run_check "Views with SECURITY DEFINER" "
SELECT format('%s.%s', n.nspname, c.relname)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND array_to_string(c.reloptions, ',') ILIKE '%security_definer%';
"

run_check "Sensitive tables without RLS" "
WITH sensitive_tables AS (
  SELECT nullif(trim(x), '') AS full_name
  FROM unnest(string_to_array(:'sensitive_tables', ',')) AS x
), parsed AS (
  SELECT
    split_part(full_name, '.', 1) AS schema_name,
    split_part(full_name, '.', 2) AS table_name,
    full_name
  FROM sensitive_tables
  WHERE full_name IS NOT NULL
)
SELECT format('%s (RLS disabled)', p.full_name)
FROM parsed p
JOIN pg_namespace n ON n.nspname = p.schema_name
JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = p.table_name
WHERE c.relkind IN ('r', 'p')
  AND c.relrowsecurity = false;
"

run_check "Sensitive views accessible by PUBLIC" "
WITH sensitive_tables AS (
  SELECT nullif(trim(x), '') AS full_name
  FROM unnest(string_to_array(:'sensitive_tables', ',')) AS x
), table_views AS (
  SELECT (split_part(full_name, '.', 2) || '_view') AS view_name
  FROM sensitive_tables
  WHERE full_name IS NOT NULL
), override_views AS (
  SELECT nullif(trim(x), '') AS view_name
  FROM unnest(string_to_array(:'sensitive_views', ',')) AS x
), effective_views AS (
  SELECT view_name FROM override_views WHERE view_name IS NOT NULL
  UNION
  SELECT view_name FROM table_views
  WHERE (SELECT count(*) FROM override_views WHERE view_name IS NOT NULL) = 0
)
SELECT format('%s.%s (%s)', table_schema, table_name, privilege_type)
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee = 'PUBLIC'
  AND table_name IN (SELECT view_name FROM effective_views);
"

run_check "SECURITY DEFINER functions allowlist" "
WITH sd_funcs AS (
  SELECT format('%s.%s', n.nspname, p.proname) AS full_name
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE p.prosecdef = true
), allowlist AS (
  SELECT nullif(trim(x), '') AS full_name
  FROM unnest(string_to_array(:'allowed_sd_funcs', ',')) AS x
), effective_allowlist AS (
  SELECT full_name FROM allowlist WHERE full_name IS NOT NULL
)
SELECT sd.full_name
FROM sd_funcs sd
WHERE (
  (SELECT count(*) FROM effective_allowlist) = 0
  OR sd.full_name NOT IN (SELECT full_name FROM effective_allowlist)
);
"

echo "🎉 Security checks passed: $OK_COUNT/$TOTAL_COUNT"
exit 0
