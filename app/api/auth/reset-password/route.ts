import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { findUserByEmail, consumePasswordResetCode } from "@/lib/users";
import { prisma } from "@/lib/prisma";
import { signToken, sessionCookieOptions } from "@/lib/auth";
import { setSessionRevocationVersion } from "@/lib/session-revoke";
import { parseJsonBody, BodyTooLargeError } from "@/lib/body-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/reset-password  { email, code, password }
 *
 * Verifies the 6-digit reset code, sets the new password (bcrypt cost 12), and
 * — per S-13 — bumps sessionVersion to revoke every existing session, then
 * auto-logs-in this device with the new version.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; code?: string; password?: string };
  try {
    body = await parseJsonBody(req, 4_096);
  } catch (e) {
    if (e instanceof BodyTooLargeError) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const code = body.code?.trim();
  const password = body.password ?? "";

  if (!email || !code) {
    return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    // Don't reveal whether the email exists — same shape as a bad code.
    return NextResponse.json({ error: "Invalid or expired code. Request a new one." }, { status: 400 });
  }

  const result = await consumePasswordResetCode(user.id, code);
  if (result === "expired") {
    return NextResponse.json({ error: "This code has expired. Request a new one." }, { status: 410 });
  }
  if (result === "wrong") {
    return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 });
  }

  // Code valid → set new password + revoke all existing sessions.
  const passwordHash = await bcrypt.hash(password, 12);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      verified: true,
      failedAttempts: 0,
      lockedUntil: null,
      sessionVersion: { increment: 1 },
    },
    select: { sessionVersion: true, email: true, role: true, name: true, suspended: true },
  });
  await setSessionRevocationVersion(user.id, updated.sessionVersion);

  // Suspended accounts: the reset succeeds, but we don't hand out a session.
  if (updated.suspended) {
    return NextResponse.json({ ok: true, suspended: true });
  }

  // Auto-login on this device with the new session version.
  const token = await signToken({
    userId: user.id,
    email: updated.email,
    role: updated.role as "admin" | "attorney" | "applicant",
    name: updated.name,
    sv: updated.sessionVersion,
  });
  const jar = await cookies();
  jar.set(sessionCookieOptions(token));

  return NextResponse.json({ ok: true, role: updated.role });
}
