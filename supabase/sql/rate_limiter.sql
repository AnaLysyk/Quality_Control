-- Creates a shared rate limiter table for Edge Functions.
-- Run with: supabase db execute --file supabase/sql/rate_limiter.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.rate_limiter (
  key text PRIMARY KEY,
  last_hit timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limiter ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage entries; deny anon access by default.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rate_limiter'
      AND policyname = 'rate_limiter_service_role_manage'
  ) THEN
    CREATE POLICY rate_limiter_service_role_manage
      ON public.rate_limiter
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END$$;

COMMIT;
