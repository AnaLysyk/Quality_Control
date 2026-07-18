-- AlterTable
ALTER TABLE "BrainNode"
ADD COLUMN "importanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "privacyLevel" TEXT NOT NULL DEFAULT 'company',
ADD COLUMN "confidenceLevel" DOUBLE PRECISION NOT NULL DEFAULT 0.8;

-- CreateTable
CREATE TABLE "BrainSuggestion" (
    "id" TEXT NOT NULL,
    "companySlug" TEXT,
    "projectId" TEXT,
    "targetNodeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "riskLevel" TEXT NOT NULL DEFAULT 'medium',
    "requiresReview" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrainSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainInboxItem" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "companySlug" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "payload" JSONB,
    "suggestionId" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrainInboxItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainWorkspace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companySlug" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrainWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainWorkspaceNode" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brainNodeId" TEXT,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrainWorkspaceNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainWorkspaceEdge" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrainWorkspaceEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainSavedView" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'graph',
    "filters" JSONB,
    "layout" JSONB,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrainSavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainRetentionPolicy" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "eventDays" INTEGER NOT NULL DEFAULT 90,
    "agentRunDays" INTEGER NOT NULL DEFAULT 90,
    "rejectedMemoryDays" INTEGER NOT NULL DEFAULT 30,
    "heavyArtifactDays" INTEGER NOT NULL DEFAULT 30,
    "staleMemoryDays" INTEGER NOT NULL DEFAULT 30,
    "weeklyReviewEnabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrainRetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrainNode_privacyLevel_idx" ON "BrainNode"("privacyLevel");

-- CreateIndex
CREATE INDEX "BrainNode_importanceScore_idx" ON "BrainNode"("importanceScore");

-- CreateIndex
CREATE INDEX "BrainNode_riskScore_idx" ON "BrainNode"("riskScore");

-- CreateIndex
CREATE INDEX "BrainNode_qualityScore_idx" ON "BrainNode"("qualityScore");

-- CreateIndex
CREATE INDEX "BrainSuggestion_companySlug_idx" ON "BrainSuggestion"("companySlug");

-- CreateIndex
CREATE INDEX "BrainSuggestion_targetNodeId_idx" ON "BrainSuggestion"("targetNodeId");

-- CreateIndex
CREATE INDEX "BrainSuggestion_status_idx" ON "BrainSuggestion"("status");

-- CreateIndex
CREATE INDEX "BrainSuggestion_type_idx" ON "BrainSuggestion"("type");

-- CreateIndex
CREATE INDEX "BrainInboxItem_companySlug_idx" ON "BrainInboxItem"("companySlug");

-- CreateIndex
CREATE INDEX "BrainInboxItem_status_idx" ON "BrainInboxItem"("status");

-- CreateIndex
CREATE INDEX "BrainInboxItem_kind_idx" ON "BrainInboxItem"("kind");

-- CreateIndex
CREATE INDEX "BrainWorkspace_userId_idx" ON "BrainWorkspace"("userId");

-- CreateIndex
CREATE INDEX "BrainWorkspace_companySlug_idx" ON "BrainWorkspace"("companySlug");

-- CreateIndex
CREATE INDEX "BrainWorkspace_status_idx" ON "BrainWorkspace"("status");

-- CreateIndex
CREATE INDEX "BrainWorkspaceNode_workspaceId_idx" ON "BrainWorkspaceNode"("workspaceId");

-- CreateIndex
CREATE INDEX "BrainWorkspaceNode_brainNodeId_idx" ON "BrainWorkspaceNode"("brainNodeId");

-- CreateIndex
CREATE INDEX "BrainWorkspaceEdge_workspaceId_idx" ON "BrainWorkspaceEdge"("workspaceId");

-- CreateIndex
CREATE INDEX "BrainWorkspaceEdge_fromNodeId_idx" ON "BrainWorkspaceEdge"("fromNodeId");

-- CreateIndex
CREATE INDEX "BrainWorkspaceEdge_toNodeId_idx" ON "BrainWorkspaceEdge"("toNodeId");

-- CreateIndex
CREATE INDEX "BrainSavedView_workspaceId_idx" ON "BrainSavedView"("workspaceId");

-- CreateIndex
CREATE INDEX "BrainSavedView_mode_idx" ON "BrainSavedView"("mode");

-- CreateIndex
CREATE UNIQUE INDEX "BrainRetentionPolicy_scope_key" ON "BrainRetentionPolicy"("scope");

-- CreateIndex
CREATE INDEX "BrainRetentionPolicy_scope_idx" ON "BrainRetentionPolicy"("scope");

-- AddForeignKey
ALTER TABLE "BrainSuggestion" ADD CONSTRAINT "BrainSuggestion_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "BrainNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrainInboxItem" ADD CONSTRAINT "BrainInboxItem_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "BrainSuggestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrainWorkspaceNode" ADD CONSTRAINT "BrainWorkspaceNode_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "BrainWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrainWorkspaceEdge" ADD CONSTRAINT "BrainWorkspaceEdge_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "BrainWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrainSavedView" ADD CONSTRAINT "BrainSavedView_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "BrainWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
