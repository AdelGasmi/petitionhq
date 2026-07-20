-- CreateTable: Pilot Lead Outcomes (PILOT-1)
CREATE TABLE "LeadOutcome" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "pilotFirm" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'delivered',
    "reason" TEXT,
    "revenueCents" INTEGER,
    "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadOutcome_leadId_idx" ON "LeadOutcome"("leadId");

-- CreateIndex
CREATE INDEX "LeadOutcome_status_idx" ON "LeadOutcome"("status");

-- CreateIndex
CREATE INDEX "LeadOutcome_deliveredAt_idx" ON "LeadOutcome"("deliveredAt");

-- AddForeignKey
ALTER TABLE "LeadOutcome" ADD CONSTRAINT "LeadOutcome_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
