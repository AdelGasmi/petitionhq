/**
 * Unified token system — replaces 6 scattered token columns with one Token table.
 *
 * All tokens are SHA-256 hashed before storage. The database never holds plaintext.
 * Uses Web Crypto API (crypto.subtle) — works in Node.js 18+, Edge Runtime, and browsers.
 *
 * Token kinds:
 *   user_invite    — admin invites attorney/admin → /invite/user/[token]
 *   user_verify    — 6-digit email verification code
 *   case_invite    — attorney invites applicant to case → /invite/[token]
 *   case_guest     — read-only guest access → /guest/[token]
 *   case_intake    — applicant fills form without account → /intake/[token]
 *   letter_review  — recommender review portal → /review/[token]
 *   lead_consent   — applicant approve/reject attorney → /respond?token=X
 *   lead_preview   — attorney preview lead detail → /leads/[id]?token=X
 *   password_reset — 6-digit self-serve password-reset code → /forgot-password
 */

import { prisma } from "./prisma";
import type { TokenKind, TokenSubjectType } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export type IssueTokenInput = {
  kind: TokenKind;
  subjectType: TokenSubjectType;
  subjectId: string;
  /** Time-to-live in milliseconds */
  ttlMs: number;
  /** Kind-specific data (e.g. { email } for invite, { code } for verify) */
  metadata?: Record<string, unknown>;
  /** User ID of the actor who issued the token */
  createdById?: string;
};

export type IssueTokenResult = {
  /** Plaintext token — deliver once via URL or email. NEVER stored in DB. */
  plaintext: string;
  /** Database row ID — use for revocation or status checks. */
  id: string;
  expiresAt: Date;
};

export type VerifiedToken = {
  id: string;
  subjectType: TokenSubjectType;
  subjectId: string;
  metadata: Record<string, unknown>;
};

// ─── Constants ──────────────────────────────────────────────────────────────

export const TTL = {
  USER_INVITE:    7 * 24 * 60 * 60 * 1000,   // 7 days
  USER_VERIFY:   10 * 60 * 1000,              // 10 minutes
  CASE_INVITE:    7 * 24 * 60 * 60 * 1000,   // 7 days
  CASE_GUEST:    14 * 24 * 60 * 60 * 1000,   // 14 days
  CASE_INTAKE:    2 * 24 * 60 * 60 * 1000,   // 48 hours (was 30 days — tightened for Risk 1)
  LETTER_REVIEW: 14 * 24 * 60 * 60 * 1000,   // 14 days
  LEAD_CONSENT:   7 * 24 * 60 * 60 * 1000,   // 7 days
  LEAD_PREVIEW:  24 * 60 * 60 * 1000,        // 24 hours
  PASSWORD_RESET: 15 * 60 * 1000,            // 15 minutes
} as const;

/**
 * Token kinds whose plaintext is a low-entropy 6-digit numeric code delivered
 * out-of-band (email/SMS), NOT a 256-bit URL token. These are verified
 * scoped-by-subject (timing-safe) via `verifyCodeScoped`, never by a global
 * unique-hash lookup.
 */
const CODE_KINDS: ReadonlySet<TokenKind> = new Set<TokenKind>(["user_verify", "password_reset"]);

// ─── Crypto primitives (Web Crypto API) ─────────────────────────────────────

/**
 * SHA-256 hash a plaintext string. Returns lowercase hex.
 * Uses Web Crypto API — works in Edge, Node 18+, and browsers.
 */
export async function hashToken(plaintext: string): Promise<string> {
  const data = new TextEncoder().encode(plaintext);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a cryptographically random token string.
 * 32 bytes = 64 hex chars = 256 bits of entropy.
 */
function generatePlaintext(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a 6-digit numeric code for email/phone verification.
 */
function generateVerifyCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const num = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(100000 + (num % 900000));
}

/**
 * Constant-time string comparison.
 * Compares every byte regardless of where the first mismatch is,
 * preventing timing side-channels on short secrets (6-digit codes).
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoderA = new TextEncoder().encode(a);
  const encoderB = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < encoderA.length; i++) {
    diff |= encoderA[i] ^ encoderB[i];
  }
  return diff === 0;
}

// ─── Issue ──────────────────────────────────────────────────────────────────

/**
 * Create a new token, hash it, persist it.
 * Returns the plaintext for one-time delivery (URL, email, SMS).
 *
 * For user_verify: the plaintext is a 6-digit code, not a 64-hex-char string.
 */
export async function issueToken(input: IssueTokenInput): Promise<IssueTokenResult> {
  const plaintext = CODE_KINDS.has(input.kind)
    ? generateVerifyCode()
    : generatePlaintext();

  const hash = await hashToken(plaintext);
  const expiresAt = new Date(Date.now() + input.ttlMs);

  const row = await prisma.token.create({
    data: {
      kind: input.kind,
      tokenHash: hash,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      metadata: (input.metadata ?? {}) as object,
      expiresAt,
      createdById: input.createdById ?? null,
    },
  });

  return { plaintext, id: row.id, expiresAt };
}

// ─── Verify ─────────────────────────────────────────────────────────────────

/**
 * Look up a token by plaintext. Returns the verified payload or null.
 *
 * For URL-based tokens (64 hex chars, 256-bit entropy):
 *   Hash the input, query by unique tokenHash, check kind + expiry + consumed.
 *
 * For user_verify (6-digit code, low entropy):
 *   Must be scoped by subjectId to avoid collisions across users.
 *   Pass `scopeSubjectId` to use the scoped path.
 */
export async function verifyToken(
  plaintext: string,
  expectedKind: TokenKind,
  scopeSubjectId?: string,
): Promise<VerifiedToken | null> {
  if (CODE_KINDS.has(expectedKind) && scopeSubjectId) {
    return verifyCodeScoped(plaintext, scopeSubjectId, expectedKind);
  }

  const hash = await hashToken(plaintext);
  const row = await prisma.token.findUnique({ where: { tokenHash: hash } });

  if (!row) return null;
  if (row.kind !== expectedKind) return null;
  if (row.consumedAt) return null;
  if (row.expiresAt < new Date()) return null;

  return {
    id: row.id,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };
}

/**
 * Scoped verify for low-entropy tokens (6-digit codes).
 * Finds the active user_verify token for this user and compares hashes
 * in constant time.
 */
async function verifyCodeScoped(
  code: string,
  userId: string,
  kind: TokenKind,
): Promise<VerifiedToken | null> {
  const rows = await prisma.token.findMany({
    where: {
      kind,
      subjectType: "user",
      subjectId: userId,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take: 1,
  });

  if (rows.length === 0) return null;

  const row = rows[0];
  const inputHash = await hashToken(code);

  if (!timingSafeEqual(inputHash, row.tokenHash)) return null;

  return {
    id: row.id,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };
}

// ─── Consume ────────────────────────────────────────────────────────────────

/**
 * Mark a token as consumed (single-use). Idempotent.
 */
export async function consumeToken(id: string): Promise<void> {
  await prisma.token.update({
    where: { id },
    data: { consumedAt: new Date() },
  });
}

// ─── Revoke ─────────────────────────────────────────────────────────────────

/**
 * Revoke all unconsumed tokens for a given subject.
 * Optionally filter by kind. Returns the number revoked.
 *
 * Use cases:
 *   - Subject deleted/archived → revoke all kinds
 *   - Re-issuing a token → revoke old ones of the same kind first
 *   - Password change → revoke user_verify tokens
 */
export async function revokeTokensFor(
  subjectType: TokenSubjectType,
  subjectId: string,
  kind?: TokenKind,
): Promise<number> {
  const result = await prisma.token.updateMany({
    where: {
      subjectType,
      subjectId,
      consumedAt: null,
      ...(kind ? { kind } : {}),
    },
    data: { consumedAt: new Date() },
  });
  return result.count;
}

// ─── Query helpers ──────────────────────────────────────────────────────────

/**
 * Check whether an active (unconsumed, unexpired) token of a given kind
 * exists for a subject. Used for UI state (e.g. "review invite sent").
 */
export async function hasActiveToken(
  subjectType: TokenSubjectType,
  subjectId: string,
  kind: TokenKind,
): Promise<boolean> {
  const count = await prisma.token.count({
    where: {
      subjectType,
      subjectId,
      kind,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  return count > 0;
}
