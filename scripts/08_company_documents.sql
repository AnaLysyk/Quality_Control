-- 08_company_documents.sql
-- Tabela de documentos da empresa

CREATE TABLE IF NOT EXISTS public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'link', -- link | file (futuro)
  url text NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES public.users(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices básicos
CREATE INDEX IF NOT EXISTS idx_company_documents_company ON public.company_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_created_by ON public.company_documents(created_by_user_id);
