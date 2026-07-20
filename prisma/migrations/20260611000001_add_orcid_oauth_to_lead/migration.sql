-- AddColumn: ORCID OAuth verified identity fields on Lead
ALTER TABLE "Lead" ADD COLUMN "orcidAuthenticated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lead" ADD COLUMN "orcidVerifiedId" TEXT;
