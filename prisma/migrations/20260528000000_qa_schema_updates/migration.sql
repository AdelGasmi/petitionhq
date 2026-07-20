-- CreateEnum
CREATE TYPE "LetterStatus" AS ENUM ('draft', 'pending_review', 'submitted', 'final');

-- CreateEnum
CREATE TYPE "ReviewRequestStatus" AS ENUM ('pending', 'accepted', 'declined');

-- AlterEnum
ALTER TYPE "TokenKind" ADD VALUE 'lead_preview';

-- Drop legacy token columns (superseded by Token table).
-- Dropping the columns also drops their unique constraints and indexes.
ALTER TABLE "Case"
  DROP COLUMN IF EXISTS "guestToken",
  DROP COLUMN IF EXISTS "guestTokenExpiry",
  DROP COLUMN IF EXISTS "intakeEmail",
  DROP COLUMN IF EXISTS "intakeToken",
  DROP COLUMN IF EXISTS "intakeTokenExpiry";

ALTER TABLE "Case" DROP COLUMN "reviewStatus";
ALTER TABLE "Case" ADD COLUMN "reviewStatus" "ReviewRequestStatus";

ALTER TABLE "Case"
  ALTER COLUMN "reviewRequestedAt" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "reviewRespondedAt" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "nextFollowUp" SET DATA TYPE TIMESTAMP(3);

-- AlterTable: Lead — default maturity M0→M1, timestamp precision
ALTER TABLE "Lead"
  ALTER COLUMN "updatedAt" DROP DEFAULT,
  ALTER COLUMN "claimedAt" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "maturity" SET DEFAULT 'M1';

-- AlterTable: Letter — add status column
ALTER TABLE "Letter" ADD COLUMN "status" "LetterStatus" NOT NULL DEFAULT 'draft';

-- CreateIndex (performance)
CREATE INDEX IF NOT EXISTS "Case_attorneyId_idx" ON "Case"("attorneyId");
CREATE INDEX IF NOT EXISTS "Case_ownerId_idx" ON "Case"("ownerId");
CREATE INDEX IF NOT EXISTS "Lead_claimedByUserId_idx" ON "Lead"("claimedByUserId");
