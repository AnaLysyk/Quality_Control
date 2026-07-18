-- CreateTable
CREATE TABLE "kanban_cards" (
    "id" SERIAL NOT NULL,
    "project" TEXT NOT NULL,
    "clientSlug" TEXT,
    "runId" INTEGER,
    "caseId" INTEGER,
    "title" TEXT,
    "status" TEXT,
    "bug" TEXT,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kanban_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defect_history_events" (
    "id" TEXT NOT NULL,
    "defectSlug" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorName" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "fromRunSlug" TEXT,
    "toRunSlug" TEXT,
    "note" TEXT,

    CONSTRAINT "defect_history_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_documents" (
    "id" TEXT NOT NULL,
    "companySlug" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'link',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "createdByName" TEXT,

    CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_history_events" (
    "id" TEXT NOT NULL,
    "companySlug" TEXT NOT NULL,
    "documentId" TEXT,
    "action" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,

    CONSTRAINT "document_history_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "defect_history_events_defectSlug_idx" ON "defect_history_events"("defectSlug");

-- CreateIndex
CREATE INDEX "company_documents_companySlug_idx" ON "company_documents"("companySlug");

-- CreateIndex
CREATE INDEX "document_history_events_companySlug_idx" ON "document_history_events"("companySlug");

-- AddForeignKey
ALTER TABLE "document_history_events" ADD CONSTRAINT "document_history_events_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "company_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
