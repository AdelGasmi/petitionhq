/**
 * Auth helpers — JWT session using jose (edge-compatible, ships with Next.js).
 *
 * Cookie: "petition_session" — signed HS256 JWT, 7-day expiry.
 * Payload: { userId, email, role, name }
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { UserRole } from "./users";
import { findUserById } from "./users";

const COOKIE_NAME = "petition_session";
const EXPIRES_IN = 60 * 60 * 24 * 7; // 7 days in seconds

function getSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw) throw new Error("SESSION_SECRET env var is not set.");
  return new TextEncoder().encode(raw);
}

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

export type SessionPayload = {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  /** Set only for guest sessions — restricts access to a single case. */
  guestCaseId?: string;
  /** S-13: session version — increment to revoke all older sessions. */
  sv?: number;
};

// ---------------------------------------------------------------------------
// Sign / verify
// ---------------------------------------------------------------------------

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload } as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN}s`)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers — server components and API routes only
// ---------------------------------------------------------------------------

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("Forbidden");
  return session;
}

export async function requireAttorneyOrAdmin(): Promise<SessionPayload> {
  const session = await requireSession();
  if (session.role !== "attorney" && session.role !== "admin") throw new Error("Forbidden");
  return session;
}

// ---------------------------------------------------------------------------
// Case-level authorization (zero-trust admin pattern)
// ---------------------------------------------------------------------------

/**
 * Can this session read/modify the **content** of a case?
 * (form answers, documents, letters, messages, comments, briefs)
 *
 * Admins are explicitly DENIED — case content is attorney-client privileged.
 * Only the assigned attorney and the case owner (applicant) may access it.
 */
export function canAccessCase(
  session: SessionPayload,
  c: { id?: string; ownerId?: string; attorneyId?: string }
): boolean {
  // Guest sessions are scoped to one specific case
  if (session.guestCaseId) return session.guestCaseId === c.id;
  // Admin cannot access case content — attorney-client privilege
  if (session.role === "admin") return false;
  if (session.role === "attorney") return c.attorneyId === session.userId;
  return c.ownerId === session.userId;
}

/**
 * Can this session view case **metadata** and perform management operations?
 * (view status, assign attorney, manage invites, admin notes, payment)
 *
 * Admins CAN manage cases — they just cannot read privileged content.
 */
export function canManageCase(
  session: SessionPayload,
  c: { id?: string; ownerId?: string; attorneyId?: string }
): boolean {
  if (session.guestCaseId) return session.guestCaseId === c.id;
  if (session.role === "admin") return true;
  if (session.role === "attorney") return c.attorneyId === session.userId;
  return c.ownerId === session.userId;
}

/**
 * Can this session use the drafting engine on this case? (letters, petition
 * brief — draft/regenerate/assess/export)
 *
 * The assigned attorney always can. An applicant can only if they own the
 * case AND are flagged into the self-petitioner beta — see
 * petitionhq/beta_onboarding_plan.md §Phase 2. Admins and guests never can.
 */
export async function canDraftCase(
  session: SessionPayload,
  c: { ownerId?: string; attorneyId?: string }
): Promise<boolean> {
  if (session.guestCaseId) return false;
  if (session.role === "attorney") return c.attorneyId === session.userId;
  if (session.role !== "applicant" || c.ownerId !== session.userId) return false;
  const user = await findUserById(session.userId);
  return !!user?.selfPetitionerBeta;
}

export function sessionCookieOptions(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: EXPIRES_IN,
    path: "/",
  };
}

export function clearCookieOptions() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 0,
    path: "/",
  };
}
