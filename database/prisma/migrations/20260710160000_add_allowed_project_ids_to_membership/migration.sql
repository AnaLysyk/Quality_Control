-- Add per-membership project scoping so company_user/testing_company_user can be
-- restricted to specific projects within a company. Empty array = no restriction
-- (keeps current behavior for every existing membership).

ALTER TABLE "memberships"
  ADD COLUMN IF NOT EXISTS "allowedProjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
