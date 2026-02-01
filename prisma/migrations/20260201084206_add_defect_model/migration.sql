-- CreateTable
CREATE TABLE "Defect" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" UUID NOT NULL,
    "releaseManualId" UUID,

    CONSTRAINT "Defect_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_releaseManualId_fkey" FOREIGN KEY ("releaseManualId") REFERENCES "ReleaseManual"("id") ON DELETE SET NULL ON UPDATE CASCADE;
