import { prisma } from "./prisma";
import type { User as PrismaUser, UserRole as PrismaUserRole } from "@prisma/client";
import { issueToken, verifyToken, consumeToken, revokeTokensFor, hasActiveToken, TTL } from "./tokens";

export type UserRole = "admin" | "attorney" | "applicant";

export type User = {
  id: string;
  email: string;
  passwordHash: string | null;
  name: string;
  role: UserRole;
  phone: string | null;
  verified: boolean;
  plan: string | null;
  createdAt: string;
  pendingInvite: boolean;
  sessionVersion: number;
  suspended: boolean;
  selfPetitionerBeta: boolean;
  betaAgreementAcceptedAt: string | null;
  attorneyTermsAcceptedAt: string | null;
  attorneyTermsVersion: string | null;
};

export type PublicUser = Omit<User, "passwordHash">;

function mapUser(row: PrismaUser): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    name: row.name,
    role: row.role as UserRole,
    phone: row.phone ?? null,
    verified: row.verified,
    plan: row.plan ?? null,
    createdAt: row.createdAt.toISOString(),
    pendingInvite: false,
    sessionVersion: row.sessionVersion ?? 1,
    suspended: row.suspended ?? false,
    selfPetitionerBeta: row.selfPetitionerBeta ?? false,
    betaAgreementAcceptedAt: row.betaAgreementAcceptedAt?.toISOString() ?? null,
    attorneyTermsAcceptedAt: row.attorneyTermsAcceptedAt?.toISOString() ?? null,
    attorneyTermsVersion: row.attorneyTermsVersion ?? null,
  };
}

function toPublic(u: User): PublicUser {
  const { passwordHash: _, ...pub } = u;
  return pub;
}

export async function countUsers(): Promise<number> {
  return prisma.user.count();
}

export async function listUsers(): Promise<PublicUser[]> {
  const rows = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const users = rows.map(mapUser);
  const pending = await Promise.all(
    users.map((u) => hasActiveToken("user", u.id, "user_invite")),
  );
  return users.map((u, i) => toPublic({ ...u, pendingInvite: pending[i] }));
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const row = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  return row ? mapUser(row) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const row = await prisma.user.findUnique({ where: { id } });
  return row ? mapUser(row) : null;
}

export async function findPublicUserById(id: string): Promise<PublicUser | null> {
  const row = await prisma.user.findUnique({ where: { id } });
  if (!row) return null;
  const u = mapUser(row);
  u.pendingInvite = await hasActiveToken("user", u.id, "user_invite");
  return toPublic(u);
}

export async function createUser(input: {
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  phone?: string;
  verified?: boolean;
}): Promise<PublicUser> {
  const row = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name,
      role: input.role as PrismaUserRole,
      passwordHash: input.passwordHash,
      phone: input.phone,
      verified: input.verified ?? false,
    },
  });
  return toPublic(mapUser(row));
}

export async function deleteUser(id: string): Promise<void> {
  await revokeTokensFor("user", id);
  await prisma.user.delete({ where: { id } }).catch(() => {});
}

export async function updateUser(
  id: string,
  data: Partial<{ name: string; email: string; role: UserRole; passwordHash: string; phone: string | null }>
): Promise<PublicUser> {
  const row = await prisma.user.update({
    where: { id },
    data: data.role ? { ...data, role: data.role as PrismaUserRole } : data,
  });
  return toPublic(mapUser(row));
}

/**
 * Create a user via admin invite. Returns { user, plaintext } so the caller
 * can build the invite URL. The token is hashed in the Token table.
 */
export async function createInvitedUser(input: {
  email: string;
  name: string;
  role: UserRole;
  createdById?: string;
}): Promise<{ user: PublicUser; plaintext: string }> {
  const row = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name,
      role: input.role as PrismaUserRole,
      passwordHash: "",
    },
  });

  const { plaintext } = await issueToken({
    kind: "user_invite",
    subjectType: "user",
    subjectId: row.id,
    ttlMs: TTL.USER_INVITE,
    metadata: { email: input.email, name: input.name, role: input.role },
    createdById: input.createdById,
  });

  const u = mapUser(row);
  u.pendingInvite = true;
  return { user: toPublic(u), plaintext };
}

/**
 * Create a self-petitioner beta applicant. Same shape as createInvitedUser
 * (pending invite via user_invite token) but forces role=applicant and sets
 * the beta flag — see petitionhq/beta_onboarding_plan.md §2.
 */
export async function createBetaApplicantUser(input: {
  email: string;
  name: string;
  createdById?: string;
}): Promise<{ user: PublicUser; plaintext: string }> {
  const row = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      name: input.name,
      role: "applicant",
      passwordHash: "",
      selfPetitionerBeta: true,
    },
  });

  const { plaintext } = await issueToken({
    kind: "user_invite",
    subjectType: "user",
    subjectId: row.id,
    ttlMs: TTL.USER_INVITE,
    metadata: { email: input.email, name: input.name, role: "applicant" },
    createdById: input.createdById,
  });

  const u = mapUser(row);
  u.pendingInvite = true;
  return { user: toPublic(u), plaintext };
}

/** Stamp the beta agreement acceptance timestamp (idempotent). */
export async function acceptBetaAgreement(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { betaAgreementAcceptedAt: new Date() },
  });
}

/** Stamp attorney platform-terms acceptance at the given version (idempotent). */
export async function acceptAttorneyTerms(userId: string, version: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { attorneyTermsAcceptedAt: new Date(), attorneyTermsVersion: version },
  });
}

/**
 * Find user by invite token plaintext. Verifies hash + expiry via Token table.
 */
export async function findUserByInviteToken(tokenPlaintext: string): Promise<User | null> {
  const verified = await verifyToken(tokenPlaintext, "user_invite");
  if (!verified) return null;
  return findUserById(verified.subjectId);
}

export async function setUserPlan(id: string, plan: string): Promise<void> {
  await prisma.user.update({ where: { id }, data: { plan } });
}

/**
 * Issue a new 6-digit verification code. Revokes any previous codes first.
 * Returns the plaintext code (for sending via email/sms).
 */
export async function issueVerifyCode(userId: string): Promise<string> {
  await revokeTokensFor("user", userId, "user_verify");
  const { plaintext } = await issueToken({
    kind: "user_verify",
    subjectType: "user",
    subjectId: userId,
    ttlMs: TTL.USER_VERIFY,
  });
  return plaintext;
}

/**
 * Consume a 6-digit verify code. Uses scoped lookup + timing-safe compare.
 */
export async function consumeVerifyCode(
  userId: string,
  code: string
): Promise<"ok" | "wrong" | "expired"> {
  const verified = await verifyToken(code, "user_verify", userId);
  if (!verified) {
    const hasAny = await hasActiveToken("user", userId, "user_verify");
    return hasAny ? "wrong" : "expired";
  }
  await consumeToken(verified.id);
  await prisma.user.update({ where: { id: userId }, data: { verified: true } });
  return "ok";
}

/**
 * Issue a 6-digit password-reset code (15-min TTL). Revokes any previous reset
 * codes first. Returns the plaintext code for delivery via email. A dedicated
 * `password_reset` kind keeps it isolated from email-verification codes — a
 * reset code can never be used to verify an email, and vice versa.
 */
export async function issuePasswordResetCode(userId: string): Promise<string> {
  await revokeTokensFor("user", userId, "password_reset");
  const { plaintext } = await issueToken({
    kind: "password_reset",
    subjectType: "user",
    subjectId: userId,
    ttlMs: TTL.PASSWORD_RESET,
  });
  return plaintext;
}

/**
 * Consume a password-reset code. Scoped lookup + timing-safe compare. Does NOT
 * change the password — the caller updates the hash + bumps sessionVersion once
 * this returns "ok".
 */
export async function consumePasswordResetCode(
  userId: string,
  code: string
): Promise<"ok" | "wrong" | "expired"> {
  const verified = await verifyToken(code, "password_reset", userId);
  if (!verified) {
    const hasAny = await hasActiveToken("user", userId, "password_reset");
    return hasAny ? "wrong" : "expired";
  }
  await consumeToken(verified.id);
  return "ok";
}

/**
 * Accept an invite: set password, consume the invite token, mark verified.
 */
export async function acceptUserInvite(
  userId: string,
  passwordHash: string,
  tokenPlaintext: string,
): Promise<PublicUser> {
  const verified = await verifyToken(tokenPlaintext, "user_invite");
  if (verified) await consumeToken(verified.id);

  const row = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, verified: true },
  });
  return toPublic(mapUser(row));
}

/**
 * Re-issue an invite token for a user (admin resend).
 * Revokes old invite tokens first.
 */
export async function reissueUserInvite(
  userId: string,
  createdById?: string,
): Promise<string> {
  await revokeTokensFor("user", userId, "user_invite");
  const { plaintext } = await issueToken({
    kind: "user_invite",
    subjectType: "user",
    subjectId: userId,
    ttlMs: TTL.USER_INVITE,
    createdById,
  });
  return plaintext;
}
