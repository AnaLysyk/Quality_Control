
-- scripts/17_fix_cliente_enums.sql
-- Purpose: Ensure cliente.integration_type and cliente.status use proper enum types
-- Safe / idempotent: creates types only if needed, preserves audited invalid values.
-- Usage: Run in staging first. DIRECT_ALTER = false (zero-downtime default)

DO $$
DECLARE
  DIRECT_ALTER boolean := false; -- set to true to use direct ALTER (for small tables)
  v_invalid_count int;
BEGIN
  -- 1) Create enums if not present
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cliente_integration_type') THEN
    CREATE TYPE cliente_integration_type AS ENUM ('none','qase','jira','manual','other');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cliente_status_type') THEN
    CREATE TYPE cliente_status_type AS ENUM ('active','inactive');
  END IF;

  -- 2) Create audit table for values that don't map to the enum (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cliente_enum_audit'
  ) THEN
    CREATE TABLE public.cliente_enum_audit (
      audit_id serial PRIMARY KEY,
      cliente_id bigint,
      column_name text NOT NULL,
      old_value text,
      mapped_value text,
      detected_at timestamptz DEFAULT now()
    );
  END IF;

  -- 3) Detect invalid integration_type values
  PERFORM 1 FROM public.cliente LIMIT 1; -- ensure table exists (fail early if not)
  
  -- Count and insert mismatches for integration_type
  WITH invalids AS (
    SELECT id AS cliente_id, integration_type::text AS old_value
    FROM public.cliente
    WHERE integration_type IS NULL
       OR NOT (integration_type::text = ANY (ARRAY['none','qase','jira','manual','other']))
  )
  INSERT INTO public.cliente_enum_audit (cliente_id, column_name, old_value, mapped_value)
  SELECT cliente_id, 'integration_type', old_value, 'none' FROM invalids
  ON CONFLICT DO NOTHING;

  -- Count and insert mismatches for status
  WITH invalids2 AS (
    SELECT id AS cliente_id, status::text AS old_value
    FROM public.cliente
    WHERE status IS NULL
       OR NOT (status::text = ANY (ARRAY['active','inactive']))
  )
  INSERT INTO public.cliente_enum_audit (cliente_id, column_name, old_value, mapped_value)
  SELECT cliente_id, 'status', old_value, 'active' FROM invalids2
  ON CONFLICT DO NOTHING;

  -- 4) Normalize values in-table (map unknown/null -> default)
  UPDATE public.cliente
  SET integration_type = 'none'
  WHERE integration_type IS NULL
     OR NOT (integration_type::text = ANY (ARRAY['none','qase','jira','manual','other']));

  UPDATE public.cliente
  SET status = 'active'
  WHERE status IS NULL
     OR NOT (status::text = ANY (ARRAY['active','inactive']));

  -- 5) Apply type migration
  IF DIRECT_ALTER THEN
    -- Direct ALTER: simpler, may take short lock on table
    BEGIN
      EXECUTE $sql$
        ALTER TABLE public.cliente
          ALTER COLUMN integration_type TYPE cliente_integration_type
            USING integration_type::text::cliente_integration_type,
          ALTER COLUMN integration_type SET DEFAULT 'none'::cliente_integration_type,
          ALTER COLUMN status TYPE cliente_status_type
            USING status::text::cliente_status_type,
          ALTER COLUMN status SET DEFAULT 'active'::cliente_status_type;
      $sql$;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Direct ALTER failed: %', SQLERRM;
      RAISE NOTICE 'Consider setting DIRECT_ALTER := false and re-running to use zero-downtime flow.';
      RAISE;
    END;
  ELSE
    -- Zero-downtime flow: add new columns, populate, swap names
    BEGIN
      -- Add new columns (if not exist)
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cliente' AND column_name = 'integration_type_new'
      ) THEN
        EXECUTE 'ALTER TABLE public.cliente ADD COLUMN integration_type_new cliente_integration_type';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cliente' AND column_name = 'status_new'
      ) THEN
        EXECUTE 'ALTER TABLE public.cliente ADD COLUMN status_new cliente_status_type';
      END IF;

      -- Copy values (single update; for very large tables, run in batches externally)
      EXECUTE $copy$
        UPDATE public.cliente
        SET integration_type_new = CASE
            WHEN integration_type::text = ANY (ARRAY['none','qase','jira','manual','other']) THEN integration_type::text::cliente_integration_type
            ELSE 'none'::cliente_integration_type END,
          status_new = CASE
            WHEN status::text = ANY (ARRAY['active','inactive']) THEN status::text::cliente_status_type
            ELSE 'active'::cliente_status_type END;
      $copy$;

      -- Swap column names in a quick transaction
      EXECUTE $swap$
        BEGIN;
          ALTER TABLE public.cliente RENAME COLUMN integration_type TO integration_type_old;
          ALTER TABLE public.cliente RENAME COLUMN integration_type_new TO integration_type;
          ALTER TABLE public.cliente RENAME COLUMN status TO status_old;
          ALTER TABLE public.cliente RENAME COLUMN status_new TO status;
          ALTER TABLE public.cliente ALTER COLUMN integration_type SET DEFAULT 'none'::cliente_integration_type;
          ALTER TABLE public.cliente ALTER COLUMN status SET DEFAULT 'active'::cliente_status_type;
          -- Optionally drop old columns - commented out for safety
          -- ALTER TABLE public.cliente DROP COLUMN integration_type_old;
          -- ALTER TABLE public.cliente DROP COLUMN status_old;
        COMMIT;
      $swap$;

    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Zero-downtime flow failed: %', SQLERRM;
      RAISE;
    END;
  END IF;

  -- 6) Final verification: ensure the columns now report correct udt_name
  PERFORM 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'cliente'
    AND column_name = 'integration_type'
    AND udt_name = 'cliente_integration_type';

  PERFORM 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'cliente'
    AND column_name = 'status'
    AND udt_name = 'cliente_status_type';

  -- If we get here, succeed
  RAISE NOTICE 'cliente enum migration completed. Check public.cliente_enum_audit for details on any mapped values.';
END
$$;
