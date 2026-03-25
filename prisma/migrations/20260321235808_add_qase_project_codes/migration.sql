-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "qase_project_codes" TEXT[] DEFAULT ARRAY[]::TEXT[];
