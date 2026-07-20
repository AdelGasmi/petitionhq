-- AlterTable: self-petitioner beta flag on the existing applicant role (User)
ALTER TABLE "User" ADD COLUMN     "selfPetitionerBeta" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN     "betaAgreementAcceptedAt" TIMESTAMP(3);
