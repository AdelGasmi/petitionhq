-- Verification fields on Lead (V1.1)

-- CreateEnum
CREATE TYPE "LeadMaturity" AS ENUM ('M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "maturity"        "LeadMaturity" NOT NULL DEFAULT 'M0';
ALTER TABLE "Lead" ADD COLUMN "trustScore"      INTEGER        NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD COLUMN "verifiedClaims"  JSONB;
ALTER TABLE "Lead" ADD COLUMN "maturityHistory" JSONB;
ALTER TABLE "Lead" ADD COLUMN "lastVerifiedAt"  TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Lead_maturity_idx" ON "Lead"("maturity");
