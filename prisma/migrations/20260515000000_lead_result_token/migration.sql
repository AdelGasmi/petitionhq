-- Enable pgcrypto for gen_random_bytes (safe to run if already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add resultToken column (nullable first for backfill)
ALTER TABLE "Lead" ADD COLUMN "resultToken" TEXT;

-- Backfill existing rows with random hex tokens
UPDATE "Lead" SET "resultToken" = encode(gen_random_bytes(24), 'hex') WHERE "resultToken" IS NULL;

-- Now make it NOT NULL and add unique index
ALTER TABLE "Lead" ALTER COLUMN "resultToken" SET NOT NULL;
CREATE UNIQUE INDEX "Lead_resultToken_key" ON "Lead"("resultToken");
