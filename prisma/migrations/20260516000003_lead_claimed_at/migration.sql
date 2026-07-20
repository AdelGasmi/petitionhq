-- Funnel metrics: timestamp when an attorney claimed a lead
-- Used to compute claim velocity (avg hours from capturedAt → claimedAt)
ALTER TABLE "Lead" ADD COLUMN "claimedAt" TIMESTAMPTZ;
CREATE INDEX "Lead_claimedAt_idx" ON "Lead"("claimedAt");
