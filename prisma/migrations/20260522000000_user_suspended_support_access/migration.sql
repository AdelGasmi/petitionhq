-- User kill switch + support impersonation fields
ALTER TABLE "User" ADD COLUMN "suspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "supportAccessGrantedUntil" TIMESTAMP(3);
