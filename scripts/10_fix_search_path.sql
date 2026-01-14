-- 10_fix_search_path.sql
-- Remediate lint rule 0011: set explicit search_path on public functions.

DO $$
DECLARE
  target_functions text[] := ARRAY[
    'normalize_qase_status',
    'refresh_kanban_cases',
    'refresh_run_metrics',
    'refresh_company_quality',
    'evaluate_quality_gate',
    'refresh_all_runs_for_project',
    'refresh_full_pipeline',
    'audit_redact_row_changes',
    'get_current_client_id',
    'get_current_client_id_safe',
    'get_recent_support_requests_for_api_backend_safe',
    'recent_support_requests_last_30_days_fn',
    'recent_support_requests_last_30_days_safe',
    'event_trigger_fn',
    'qase_encrypt',
    'qase_decrypt',
    'qase_encrypt_safe',
    'qase_decrypt_safe',
    'promote_user_to_super_admin',
    'set_profiles_auth_user_id',
    'audit_trigger',
    'populate_auth_user_id'
  ];
  rec record;
  stmt text;
BEGIN
  FOR rec IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_catalog.oidvectortypes(p.proargtypes) AS arg_types
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(target_functions)
  LOOP
    RAISE NOTICE 'Setting search_path on %.%(%).', rec.schema_name, rec.function_name, rec.arg_types;
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = pg_catalog, public',
        rec.schema_name,
        rec.function_name,
        rec.arg_types
      );
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skipping %.%(%): insufficient privileges or object not found.', rec.schema_name, rec.function_name, rec.arg_types;
    END;
  END LOOP;

  -- Auto-remediate: any SECURITY DEFINER function/procedure in public without an explicit search_path.
  FOR rec IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS routine_name,
      pg_catalog.oidvectortypes(p.proargtypes) AS arg_types,
      p.prokind AS routine_kind
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.prokind IN ('f','p')
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM unnest(p.proconfig) AS cfg
          WHERE cfg LIKE 'search_path=%'
        )
      )
  LOOP
    stmt := format(
      'ALTER %s %I.%I(%s) SET search_path = pg_catalog, public',
      CASE WHEN rec.routine_kind = 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END,
      rec.schema_name,
      rec.routine_name,
      rec.arg_types
    );

    RAISE NOTICE 'Auto-fixing search_path: %', stmt;
    BEGIN
      EXECUTE stmt;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Skipping auto-fix for %.%(%): insufficient privileges.', rec.schema_name, rec.routine_name, rec.arg_types;
    END;
  END LOOP;
END
$$ LANGUAGE plpgsql;
