-- B-4: Nurture drip tracking for Tier 3 leads
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "nurtureStep" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lastNurtureAt" TIMESTAMP(3);
