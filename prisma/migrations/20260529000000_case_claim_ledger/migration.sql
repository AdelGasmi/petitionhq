-- Attorney curation gate: per-case ledger of approved/excluded evidence atom IDs.
-- Nullable JSONB. NULL = un-curated (all atoms allowed in generated prose).
ALTER TABLE "Case" ADD COLUMN "claimLedger" JSONB;
