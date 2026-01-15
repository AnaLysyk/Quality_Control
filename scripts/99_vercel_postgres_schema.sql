-- 99_vercel_postgres_schema.sql
-- Minimal schema for the Next.js app repositories using @vercel/postgres.
--
-- Target: your Vercel Postgres / Neon database (POSTGRES_URL).
-- Safe to run multiple times.

BEGIN;

-- UUID helper (Neon/Postgres)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Companies
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text NULL,
  description text NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_created_at_idx ON public.clients (created_at DESC);

-- App users (not supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NULL UNIQUE,
  email text NOT NULL,
  name text NULL,
  password_hash text NULL,
  avatar_url text NULL,
  is_global_admin boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_created_at_idx ON public.users (created_at DESC);
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (lower(trim(email)));

-- User <-> client links (RBAC scope)
CREATE TABLE IF NOT EXISTS public.user_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  role text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_clients_user_client_unique'
  ) THEN
    ALTER TABLE public.user_clients
      ADD CONSTRAINT user_clients_user_client_unique UNIQUE (user_id, client_id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS user_clients_client_id_idx ON public.user_clients (client_id);
CREATE INDEX IF NOT EXISTS user_clients_user_id_idx ON public.user_clients (user_id);

COMMIT;
