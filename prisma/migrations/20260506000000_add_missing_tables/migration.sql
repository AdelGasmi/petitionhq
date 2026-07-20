-- Add tables missing from initial migration:
-- EmailLog, CaseNote, ActivityLog, FirmProfile, Lead

CREATE TABLE "EmailLog" (
    "id"        TEXT NOT NULL,
    "to"        TEXT NOT NULL,
    "subject"   TEXT NOT NULL,
    "kind"      TEXT NOT NULL,
    "caseId"    TEXT,
    "caseTitle" TEXT,
    "actorId"   TEXT,
    "actorName" TEXT,
    "status"    TEXT NOT NULL DEFAULT 'sent',
    "error"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

CREATE TABLE "CaseNote" (
    "id"         TEXT NOT NULL,
    "caseId"     TEXT NOT NULL,
    "authorId"   TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "text"       TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CaseNote_caseId_idx" ON "CaseNote"("caseId");
ALTER TABLE "CaseNote" ADD CONSTRAINT "CaseNote_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ActivityLog" (
    "id"        TEXT NOT NULL,
    "actorId"   TEXT,
    "actorName" TEXT,
    "actorRole" TEXT,
    "caseId"    TEXT,
    "caseTitle" TEXT,
    "action"    TEXT NOT NULL,
    "detail"    TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX "ActivityLog_caseId_idx"    ON "ActivityLog"("caseId");

CREATE TABLE "FirmProfile" (
    "id"               TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "firmName"         TEXT,
    "specialties"      TEXT[] DEFAULT ARRAY[]::TEXT[],
    "networkTier"      TEXT NOT NULL DEFAULT 'standard',
    "trialCredits"     INTEGER NOT NULL DEFAULT 3,
    "purchasedCredits" INTEGER NOT NULL DEFAULT 0,
    "trialExpiresAt"   TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FirmProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FirmProfile_userId_key" ON "FirmProfile"("userId");
ALTER TABLE "FirmProfile" ADD CONSTRAINT "FirmProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Lead" (
    "id"              TEXT NOT NULL,
    "email"           TEXT NOT NULL,
    "name"            TEXT,
    "tier"            TEXT,
    "score"           INTEGER,
    "formData"        JSONB NOT NULL DEFAULT '{}',
    "source"          TEXT NOT NULL DEFAULT 'check',
    "refCode"         TEXT,
    "status"          TEXT NOT NULL DEFAULT 'new',
    "claimedByUserId" TEXT,
    "notes"           TEXT,
    "dossierStatus"   TEXT NOT NULL DEFAULT 'idle',
    "dossierPdfPath"  TEXT,
    "caseId"          TEXT,
    "capturedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Lead_email_key"  ON "Lead"("email");
CREATE UNIQUE INDEX "Lead_caseId_key" ON "Lead"("caseId");
CREATE INDEX "Lead_capturedAt_idx"    ON "Lead"("capturedAt");
CREATE INDEX "Lead_tier_idx"          ON "Lead"("tier");
CREATE INDEX "Lead_status_idx"        ON "Lead"("status");
CREATE INDEX "Lead_dossierStatus_idx" ON "Lead"("dossierStatus");
