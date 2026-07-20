-- Idempotency table for external webhook events (Stripe, etc).
-- Primary key on event id rejects replays via unique violation.
CREATE TABLE "WebhookEvent" (
  "id"         TEXT NOT NULL,
  "provider"   TEXT NOT NULL,
  "type"       TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookEvent_provider_receivedAt_idx"
  ON "WebhookEvent" ("provider", "receivedAt");
