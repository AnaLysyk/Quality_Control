-- 17_fix_cliente_enums.sql
-- Ensure the cliente table uses explicit enums so that Supabase can
-- build the schema without hitting the "USER-DEFINED" syntax error.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cliente_integration_type') THEN
    CREATE TYPE cliente_integration_type AS ENUM ('none', 'qase', 'jira', 'manual', 'other');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cliente_status_type') THEN
    CREATE TYPE cliente_status_type AS ENUM ('active', 'inactive');
  END IF;
END$$;

ALTER TABLE public.cliente
  ALTER COLUMN IF EXISTS integration_type
    TYPE cliente_integration_type
    USING integration_type::text::cliente_integration_type,
  ALTER COLUMN IF EXISTS integration_type
    SET DEFAULT 'none'::cliente_integration_type,
  ALTER COLUMN IF EXISTS status
    TYPE cliente_status_type
    USING status::text::cliente_status_type,
  ALTER COLUMN IF EXISTS status
    SET DEFAULT 'active'::cliente_status_type;
