-- AlterTable
ALTER TABLE "persistent_kv" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "releases" ALTER COLUMN "createdByUserId" SET DATA TYPE TEXT,
ALTER COLUMN "createdByName" SET DATA TYPE TEXT,
ALTER COLUMN "assignedToUserId" SET DATA TYPE TEXT,
ALTER COLUMN "assignedToName" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "BrainNode" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrainNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainEdge" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrainEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainMemory" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "memoryType" TEXT NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 1,
    "relatedNodeIds" JSONB,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "nodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrainMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "userId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrainAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrainNode_type_idx" ON "BrainNode"("type");

-- CreateIndex
CREATE INDEX "BrainNode_refType_refId_idx" ON "BrainNode"("refType", "refId");

-- CreateIndex
CREATE INDEX "BrainNode_label_idx" ON "BrainNode"("label");

-- CreateIndex
CREATE INDEX "BrainEdge_type_idx" ON "BrainEdge"("type");

-- CreateIndex
CREATE INDEX "BrainEdge_fromId_idx" ON "BrainEdge"("fromId");

-- CreateIndex
CREATE INDEX "BrainEdge_toId_idx" ON "BrainEdge"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "BrainEdge_fromId_toId_type_key" ON "BrainEdge"("fromId", "toId", "type");

-- CreateIndex
CREATE INDEX "BrainMemory_memoryType_idx" ON "BrainMemory"("memoryType");

-- CreateIndex
CREATE INDEX "BrainMemory_importance_idx" ON "BrainMemory"("importance");

-- CreateIndex
CREATE INDEX "BrainMemory_status_idx" ON "BrainMemory"("status");

-- CreateIndex
CREATE INDEX "BrainAuditLog_entityType_entityId_idx" ON "BrainAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "BrainAuditLog_action_idx" ON "BrainAuditLog"("action");

-- CreateIndex
CREATE INDEX "BrainAuditLog_createdAt_idx" ON "BrainAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "BrainEdge" ADD CONSTRAINT "BrainEdge_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "BrainNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrainEdge" ADD CONSTRAINT "BrainEdge_toId_fkey" FOREIGN KEY ("toId") REFERENCES "BrainNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrainMemory" ADD CONSTRAINT "BrainMemory_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "BrainNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
