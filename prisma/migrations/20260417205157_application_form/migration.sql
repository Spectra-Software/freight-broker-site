/*
  Warnings:

  - You are about to drop the column `firstName` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `smtpEmail` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `smtpName` on the `User` table. All the data in the column will be lost.
  - The `plan` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `comments` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `desiredPlan` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Application` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('BASIC', 'MID', 'PREMIUM');

-- AlterTable
ALTER TABLE "Application" DROP COLUMN "firstName",
DROP COLUMN "lastName",
DROP COLUMN "phone",
DROP COLUMN "plan",
ADD COLUMN     "comments" TEXT NOT NULL,
ADD COLUMN     "desiredPlan" "PlanTier" NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "smtpEmail",
DROP COLUMN "smtpName",
DROP COLUMN "plan",
ADD COLUMN     "plan" "PlanTier" NOT NULL DEFAULT 'BASIC';

-- DropEnum
DROP TYPE "Plan";

-- CreateIndex
CREATE INDEX "Application_email_idx" ON "Application"("email");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");
