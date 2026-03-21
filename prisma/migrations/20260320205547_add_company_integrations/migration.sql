-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('QASE', 'JIRA', 'MANUAL', 'OTHER');

-- CreateTable
CREATE TABLE "company_integrations" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_integrations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "company_integrations" ADD CONSTRAINT "company_integrations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
