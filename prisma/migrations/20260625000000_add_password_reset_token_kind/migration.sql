-- AlterEnum: add a dedicated token kind for self-serve password reset
-- (a 6-digit email code, scoped per user, 15-minute TTL — see lib/tokens.ts).
ALTER TYPE "TokenKind" ADD VALUE 'password_reset';
