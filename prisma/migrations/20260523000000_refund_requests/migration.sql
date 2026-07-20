-- CreateTable
CREATE TABLE "RefundRequest" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "attorneyId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidenceR2Key" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decisionNotes" TEXT,
    "stripeRefundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefundRequest_status_idx" ON "RefundRequest"("status");
CREATE INDEX "RefundRequest_attorneyId_idx" ON "RefundRequest"("attorneyId");
CREATE INDEX "RefundRequest_caseId_idx" ON "RefundRequest"("caseId");

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_attorneyId_fkey" FOREIGN KEY ("attorneyId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
