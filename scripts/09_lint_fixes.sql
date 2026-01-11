-- 09_lint_fixes.sql
-- Remediate Supabase lint findings:
-- - 0010 security_definer_view on recent_support_requests_last_30_days and user_profiles
-- - 0013 rls_disabled_in_public on quality_gate_policy

-- Set views to SECURITY INVOKER so they respect caller RLS instead of the view owner.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'recent_support_requests_last_30_days'
  ) THEN
    RAISE NOTICE 'Setting SECURITY INVOKER on public.recent_support_requests_last_30_days';
    EXECUTE 'ALTER VIEW public.recent_support_requests_last_30_days SET (security_invoker = true)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_views
    WHERE schemaname = 'public' AND viewname = 'user_profiles'
  ) THEN
    RAISE NOTICE 'Setting SECURITY INVOKER on public.user_profiles';
    EXECUTE 'ALTER VIEW public.user_profiles SET (security_invoker = true)';
  END IF;
END
$$ LANGUAGE plpgsql;

-- Enable RLS on public.quality_gate_policy and add a safe policy set.
DO $$
DECLARE
  has_company_id boolean;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'quality_gate_policy'
      AND c.relkind = 'r'
  ) THEN
    EXECUTE 'ALTER TABLE public.quality_gate_policy ENABLE ROW LEVEL SECURITY';

    -- Clear any previous policies that might conflict.
    EXECUTE 'DROP POLICY IF EXISTS quality_gate_policy_select_client ON public.quality_gate_policy';
    EXECUTE 'DROP POLICY IF EXISTS quality_gate_policy_insert_client ON public.quality_gate_policy';
    EXECUTE 'DROP POLICY IF EXISTS quality_gate_policy_update_client ON public.quality_gate_policy';
    EXECUTE 'DROP POLICY IF EXISTS quality_gate_policy_delete_client ON public.quality_gate_policy';
    EXECUTE 'DROP POLICY IF EXISTS quality_gate_policy_select_block ON public.quality_gate_policy';
    EXECUTE 'DROP POLICY IF EXISTS quality_gate_policy_modify_block ON public.quality_gate_policy';

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'quality_gate_policy'
        AND column_name = 'company_id'
    ) INTO has_company_id;

    IF has_company_id THEN
      EXECUTE $policy$
        CREATE POLICY quality_gate_policy_select_client ON public.quality_gate_policy
          FOR SELECT
          TO authenticated
          USING (company_id = public.get_current_client_id())
      $policy$;

      EXECUTE $policy$
        CREATE POLICY quality_gate_policy_insert_client ON public.quality_gate_policy
          FOR INSERT
          TO authenticated
          WITH CHECK (company_id = public.get_current_client_id())
      $policy$;

      EXECUTE $policy$
        CREATE POLICY quality_gate_policy_update_client ON public.quality_gate_policy
          FOR UPDATE
          TO authenticated
          USING (company_id = public.get_current_client_id())
          WITH CHECK (company_id = public.get_current_client_id())
      $policy$;

      EXECUTE $policy$
        CREATE POLICY quality_gate_policy_delete_client ON public.quality_gate_policy
          FOR DELETE
          TO authenticated
          USING (company_id = public.get_current_client_id())
      $policy$;
    ELSE
      -- If we cannot scope by company_id yet, block authenticated access to stay safe.
      EXECUTE $policy$
        CREATE POLICY quality_gate_policy_select_block ON public.quality_gate_policy
          FOR SELECT
          TO authenticated
          USING (false)
      $policy$;

      EXECUTE $policy$
        CREATE POLICY quality_gate_policy_modify_block ON public.quality_gate_policy
          FOR ALL
          TO authenticated
          USING (false)
          WITH CHECK (false)
      $policy$;
    END IF;
  END IF;
END
$$ LANGUAGE plpgsql;
