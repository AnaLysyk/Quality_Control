-- 14_regra_mae_empresa_obrigatoria.sql
-- Enforça a REGRA-MÃE: ninguém acessa sem empresa.
--
-- Objetivo prático:
-- - Todo usuário APP ativo deve ter empresa (client_id) e vínculo em user_clients.
-- - Apenas Global Admin cria empresas/usuários/vínculos.
-- - Empresa/usuário só operam (runs/defeitos/etc.).
--
-- Observação: este script é compatível com o modelo já usado pelo app:
-- tables: cliente, users (com auth_user_id), user_clients (para múltiplos vínculos).

BEGIN;

-- =============================
-- 1) Garantias mínimas de tabela/colunas
-- =============================

-- cliente (empresa)
CREATE TABLE IF NOT EXISTS public.cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  company_name text,
  name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- users (usuário app, não confundir com auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE,
  email text,
  name text,
  role text,
  client_id uuid NULL REFERENCES public.cliente(id),
  is_global_admin boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- user_clients (vínculo usuário <-> empresa)
CREATE TABLE IF NOT EXISTS public.user_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL REFERENCES public.users(id) ON DELETE CASCADE,
  auth_user_id uuid NULL,
  client_id uuid NOT NULL REFERENCES public.cliente(id) ON DELETE CASCADE,
  client_slug text NULL,
  role text NULL,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure idempotent inserts (used by the sync trigger below).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_clients_user_client_unique'
  ) THEN
    ALTER TABLE public.user_clients
      ADD CONSTRAINT user_clients_user_client_unique UNIQUE (user_id, client_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_clients_auth_user_client_unique'
  ) THEN
    ALTER TABLE public.user_clients
      ADD CONSTRAINT user_clients_auth_user_client_unique UNIQUE (auth_user_id, client_id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS user_clients_client_id_idx ON public.user_clients (client_id);
CREATE INDEX IF NOT EXISTS user_clients_auth_user_id_idx ON public.user_clients (auth_user_id);
CREATE INDEX IF NOT EXISTS user_clients_user_id_idx ON public.user_clients (user_id);

-- =============================
-- 2) Constraint: usuário ativo precisa ter empresa
-- =============================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_active_requires_client'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_active_requires_client
      CHECK (active = false OR client_id IS NOT NULL);
  END IF;
END$$;

-- =============================
-- 3) Sync automático do vínculo primário
-- =============================

-- Sempre que um usuário ativo tiver client_id, garante um vínculo ativo em user_clients.
CREATE OR REPLACE FUNCTION public.sync_primary_user_client()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.active = true AND NEW.client_id IS NOT NULL THEN
    INSERT INTO public.user_clients (user_id, auth_user_id, client_id, active, is_default)
    VALUES (NEW.id, NEW.auth_user_id, NEW.client_id, true, true)
    ON CONFLICT (user_id, client_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_sync_primary_user_client'
  ) THEN
    CREATE TRIGGER trg_sync_primary_user_client
    AFTER INSERT OR UPDATE OF client_id, active
    ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_primary_user_client();
  END IF;
END$$;

-- =============================
-- 4) Preenche client_slug em user_clients
-- =============================

CREATE OR REPLACE FUNCTION public.fill_user_clients_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_slug text;
BEGIN
  SELECT c.slug INTO v_slug FROM public.cliente c WHERE c.id = NEW.client_id;
  IF v_slug IS NOT NULL THEN
    NEW.client_slug := v_slug;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_fill_user_clients_slug'
  ) THEN
    CREATE TRIGGER trg_fill_user_clients_slug
    BEFORE INSERT OR UPDATE OF client_id
    ON public.user_clients
    FOR EACH ROW
    EXECUTE FUNCTION public.fill_user_clients_slug();
  END IF;
END$$;

-- =============================
-- 5) RLS (opcional, recomendado)
-- =============================
-- A app normalmente acessa via service_role nas API routes; ainda assim, estas políticas
-- ajudam quando alguma leitura for feita com anon/authenticated.

ALTER TABLE public.cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_clients ENABLE ROW LEVEL SECURITY;

-- Helper: identifica global admin pelo auth.uid() -> public.users
CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid() AND u.active = true AND u.is_global_admin = true
  );
$$;

-- cliente: global admin vê tudo; demais só as empresas vinculadas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cliente_select_scoped') THEN
    CREATE POLICY cliente_select_scoped
      ON public.cliente
      FOR SELECT
      USING (
        public.is_global_admin() OR EXISTS (
          SELECT 1 FROM public.user_clients uc
          WHERE uc.active = true
            AND uc.client_id = cliente.id
            AND (uc.auth_user_id = auth.uid())
        )
      );
  END IF;
END$$;

-- users: global admin vê tudo; usuário vê apenas seu registro
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_select_self_or_admin') THEN
    CREATE POLICY users_select_self_or_admin
      ON public.users
      FOR SELECT
      USING (public.is_global_admin() OR auth_user_id = auth.uid());
  END IF;
END$$;

-- user_clients: global admin vê tudo; usuário vê apenas seus vínculos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_clients_select_self_or_admin') THEN
    CREATE POLICY user_clients_select_self_or_admin
      ON public.user_clients
      FOR SELECT
      USING (public.is_global_admin() OR auth_user_id = auth.uid());
  END IF;
END$$;

COMMIT;
