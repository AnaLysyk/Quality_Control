CREATE TABLE IF NOT EXISTS "project_team_assignments" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdBy" TEXT NOT NULL,
  "removedBy" TEXT,
  "removedAt" TIMESTAMP(3),
  "removalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_team_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_team_assignments_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_team_assignments_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_team_assignments_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "project_team_assignments_userId_idx"
  ON "project_team_assignments"("userId");
CREATE INDEX IF NOT EXISTS "project_team_assignments_companyId_idx"
  ON "project_team_assignments"("companyId");
CREATE INDEX IF NOT EXISTS "project_team_assignments_projectId_idx"
  ON "project_team_assignments"("projectId");
CREATE INDEX IF NOT EXISTS "project_team_assignments_projectId_role_status_idx"
  ON "project_team_assignments"("projectId", "role", "status");
CREATE INDEX IF NOT EXISTS "project_team_assignments_companyId_status_idx"
  ON "project_team_assignments"("companyId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "project_team_assignments_active_leader_key"
  ON "project_team_assignments"("projectId")
  WHERE "role" = 'leader_tc' AND "status" = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS "project_team_assignments_active_member_key"
  ON "project_team_assignments"("userId", "projectId", "role")
  WHERE "status" = 'active';
