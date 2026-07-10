-- Per-project integration identifiers (Jira project key / Qase project code) and a
-- manual-creation toggle for projects that only want to consume Qase/Jira integration
-- data. Company-level credentials (token/base URL) are unchanged and still shared.

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "qaseProjectCode" TEXT,
  ADD COLUMN IF NOT EXISTS "jiraProjectKey" TEXT,
  ADD COLUMN IF NOT EXISTS "manualCreationDisabled" BOOLEAN DEFAULT false;
