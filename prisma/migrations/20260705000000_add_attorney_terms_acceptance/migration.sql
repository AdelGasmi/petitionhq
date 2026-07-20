-- AlterTable: attorney platform-terms acceptance (version-stamped re-acceptance gate)
ALTER TABLE "User" ADD COLUMN     "attorneyTermsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN     "attorneyTermsVersion" TEXT;
