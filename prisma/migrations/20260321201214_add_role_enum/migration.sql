/*
  Warnings:

  - The `role` column on the `memberships` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `updatedAt` on the `ticket_comments` table. All the data in the column will be lost.
  - The `role` column on the `user_companies` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `role` column on the `user_company_links` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `role` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'dev', 'company', 'user', 'support', 'leader_tc', 'technical_support');

-- AlterTable
ALTER TABLE "memberships" DROP COLUMN "role",
ADD COLUMN     "role" "Role" DEFAULT 'user';

-- AlterTable
ALTER TABLE "ticket_comments" DROP COLUMN "updatedAt";

-- AlterTable
ALTER TABLE "user_companies" DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'user';

-- AlterTable
ALTER TABLE "user_company_links" DROP COLUMN "role",
ADD COLUMN     "role" "Role";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "role" "Role" DEFAULT 'user';
