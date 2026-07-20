-- AlterTable: FirmProfile — add subscription tracking fields
ALTER TABLE "FirmProfile" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "FirmProfile" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT;

-- CreateIndex: FirmProfile.stripeSubscriptionId (unique)
CREATE UNIQUE INDEX IF NOT EXISTS "FirmProfile_stripeSubscriptionId_key" ON "FirmProfile"("stripeSubscriptionId");

-- CreateTable: CreditTransaction
CREATE TABLE IF NOT EXISTS "CreditTransaction" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "description" TEXT,
    "stripeSessionId" TEXT,
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: CreditTransaction(firmId, createdAt)
CREATE INDEX IF NOT EXISTS "CreditTransaction_firmId_createdAt_idx" ON "CreditTransaction"("firmId", "createdAt");

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "FirmProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
