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
    'event_trigger_fn',
    'qase_encrypt',
    'qase_decrypt',
    'promote_user_to_super_admin',
    'set_profiles_auth_user_id',
    'audit_trigger',
    'populate_auth_user_id'
  ];
  rec record;
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
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public',
      rec.schema_name,
      rec.function_name,
      rec.arg_types
    );
  END LOOP;
END
$$ LANGUAGE plpgsql;
