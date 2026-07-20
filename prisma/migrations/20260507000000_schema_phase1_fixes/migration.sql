-- Phase 1 schema fixes
-- 1. passwordHash nullable (Google OAuth users have no password)
-- 2. Lead: proper claimedBy FK relation + applicant consent flow columns
-- 3. Case: soft delete via archivedAt

-- 1. Make passwordHash nullable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- 2. Lead: drop bare claimedByUserId, re-add as FK + new consent columns
--    (column already exists from init migration — just add FK + new cols)
ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "applicantStatus"        TEXT NOT NULL DEFAULT 'unclaimed',
  ADD COLUMN IF NOT EXISTS "applicantRespondToken"  TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "applicantRespondExpiry" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectionNote"          TEXT;

-- Add FK constraint on claimedByUserId (was a bare string before)
ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_claimedByUserId_fkey"
  FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Case: soft delete
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- Indexes
CREATE INDEX IF NOT EXISTS "Lead_applicantStatus_idx" ON "Lead"("applicantStatus");
