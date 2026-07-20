import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByEmail } from "@/lib/users";
import { signToken, sessionCookieOptions } from "@/lib/auth";
import { parseJsonBody, BodyTooLargeError } from "@/lib/body-limit";
import { checkLockout, recordFailedAttempt, resetLockout } from "@/lib/lockout";
import { verifyTurnstile } from "@/lib/turnstile";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; turnstileToken?: string };
  try {
    body = await parseJsonBody(req, 4_096);
  } catch (e) {
    if (e instanceof BodyTooLargeError) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? undefined;
  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    return NextResponse.json({ error: "Bot verification failed." }, { status: 403 });
  }

  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    // Don't leak whether the email exists — same message as wrong password
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // Check lockout BEFORE password comparison (don't burn bcrypt cycles)
  const lockout = await checkLockout(user.id);
  if (lockout.locked) {
    return NextResponse.json(
      { error: `Account temporarily locked. Try again in ${formatDuration(lockout.retryAfterSeconds)}.` },
      {
        status: 429,
        headers: { "Retry-After": String(lockout.retryAfterSeconds) },
      },
    );
  }

  // Google-only accounts have no password — direct them to Google sign-in
  if (!user.passwordHash) {
    return NextResponse.json(
      { error: "This account uses Google sign-in. Use the 'Continue with Google' button." },
      { status: 401 }
    );
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const status = await recordFailedAttempt(user.id);
    if (status.locked) {
      return NextResponse.json(
        { error: `Too many failed attempts. Account locked for ${formatDuration(status.retryAfterSeconds)}.` },
        {
          status: 429,
          headers: { "Retry-After": String(status.retryAfterSeconds) },
        },
      );
    }
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // Success — reset lockout counter
  await resetLockout(user.id);

  // Suspended users cannot log in
  if (user.suspended) {
    return NextResponse.json(
      { error: "This account has been suspended. Contact support for assistance." },
      { status: 403 }
    );
  }

  if (!user.verified) {
    return NextResponse.json(
      { error: "Account not verified.", userId: user.id, requiresVerification: true },
      { status: 403 }
    );
  }

  const token = await signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    sv: user.sessionVersion,
  });

  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set(sessionCookieOptions(token));
  return res;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""}`;
  const hours = Math.ceil(mins / 60);
  return `${hours} hour${hours > 1 ? "s" : ""}`;
}
