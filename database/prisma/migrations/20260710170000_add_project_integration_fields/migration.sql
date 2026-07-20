-- Per-project integration identifiers (Jira project key / Qase project code) and a
-- manual-creation toggle for projects that only want to consume Qase/Jira integration
-- data. Company-level credentials (token/base URL) are unchanged and still shared.
--
-- Some existing environments already had the projects table before it was represented
-- in the migration history. Fresh databases do not, so create the canonical table first
-- and keep the ALTER statements idempotent for existing installations.

CREATE TABLE IF NOT EXISTS "projects" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "color" TEXT,
  "iconKey" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),
  "archivedById" TEXT,
  "qaseProjectCode" TEXT,
  "jiraProjectKey" TEXT,
  "manualCreationDisabled" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "projects_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "projects_companyId_slug_key"
  ON "projects"("companyId", "slug");
CREATE INDEX IF NOT EXISTS "projects_companyId_idx"
  ON "projects"("companyId");

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "qaseProjectCode" TEXT,
  ADD COLUMN IF NOT EXISTS "jiraProjectKey" TEXT,
  ADD COLUMN IF NOT EXISTS "manualCreationDisabled" BOOLEAN NOT NULL DEFAULT false;
