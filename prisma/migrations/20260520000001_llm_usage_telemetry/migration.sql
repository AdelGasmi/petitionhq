-- CreateTable
CREATE TABLE "LlmUsage" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "leadId" TEXT,
    "route" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL,
    "tokensOut" INTEGER NOT NULL,
    "cents" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LlmUsage_leadId_idx" ON "LlmUsage"("leadId");

-- CreateIndex
CREATE INDEX "LlmUsage_caseId_idx" ON "LlmUsage"("caseId");

-- CreateIndex
CREATE INDEX "LlmUsage_createdAt_idx" ON "LlmUsage"("createdAt");
