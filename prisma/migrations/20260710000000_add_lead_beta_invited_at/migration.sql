-- AlterTable: self-petitioner beta invite single-send lock (see prisma/schema.prisma).
-- Claimed atomically via updateMany({ where: { betaInvitedAt: null } }) so exactly
-- one invite email can ever be sent per lead. Never reset after a send is attempted.
ALTER TABLE "Lead" ADD COLUMN     "betaInvitedAt" TIMESTAMP(3);
