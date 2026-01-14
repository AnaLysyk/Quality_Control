-- 04_audit_triggers.sql
-- Audit trigger/function that redacts common secret fields
-- Run after 03_policies.sql (or in parallel; doesn't depend on RLS)

CREATE OR REPLACE FUNCTION public.audit_redact_row_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  redacted_new jsonb;
  redacted_old jsonb;
  redaction_keys text[] := ARRAY['access_token','token','secret','api_key','password'];
  col text;
  actor_uuid uuid;
BEGIN
  -- resolve actor: prefer GUC app.audit_actor (if set), fallback to auth.uid()
  BEGIN
    actor_uuid := NULLIF(current_setting('app.audit_actor', true), '')::uuid;
  EXCEPTION WHEN others THEN
    actor_uuid := NULL;
  END;
  IF actor_uuid IS NULL THEN
    BEGIN
      actor_uuid := auth.uid()::uuid;
    EXCEPTION WHEN others THEN
      actor_uuid := NULL;
    END;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    redacted_new := to_jsonb(NEW);
    FOREACH col IN ARRAY redaction_keys LOOP
      IF redacted_new ? col THEN
        redacted_new := jsonb_set(redacted_new, ARRAY[col], to_jsonb('[REDACTED]'::text), true);
      END IF;
    END LOOP;
  ELSE
    redacted_new := NULL;
  END IF;

  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    redacted_old := to_jsonb(OLD);
    FOREACH col IN ARRAY redaction_keys LOOP
      IF redacted_old ? col THEN
        redacted_old := jsonb_set(redacted_old, ARRAY[col], to_jsonb('[REDACTED]'::text), true);
      END IF;
    END LOOP;
  ELSE
    redacted_old := NULL;
  END IF;

  INSERT INTO public.audit_log(id, table_name, operation, row_data, old_data, changed_by, created_at)
  VALUES (
    gen_random_uuid(),
    TG_TABLE_NAME,
    TG_OP,
    redacted_new,
    redacted_old,
    actor_uuid,
    now()
  );

  RETURN NULL;
END;
$$;

-- Attach triggers (drop first to allow re-run)
DROP TRIGGER IF EXISTS qase_defects_audit_trg ON public.qase_defects;
CREATE TRIGGER qase_defects_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.qase_defects
  FOR EACH ROW EXECUTE FUNCTION public.audit_redact_row_changes();

DROP TRIGGER IF EXISTS qase_projects_raw_audit_trg ON public.qase_projects_raw;
CREATE TRIGGER qase_projects_raw_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.qase_projects_raw
  FOR EACH ROW EXECUTE FUNCTION public.audit_redact_row_changes();

DROP TRIGGER IF EXISTS qase_cases_raw_audit_trg ON public.qase_cases_raw;
CREATE TRIGGER qase_cases_raw_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.qase_cases_raw
  FOR EACH ROW EXECUTE FUNCTION public.audit_redact_row_changes();

DROP TRIGGER IF EXISTS qase_runs_raw_audit_trg ON public.qase_runs_raw;
CREATE TRIGGER qase_runs_raw_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.qase_runs_raw
  FOR EACH ROW EXECUTE FUNCTION public.audit_redact_row_changes();

DROP TRIGGER IF EXISTS qase_results_raw_audit_trg ON public.qase_results_raw;
CREATE TRIGGER qase_results_raw_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.qase_results_raw
  FOR EACH ROW EXECUTE FUNCTION public.audit_redact_row_changes();

DROP TRIGGER IF EXISTS qase_milestones_raw_audit_trg ON public.qase_milestones_raw;
CREATE TRIGGER qase_milestones_raw_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.qase_milestones_raw
  FOR EACH ROW EXECUTE FUNCTION public.audit_redact_row_changes();

DROP TRIGGER IF EXISTS run_metrics_audit_trg ON public.run_metrics;
CREATE TRIGGER run_metrics_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.run_metrics
  FOR EACH ROW EXECUTE FUNCTION public.audit_redact_row_changes();

DROP TRIGGER IF EXISTS company_quality_metrics_audit_trg ON public.company_quality_metrics;
CREATE TRIGGER company_quality_metrics_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.company_quality_metrics
  FOR EACH ROW EXECUTE FUNCTION public.audit_redact_row_changes();

DROP TRIGGER IF EXISTS quality_gate_results_audit_trg ON public.quality_gate_results;
CREATE TRIGGER quality_gate_results_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.quality_gate_results
  FOR EACH ROW EXECUTE FUNCTION public.audit_redact_row_changes();

DROP TRIGGER IF EXISTS company_integrations_audit_trg ON public.company_integrations;
CREATE TRIGGER company_integrations_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.company_integrations
  FOR EACH ROW EXECUTE FUNCTION public.audit_redact_row_changes();

-- Verification
-- SELECT * FROM pg_trigger WHERE tgname LIKE '%audit_trg%';
-- SELECT * FROM public.audit_log ORDER BY created_at DESC LIMIT 10;

-- Rollback
-- DROP TRIGGER qase_defects_audit_trg ON public.qase_defects;
-- ...
-- DROP FUNCTION public.audit_redact_row_changes();
