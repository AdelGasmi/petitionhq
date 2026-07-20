-- CreateEnum
CREATE TYPE "TokenKind" AS ENUM ('user_invite', 'user_verify', 'case_invite', 'case_guest', 'case_intake', 'letter_review', 'lead_consent');

-- CreateEnum
CREATE TYPE "TokenSubjectType" AS ENUM ('user', 'case_record', 'letter', 'lead');

-- AlterEnum (idempotent — 'admin' may already exist)
DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DropIndex (old token unique constraints)
-- Drop as constraints first (shadow DB), then as indexes (prod)
ALTER TABLE "Case" DROP CONSTRAINT IF EXISTS "Case_inviteToken_key";
DROP INDEX IF EXISTS "Case_inviteToken_key";
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_applicantRespondToken_key";
DROP INDEX IF EXISTS "Lead_applicantRespondToken_key";

-- AlterTable Case — drop legacy token columns, add missing columns
ALTER TABLE "Case" DROP COLUMN IF EXISTS "inviteEmail",
DROP COLUMN IF EXISTS "inviteExpiry",
DROP COLUMN IF EXISTS "inviteToken",
ADD COLUMN IF NOT EXISTS "formDataVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "paymentNotes" TEXT,
ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid';

-- AlterTable Lead — drop legacy token columns
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "applicantRespondExpiry",
DROP COLUMN IF EXISTS "applicantRespondToken";

-- AlterTable Letter — ensure tracking columns exist
ALTER TABLE "Letter" ADD COLUMN IF NOT EXISTS "reviewerSubmitted" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reviewerViewed" TIMESTAMP(3);

-- Drop legacy token columns from Letter
ALTER TABLE "Letter" DROP COLUMN IF EXISTS "reviewToken",
DROP COLUMN IF EXISTS "reviewTokenExpiry";

-- AlterTable User — ensure all columns exist
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "draftBudget" INTEGER,
ADD COLUMN IF NOT EXISTS "googleId" TEXT,
ADD COLUMN IF NOT EXISTS "plan" TEXT,
ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT,
ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT false;

-- Drop legacy token columns from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "verifyCode",
DROP COLUMN IF EXISTS "verifyExpiry",
DROP COLUMN IF EXISTS "inviteToken",
DROP COLUMN IF EXISTS "inviteExpiry";

-- CreateTable Token
CREATE TABLE IF NOT EXISTS "Token" (
    "id" TEXT NOT NULL,
    "kind" "TokenKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "subjectType" "TokenSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Token_tokenHash_key" ON "Token"("tokenHash");
CREATE INDEX IF NOT EXISTS "Token_subjectType_subjectId_idx" ON "Token"("subjectType", "subjectId");
CREATE INDEX IF NOT EXISTS "Token_kind_idx" ON "Token"("kind");
CREATE INDEX IF NOT EXISTS "Token_expiresAt_idx" ON "Token"("expiresAt");

-- CreateIndex (User unique constraints — idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");
