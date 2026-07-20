-- AlterTable: admin identity attestation fields on Lead
ALTER TABLE "Lead" ADD COLUMN     "adminAttested" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lead" ADD COLUMN     "adminAttestedBy" TEXT;
ALTER TABLE "Lead" ADD COLUMN     "adminAttestedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN     "adminAttestedReason" TEXT;
