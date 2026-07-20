-- AlterTable: self-petitioner beta users' own drafting rules (see User.draftingRules doc comment)
ALTER TABLE "User" ADD COLUMN     "draftingRules" JSONB;
