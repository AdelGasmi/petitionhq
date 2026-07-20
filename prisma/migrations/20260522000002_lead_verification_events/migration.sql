-- Lead verification audit log (V1.2)

-- CreateTable
CREATE TABLE "LeadVerificationEvent" (
    "id"              TEXT         NOT NULL,
    "leadId"          TEXT         NOT NULL,
    "source"          TEXT         NOT NULL,
    "action"          TEXT         NOT NULL,
    "result"          TEXT         NOT NULL,
    "claimKey"        TEXT,
    "evidenceRef"     TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "rawResponse"     JSONB,
    "attorneyVisible" BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadVerificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadVerificationEvent_leadId_idx" ON "LeadVerificationEvent"("leadId");
CREATE INDEX "LeadVerificationEvent_leadId_source_idx" ON "LeadVerificationEvent"("leadId", "source");

-- AddForeignKey
ALTER TABLE "LeadVerificationEvent"
    ADD CONSTRAINT "LeadVerificationEvent_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
