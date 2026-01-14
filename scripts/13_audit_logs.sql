-- 13_audit_logs.sql
-- App-level audit log storage (for /admin/audit-logs UI)
--
-- This is independent from the trigger-based audit_log table created in 04_audit_triggers.sql.
-- The Next.js app writes/reads this table via @vercel/postgres (connection string in POSTGRES_URL/DATABASE_URL).
--
-- Retention policy: 60 days.

BEGIN;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id text NULL,
  actor_email text NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NULL,
  entity_label text NULL,
  metadata jsonb NULL
);

-- Indexes for fast sorting/filtering
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx
  ON public.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_action_created_at_idx
  ON public.audit_logs (action, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_actor_email_created_at_idx
  ON public.audit_logs (actor_email, created_at DESC);

-- Best-effort initial cleanup to enforce retention immediately.
DELETE FROM public.audit_logs
WHERE created_at < now() - interval '60 days';

COMMIT;

-- Optional: schedule cleanup in-database via pg_cron (if available on your Supabase plan).
-- Uncomment to enable.
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- DO $$
-- BEGIN
--   -- Remove existing job if any
--   IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'audit_logs_retention_60d') THEN
--     PERFORM cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'audit_logs_retention_60d' LIMIT 1));
--   END IF;
--
--   PERFORM cron.schedule(
--     'audit_logs_retention_60d',
--     '0 3 * * *',
--     $$DELETE FROM public.audit_logs WHERE created_at < now() - interval '60 days';$$
--   );
-- END
-- $$;
