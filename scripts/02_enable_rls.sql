-- 02_enable_rls.sql
-- Enable Row Level Security on target tables
-- Run after 01_helper_indexes.sql

ALTER TABLE public.qase_defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qase_projects_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qase_cases_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qase_runs_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qase_results_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qase_milestones_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_gate_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_integrations ENABLE ROW LEVEL SECURITY;

-- Verification
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('qase_defects','qase_projects_raw', ...);

-- Rollback
-- ALTER TABLE public.qase_defects DISABLE ROW LEVEL SECURITY;
-- repeat for other tables
