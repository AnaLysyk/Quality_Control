CREATE TABLE IF NOT EXISTS "brain_source_configs" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sourceType" TEXT NOT NULL,
  "provider" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "scopeType" TEXT NOT NULL DEFAULT 'global',
  "companyId" TEXT,
  "companySlug" TEXT,
  "projectId" TEXT,
  "projectSlug" TEXT,
  "ownerUserId" TEXT,
  "allowedRoles" JSONB,
  "allowedUsers" JSONB,
  "requiredPermission" TEXT,
  "environment" TEXT NOT NULL DEFAULT 'dev',
  "priority" INTEGER NOT NULL DEFAULT 50,
  "useForCompanyContext" BOOLEAN NOT NULL DEFAULT false,
  "useForGeneralQuestions" BOOLEAN NOT NULL DEFAULT true,
  "useForRagIngestion" BOOLEAN NOT NULL DEFAULT false,
  "useForLiveQuery" BOOLEAN NOT NULL DEFAULT false,
  "config" JSONB NOT NULL DEFAULT '{}',
  "lastSyncAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "lastErrorAt" TIMESTAMP(3),
  "lastErrorMessage" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brain_source_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "brain_source_secrets" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT,
  "maskedValue" TEXT,
  "encryptedValue" TEXT NOT NULL,
  "encryptionHint" TEXT,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brain_source_secrets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "brain_source_audit_logs" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "userId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brain_source_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "brain_source_sync_logs" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'test',
  "status" TEXT NOT NULL,
  "message" TEXT,
  "metadata" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brain_source_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "brain_source_configs_sourceType_idx" ON "brain_source_configs"("sourceType");
CREATE INDEX IF NOT EXISTS "brain_source_configs_status_idx" ON "brain_source_configs"("status");
CREATE INDEX IF NOT EXISTS "brain_source_configs_scopeType_idx" ON "brain_source_configs"("scopeType");
CREATE INDEX IF NOT EXISTS "brain_source_configs_companyId_idx" ON "brain_source_configs"("companyId");
CREATE INDEX IF NOT EXISTS "brain_source_configs_companySlug_idx" ON "brain_source_configs"("companySlug");
CREATE INDEX IF NOT EXISTS "brain_source_configs_projectId_idx" ON "brain_source_configs"("projectId");
CREATE INDEX IF NOT EXISTS "brain_source_configs_ownerUserId_idx" ON "brain_source_configs"("ownerUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "brain_source_secrets_sourceId_key_key" ON "brain_source_secrets"("sourceId", "key");
CREATE INDEX IF NOT EXISTS "brain_source_secrets_sourceId_idx" ON "brain_source_secrets"("sourceId");
CREATE INDEX IF NOT EXISTS "brain_source_audit_logs_sourceId_idx" ON "brain_source_audit_logs"("sourceId");
CREATE INDEX IF NOT EXISTS "brain_source_audit_logs_action_idx" ON "brain_source_audit_logs"("action");
CREATE INDEX IF NOT EXISTS "brain_source_audit_logs_createdAt_idx" ON "brain_source_audit_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "brain_source_sync_logs_sourceId_idx" ON "brain_source_sync_logs"("sourceId");
CREATE INDEX IF NOT EXISTS "brain_source_sync_logs_status_idx" ON "brain_source_sync_logs"("status");
CREATE INDEX IF NOT EXISTS "brain_source_sync_logs_kind_idx" ON "brain_source_sync_logs"("kind");
CREATE INDEX IF NOT EXISTS "brain_source_sync_logs_createdAt_idx" ON "brain_source_sync_logs"("createdAt");

ALTER TABLE "brain_source_secrets"
  ADD CONSTRAINT "brain_source_secrets_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "brain_source_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "brain_source_audit_logs"
  ADD CONSTRAINT "brain_source_audit_logs_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "brain_source_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "brain_source_sync_logs"
  ADD CONSTRAINT "brain_source_sync_logs_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "brain_source_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
