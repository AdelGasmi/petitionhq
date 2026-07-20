-- AlterTable: Case — add follow-up scheduling fields
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "nextFollowUp" TIMESTAMP(3);
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "nextAction" TEXT;

-- CreateIndex: Case.nextFollowUp
CREATE INDEX IF NOT EXISTS "Case_nextFollowUp_idx" ON "Case"("nextFollowUp");

-- AlterTable: FirmProfile — add drafting rules JSON
ALTER TABLE "FirmProfile" ADD COLUMN IF NOT EXISTS "draftingRules" JSONB NOT NULL DEFAULT '{}';
