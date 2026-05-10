-- Expand user_company_links with explicit metadata fields for Profile Engine

ALTER TABLE "user_company_links"
  ADD COLUMN IF NOT EXISTS "roleInCompany" TEXT,
  ADD COLUMN IF NOT EXISTS "allowedApplicationIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "allowedModuleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "linkedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "linkedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

UPDATE "user_company_links"
SET
  "status" = CASE WHEN COALESCE("active", true) THEN 'active' ELSE 'inactive' END,
  "linkedAt" = COALESCE("linkedAt", CURRENT_TIMESTAMP),
  "createdAt" = COALESCE("createdAt", CURRENT_TIMESTAMP),
  "updatedAt" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE
  "status" IS NULL
  OR "linkedAt" IS NULL
  OR "createdAt" IS NULL
  OR "updatedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "user_company_links_status_idx" ON "user_company_links"("status");
CREATE INDEX IF NOT EXISTS "user_company_links_linkedBy_idx" ON "user_company_links"("linkedBy");
CREATE INDEX IF NOT EXISTS "user_company_links_updatedBy_idx" ON "user_company_links"("updatedBy");
