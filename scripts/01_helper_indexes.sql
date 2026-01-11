-- 01_helper_indexes.sql
-- Helper function to resolve current user's client_id + supporting indexes
-- Run: psql -f scripts/01_helper_indexes.sql or use Supabase SQL editor

CREATE OR REPLACE FUNCTION public.get_current_client_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT u.client_id
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_current_client_id() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_client_id() TO service_role;

-- Indexes to support RLS policies
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_qase_defects_company_id ON public.qase_defects(company_id);
CREATE INDEX IF NOT EXISTS idx_run_metrics_company_id ON public.run_metrics(company_id);
CREATE INDEX IF NOT EXISTS idx_company_quality_metrics_company_id ON public.company_quality_metrics(company_id);
CREATE INDEX IF NOT EXISTS idx_qase_projects_raw_company_id ON public.qase_projects_raw(company_id);
CREATE INDEX IF NOT EXISTS idx_qase_cases_raw_company_id ON public.qase_cases_raw(company_id);
CREATE INDEX IF NOT EXISTS idx_qase_runs_raw_company_id ON public.qase_runs_raw(company_id);
CREATE INDEX IF NOT EXISTS idx_qase_results_raw_company_id ON public.qase_results_raw(company_id);
CREATE INDEX IF NOT EXISTS idx_qase_milestones_raw_company_id ON public.qase_milestones_raw(company_id);
CREATE INDEX IF NOT EXISTS idx_company_integrations_company_id ON public.company_integrations(company_id);

-- Verification
-- SELECT proname FROM pg_proc WHERE proname = 'get_current_client_id';
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%';

-- Rollback hints
-- DROP FUNCTION public.get_current_client_id();
-- DROP INDEX IF EXISTS idx_users_auth_user_id, idx_qase_defects_company_id, ...;
