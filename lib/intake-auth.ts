/**
 * Intake email verification — JWT cookie for authenticated intake sessions.
 *
 * After the applicant enters the correct 6-digit OTP, we set a signed cookie
 * scoped to that specific intake token. The cookie proves "this browser verified
 * the email for this intake link" without requiring a user account.
 *
 * Cookie: "intake_verified" — HS256 JWT, 4-hour expiry.
 * Payload: { tokenHash } — binds the cookie to the specific intake token.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { hashToken } from "./tokens";

const COOKIE_NAME = "intake_verified";
const EXPIRES_IN = 60 * 60 * 4; // 4 hours

function getSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw) throw new Error("SESSION_SECRET env var is not set.");
  return new TextEncoder().encode(raw);
}

/**
 * Sign and set the intake verification cookie after successful OTP.
 * The cookie payload contains a hash of the intake token — so it's
 * scoped to exactly one intake link. A cookie from intake-link-A
 * won't authenticate intake-link-B.
 */
export async function setIntakeVerifiedCookie(intakeToken: string): Promise<void> {
  const tokenHash = await hashToken(intakeToken);
  const jwt = await new SignJWT({ tokenHash })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN}s`)
    .sign(getSecret());

  const jar = await cookies();
  jar.set({
    name: COOKIE_NAME,
    value: jwt,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: EXPIRES_IN,
    path: "/",
  });
}

/**
 * Check whether the current request has a valid intake verification cookie
 * that matches the given intake token.
 *
 * Returns true only if:
 *   1. Cookie exists and JWT signature is valid
 *   2. JWT is not expired
 *   3. The tokenHash inside the JWT matches the hash of the provided intake token
 */
export async function isIntakeVerified(intakeToken: string): Promise<boolean> {
  const jar = await cookies();
  const cookie = jar.get(COOKIE_NAME)?.value;
  if (!cookie) return false;

  try {
    const { payload } = await jwtVerify(cookie, getSecret());
    const expectedHash = await hashToken(intakeToken);
    return payload.tokenHash === expectedHash;
  } catch {
    return false;
  }
}
