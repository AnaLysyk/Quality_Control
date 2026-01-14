-- 16_support_requests_global_admins_security.sql
-- Addresses common Supabase Security Advisor findings for new admin/support tables:
-- - Enable RLS
-- - Add safe policies
-- - Keep global admin check compatible with both `global_admins` (new) and `users.is_global_admin` (legacy)

-- 1) Robust global admin predicate.
-- SECURITY DEFINER + row_security=off avoids RLS recursion when policies call this function.
CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
BEGIN
  -- New source of truth: public.global_admins
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'global_admins'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.global_admins ga
      WHERE ga.user_id = auth.uid()
    ) THEN
      RETURN true;
    END IF;
  END IF;

  -- Legacy fallback: public.users flags
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name IN ('auth_user_id', 'is_global_admin')
  ) THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.auth_user_id = auth.uid()
        AND (u.active IS DISTINCT FROM false)
        AND u.is_global_admin = true
    );
  END IF;

  RETURN false;
END;
$$;

-- 2) RLS + policies for public.global_admins
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'global_admins'
  ) THEN
    EXECUTE 'ALTER TABLE public.global_admins ENABLE ROW LEVEL SECURITY';

    -- Ensure there is at least one safe policy.
    EXECUTE 'DROP POLICY IF EXISTS global_admins_admin_all ON public.global_admins';
    EXECUTE $policy$
      CREATE POLICY global_admins_admin_all
        ON public.global_admins
        FOR ALL
        TO authenticated
        USING (public.is_global_admin())
        WITH CHECK (public.is_global_admin())
    $policy$;

    -- RLS policies are not enough by themselves: PostgREST also requires GRANTs.
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.global_admins TO authenticated';
  END IF;
END
$$;

-- 3) RLS + policies for public.support_requests
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'support_requests'
  ) THEN
    EXECUTE 'ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY';

    -- Keep direct client-side access blocked unless explicitly allowed.
    EXECUTE 'DROP POLICY IF EXISTS support_requests_admin_select ON public.support_requests';
    EXECUTE 'DROP POLICY IF EXISTS support_requests_admin_update ON public.support_requests';
    EXECUTE 'DROP POLICY IF EXISTS support_requests_admin_delete ON public.support_requests';

    EXECUTE $policy$
      CREATE POLICY support_requests_admin_select
        ON public.support_requests
        FOR SELECT
        TO authenticated
        USING (public.is_global_admin())
    $policy$;

    EXECUTE $policy$
      CREATE POLICY support_requests_admin_update
        ON public.support_requests
        FOR UPDATE
        TO authenticated
        USING (public.is_global_admin())
        WITH CHECK (public.is_global_admin())
    $policy$;

    EXECUTE $policy$
      CREATE POLICY support_requests_admin_delete
        ON public.support_requests
        FOR DELETE
        TO authenticated
        USING (public.is_global_admin())
    $policy$;

    -- Match GRANTs to policies (admin-only via RLS).
    EXECUTE 'GRANT SELECT, UPDATE, DELETE ON public.support_requests TO authenticated';
  END IF;
END
$$;

-- 4) If a helper view exists, make sure it evaluates permissions/RLS as the invoker.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = 'global_admins_view'
  ) THEN
    EXECUTE 'ALTER VIEW public.global_admins_view SET (security_invoker = true)';
    EXECUTE 'GRANT SELECT ON public.global_admins_view TO authenticated';
  END IF;
END
$$;
