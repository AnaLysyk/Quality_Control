CREATE TABLE IF NOT EXISTS "brain_behavior_profiles" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "instructions" TEXT NOT NULL,
  "tone" TEXT,
  "formality" TEXT,
  "responseLength" TEXT,
  "rules" JSONB,
  "scopeType" TEXT NOT NULL DEFAULT 'user',
  "companyId" TEXT,
  "projectId" TEXT,
  "ownerUserId" TEXT,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'active',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brain_behavior_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "brain_behavior_profile_assignments" (
  "id" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeId" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brain_behavior_profile_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "brain_behavior_profiles_scopeType_idx" ON "brain_behavior_profiles"("scopeType");
CREATE INDEX IF NOT EXISTS "brain_behavior_profiles_companyId_idx" ON "brain_behavior_profiles"("companyId");
CREATE INDEX IF NOT EXISTS "brain_behavior_profiles_projectId_idx" ON "brain_behavior_profiles"("projectId");
CREATE INDEX IF NOT EXISTS "brain_behavior_profiles_ownerUserId_idx" ON "brain_behavior_profiles"("ownerUserId");
CREATE INDEX IF NOT EXISTS "brain_behavior_profiles_status_idx" ON "brain_behavior_profiles"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "brain_behavior_profile_assignments_scopeType_scopeId_surfac_key"
  ON "brain_behavior_profile_assignments"("scopeType", "scopeId", "surface");
CREATE INDEX IF NOT EXISTS "brain_behavior_profile_assignments_profileId_idx" ON "brain_behavior_profile_assignments"("profileId");

ALTER TABLE "brain_behavior_profile_assignments"
  ADD CONSTRAINT "brain_behavior_profile_assignments_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "brain_behavior_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
