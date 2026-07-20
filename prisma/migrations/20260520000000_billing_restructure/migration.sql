-- Lead Claim Payments (per-claim Stripe Checkout, replaces credit deduction)
CREATE TABLE "LeadClaimPayment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadClaimPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadClaimPayment_leadId_key" ON "LeadClaimPayment"("leadId");
CREATE UNIQUE INDEX "LeadClaimPayment_stripeSessionId_key" ON "LeadClaimPayment"("stripeSessionId");
CREATE INDEX "LeadClaimPayment_userId_createdAt_idx" ON "LeadClaimPayment"("userId", "createdAt");

ALTER TABLE "LeadClaimPayment" ADD CONSTRAINT "LeadClaimPayment_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadClaimPayment" ADD CONSTRAINT "LeadClaimPayment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AI Draft Usage Metering (instrument now, bill later)
CREATE TABLE "DraftUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "letterId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DraftUsage_userId_createdAt_idx" ON "DraftUsage"("userId", "createdAt");
CREATE INDEX "DraftUsage_caseId_idx" ON "DraftUsage"("caseId");

ALTER TABLE "DraftUsage" ADD CONSTRAINT "DraftUsage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DraftUsage" ADD CONSTRAINT "DraftUsage_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
