-- TD-3: Replace untyped reviewRequest Json with typed columns
ALTER TABLE "Case"
  ADD COLUMN "reviewStatus"      TEXT,
  ADD COLUMN "reviewRequestedAt" TIMESTAMPTZ,
  ADD COLUMN "reviewRespondedAt" TIMESTAMPTZ,
  ADD COLUMN "reviewNote"        TEXT;

-- Backfill from existing JSON data (safe: NULLIF prevents empty-string cast errors)
UPDATE "Case"
SET
  "reviewStatus"      = "reviewRequest"->>'status',
  "reviewRequestedAt" = NULLIF("reviewRequest"->>'requestedAt', '')::TIMESTAMPTZ,
  "reviewRespondedAt" = NULLIF("reviewRequest"->>'respondedAt', '')::TIMESTAMPTZ,
  "reviewNote"        = NULLIF("reviewRequest"->>'note', '')
WHERE "reviewRequest" IS NOT NULL;

ALTER TABLE "Case" DROP COLUMN "reviewRequest";

-- TD-5: Drop formDataVersion — OCC was never enforced; patchCaseFormData was dead code
ALTER TABLE "Case" DROP COLUMN "formDataVersion";
