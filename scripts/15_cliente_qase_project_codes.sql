-- Add support for multiple Qase project codes per company (multi-app metrics)
-- Safe to run multiple times.

DO $$
BEGIN
  IF to_regclass('public.cliente') IS NOT NULL THEN
    ALTER TABLE public.cliente
      ADD COLUMN IF NOT EXISTS qase_project_codes text[];
  END IF;

  -- Legacy / fallback table name used in some environments
  IF to_regclass('public.clients') IS NOT NULL THEN
    ALTER TABLE public.clients
      ADD COLUMN IF NOT EXISTS qase_project_codes text[];
  END IF;
END $$;
