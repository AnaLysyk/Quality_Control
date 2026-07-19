CREATE TABLE IF NOT EXISTS "brain_provider_configs" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "model" TEXT,
  "models" JSONB,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "dailyRequestLimit" INTEGER,
  "dailyTokenLimit" INTEGER,
  "strictFreeModels" BOOLEAN NOT NULL DEFAULT true,
  "timeoutMs" INTEGER,
  "maxOutputTokens" INTEGER,
  "metadata" JSONB,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brain_provider_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "brain_provider_configs_provider_key" ON "brain_provider_configs"("provider");
CREATE INDEX IF NOT EXISTS "brain_provider_configs_enabled_idx" ON "brain_provider_configs"("enabled");
CREATE INDEX IF NOT EXISTS "brain_provider_configs_priority_idx" ON "brain_provider_configs"("priority");
