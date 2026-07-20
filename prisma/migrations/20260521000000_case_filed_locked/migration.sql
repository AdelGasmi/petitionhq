-- Add filedAt / lockedAt to Case for immutability after filing
ALTER TABLE "Case" ADD COLUMN "filedAt" TIMESTAMP(3);
ALTER TABLE "Case" ADD COLUMN "lockedAt" TIMESTAMP(3);
