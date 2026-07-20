-- Add columns present in Prisma schema but missing from prod DB
-- These were added to schema.prisma without running prisma migrate dev

ALTER TABLE "Case"
  ADD COLUMN IF NOT EXISTS "formDataVersion"   INTEGER       NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "guestToken"        TEXT          UNIQUE,
  ADD COLUMN IF NOT EXISTS "guestTokenExpiry"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "intakeToken"       TEXT          UNIQUE,
  ADD COLUMN IF NOT EXISTS "intakeTokenExpiry" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "intakeEmail"       TEXT,
  ADD COLUMN IF NOT EXISTS "paymentStatus"     TEXT          NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS "paymentNotes"      TEXT;

-- Also apply the phase1 migration that may not have run
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "applicantStatus"        TEXT NOT NULL DEFAULT 'unclaimed',
  ADD COLUMN IF NOT EXISTS "applicantRespondToken"  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "applicantRespondExpiry" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectionNote"          TEXT;

CREATE INDEX IF NOT EXISTS "Lead_applicantStatus_idx" ON "Lead"("applicantStatus");
