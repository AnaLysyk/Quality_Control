-- 03_policies.sql
-- Create RLS policies for Qase and metrics tables
-- Run after 02_enable_rls.sql

-- qase_defects policies
DROP POLICY IF EXISTS qase_defects_select_client ON public.qase_defects;
DROP POLICY IF EXISTS qase_defects_insert_client ON public.qase_defects;
DROP POLICY IF EXISTS qase_defects_update_client ON public.qase_defects;
DROP POLICY IF EXISTS qase_defects_delete_client ON public.qase_defects;
CREATE POLICY qase_defects_select_client ON public.qase_defects
  FOR SELECT
  TO authenticated
  USING ( company_id = public.get_current_client_id() );

CREATE POLICY qase_defects_insert_client ON public.qase_defects
  FOR INSERT
  TO authenticated
  WITH CHECK ( company_id = public.get_current_client_id() );

CREATE POLICY qase_defects_update_client ON public.qase_defects
  FOR UPDATE
  TO authenticated
  USING ( company_id = public.get_current_client_id() )
  WITH CHECK ( company_id = public.get_current_client_id() );

CREATE POLICY qase_defects_delete_client ON public.qase_defects
  FOR DELETE
  TO authenticated
  USING ( company_id = public.get_current_client_id() );

-- qase_projects_raw (repeat pattern)
DROP POLICY IF EXISTS qase_projects_raw_select_client ON public.qase_projects_raw;
DROP POLICY IF EXISTS qase_projects_raw_insert_client ON public.qase_projects_raw;
DROP POLICY IF EXISTS qase_projects_raw_update_client ON public.qase_projects_raw;
DROP POLICY IF EXISTS qase_projects_raw_delete_client ON public.qase_projects_raw;
CREATE POLICY qase_projects_raw_select_client ON public.qase_projects_raw
  FOR SELECT
  TO authenticated
  USING ( company_id = public.get_current_client_id() );

CREATE POLICY qase_projects_raw_insert_client ON public.qase_projects_raw
  FOR INSERT
  TO authenticated
  WITH CHECK ( company_id = public.get_current_client_id() );

CREATE POLICY qase_projects_raw_update_client ON public.qase_projects_raw
  FOR UPDATE
  TO authenticated
  USING ( company_id = public.get_current_client_id() )
  WITH CHECK ( company_id = public.get_current_client_id() );

CREATE POLICY qase_projects_raw_delete_client ON public.qase_projects_raw
  FOR DELETE
  TO authenticated
  USING ( company_id = public.get_current_client_id() );

-- qase_cases_raw
DROP POLICY IF EXISTS qase_cases_raw_select_client ON public.qase_cases_raw;
DROP POLICY IF EXISTS qase_cases_raw_insert_client ON public.qase_cases_raw;
DROP POLICY IF EXISTS qase_cases_raw_update_client ON public.qase_cases_raw;
DROP POLICY IF EXISTS qase_cases_raw_delete_client ON public.qase_cases_raw;
CREATE POLICY qase_cases_raw_select_client ON public.qase_cases_raw
  FOR SELECT
  TO authenticated
  USING ( company_id = public.get_current_client_id() );

CREATE POLICY qase_cases_raw_insert_client ON public.qase_cases_raw
  FOR INSERT
  TO authenticated
  WITH CHECK ( company_id = public.get_current_client_id() );

CREATE POLICY qase_cases_raw_update_client ON public.qase_cases_raw
  FOR UPDATE
  TO authenticated
  USING ( company_id = public.get_current_client_id() )
  WITH CHECK ( company_id = public.get_current_client_id() );

CREATE POLICY qase_cases_raw_delete_client ON public.qase_cases_raw
  FOR DELETE
  TO authenticated
  USING ( company_id = public.get_current_client_id() );

-- qase_runs_raw
DROP POLICY IF EXISTS qase_runs_raw_select_client ON public.qase_runs_raw;
DROP POLICY IF EXISTS qase_runs_raw_insert_client ON public.qase_runs_raw;
DROP POLICY IF EXISTS qase_runs_raw_update_client ON public.qase_runs_raw;
DROP POLICY IF EXISTS qase_runs_raw_delete_client ON public.qase_runs_raw;
CREATE POLICY qase_runs_raw_select_client ON public.qase_runs_raw
  FOR SELECT
  TO authenticated
  USING ( company_id = public.get_current_client_id() );

CREATE POLICY qase_runs_raw_insert_client ON public.qase_runs_raw
  FOR INSERT
  TO authenticated
  WITH CHECK ( company_id = public.get_current_client_id() );

CREATE POLICY qase_runs_raw_update_client ON public.qase_runs_raw
  FOR UPDATE
  TO authenticated
  USING ( company_id = public.get_current_client_id() )
  WITH CHECK ( company_id = public.get_current_client_id() );

CREATE POLICY qase_runs_raw_delete_client ON public.qase_runs_raw
  FOR DELETE
  TO authenticated
  USING ( company_id = public.get_current_client_id() );

-- qase_results_raw
DROP POLICY IF EXISTS qase_results_raw_select_client ON public.qase_results_raw;
DROP POLICY IF EXISTS qase_results_raw_insert_client ON public.qase_results_raw;
DROP POLICY IF EXISTS qase_results_raw_update_client ON public.qase_results_raw;
DROP POLICY IF EXISTS qase_results_raw_delete_client ON public.qase_results_raw;
CREATE POLICY qase_results_raw_select_client ON public.qase_results_raw
  FOR SELECT
  TO authenticated
  USING ( company_id = public.get_current_client_id() );

CREATE POLICY qase_results_raw_insert_client ON public.qase_results_raw
  FOR INSERT
  TO authenticated
  WITH CHECK ( company_id = public.get_current_client_id() );

CREATE POLICY qase_results_raw_update_client ON public.qase_results_raw
  FOR UPDATE
  TO authenticated
  USING ( company_id = public.get_current_client_id() )
  WITH CHECK ( company_id = public.get_current_client_id() );

CREATE POLICY qase_results_raw_delete_client ON public.qase_results_raw
  FOR DELETE
  TO authenticated
  USING ( company_id = public.get_current_client_id() );

-- qase_milestones_raw
DROP POLICY IF EXISTS qase_milestones_raw_select_client ON public.qase_milestones_raw;
DROP POLICY IF EXISTS qase_milestones_raw_insert_client ON public.qase_milestones_raw;
DROP POLICY IF EXISTS qase_milestones_raw_update_client ON public.qase_milestones_raw;
DROP POLICY IF EXISTS qase_milestones_raw_delete_client ON public.qase_milestones_raw;
CREATE POLICY qase_milestones_raw_select_client ON public.qase_milestones_raw
  FOR SELECT
  TO authenticated
  USING ( company_id = public.get_current_client_id() );

CREATE POLICY qase_milestones_raw_insert_client ON public.qase_milestones_raw
  FOR INSERT
  TO authenticated
  WITH CHECK ( company_id = public.get_current_client_id() );

CREATE POLICY qase_milestones_raw_update_client ON public.qase_milestones_raw
  FOR UPDATE
  TO authenticated
  USING ( company_id = public.get_current_client_id() )
  WITH CHECK ( company_id = public.get_current_client_id() );

CREATE POLICY qase_milestones_raw_delete_client ON public.qase_milestones_raw
  FOR DELETE
  TO authenticated
  USING ( company_id = public.get_current_client_id() );

-- run_metrics: read-only for authenticated (writes blocked)
DROP POLICY IF EXISTS run_metrics_select_client ON public.run_metrics;
DROP POLICY IF EXISTS run_metrics_insert_block ON public.run_metrics;
DROP POLICY IF EXISTS run_metrics_update_block ON public.run_metrics;
DROP POLICY IF EXISTS run_metrics_delete_block ON public.run_metrics;
CREATE POLICY run_metrics_select_client ON public.run_metrics
  FOR SELECT
  TO authenticated
  USING ( company_id = public.get_current_client_id() );

CREATE POLICY run_metrics_insert_block ON public.run_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK ( false );

CREATE POLICY run_metrics_update_block ON public.run_metrics
  FOR UPDATE
  TO authenticated
  USING ( false );

CREATE POLICY run_metrics_delete_block ON public.run_metrics
  FOR DELETE
  TO authenticated
  USING ( false );

-- company_quality_metrics: read-only
DROP POLICY IF EXISTS company_quality_metrics_select_client ON public.company_quality_metrics;
DROP POLICY IF EXISTS company_quality_metrics_insert_block ON public.company_quality_metrics;
DROP POLICY IF EXISTS company_quality_metrics_update_block ON public.company_quality_metrics;
DROP POLICY IF EXISTS company_quality_metrics_delete_block ON public.company_quality_metrics;
CREATE POLICY company_quality_metrics_select_client ON public.company_quality_metrics
  FOR SELECT
  TO authenticated
  USING ( company_id = public.get_current_client_id() );

CREATE POLICY company_quality_metrics_insert_block ON public.company_quality_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK ( false );

CREATE POLICY company_quality_metrics_update_block ON public.company_quality_metrics
  FOR UPDATE
  TO authenticated
  USING ( false );

CREATE POLICY company_quality_metrics_delete_block ON public.company_quality_metrics
  FOR DELETE
  TO authenticated
  USING ( false );

-- quality_gate_results
DROP POLICY IF EXISTS quality_gate_results_select_client ON public.quality_gate_results;
DROP POLICY IF EXISTS quality_gate_results_insert_block ON public.quality_gate_results;
DROP POLICY IF EXISTS quality_gate_results_update_block ON public.quality_gate_results;
DROP POLICY IF EXISTS quality_gate_results_delete_block ON public.quality_gate_results;
CREATE POLICY quality_gate_results_select_client ON public.quality_gate_results
  FOR SELECT
  TO authenticated
  USING ( company_id = public.get_current_client_id() );

CREATE POLICY quality_gate_results_insert_block ON public.quality_gate_results
  FOR INSERT
  TO authenticated
  WITH CHECK ( false );

CREATE POLICY quality_gate_results_update_block ON public.quality_gate_results
  FOR UPDATE
  TO authenticated
  USING ( false );

CREATE POLICY quality_gate_results_delete_block ON public.quality_gate_results
  FOR DELETE
  TO authenticated
  USING ( false );

-- company_integrations: block authenticated reads, allow insert if company matches
DROP POLICY IF EXISTS company_integrations_select_restricted ON public.company_integrations;
DROP POLICY IF EXISTS company_integrations_insert_client ON public.company_integrations;
DROP POLICY IF EXISTS company_integrations_update_block ON public.company_integrations;
DROP POLICY IF EXISTS company_integrations_delete_block ON public.company_integrations;
CREATE POLICY company_integrations_select_restricted ON public.company_integrations
  FOR SELECT
  TO authenticated
  USING ( false );

CREATE POLICY company_integrations_insert_client ON public.company_integrations
  FOR INSERT
  TO authenticated
  WITH CHECK ( company_id = public.get_current_client_id() );

CREATE POLICY company_integrations_update_block ON public.company_integrations
  FOR UPDATE
  TO authenticated
  USING ( false );

CREATE POLICY company_integrations_delete_block ON public.company_integrations
  FOR DELETE
  TO authenticated
  USING ( false );

-- Verification
-- SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('qase_defects','run_metrics','company_integrations');

-- Rollback
-- DROP POLICY qase_defects_select_client ON public.qase_defects;
-- ... (repeat for all created policies)
