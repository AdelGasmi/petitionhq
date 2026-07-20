import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, issuePasswordResetCode } from "@/lib/users";
import { sendPasswordResetEmail } from "@/lib/email";
import { verifyTurnstile } from "@/lib/turnstile";
import { parseJsonBody, BodyTooLargeError } from "@/lib/body-limit";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/forgot-password  { email, turnstileToken }
 *
 * Issues a 6-digit password-reset code and emails it. Turnstile-gated and
 * **anti-enumeration**: the response is identical whether or not the account
 * exists, so it can't be used to probe which emails are registered. Only
 * password accounts (attorney/admin who completed setup) get a code — applicants
 * authenticate via OTP intake links, not a password.
 */
export async function POST(req: NextRequest) {
  let body: { email?: string; turnstileToken?: string };
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

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const isDev = process.env.NODE_ENV === "development";
  let devCode: string | undefined;

  const user = await findUserByEmail(email);
  // A non-empty passwordHash means the user completed setup. Invited-but-not-yet
  // -setup accounts (hash "") should use their invite link, not a reset.
  if (user && user.passwordHash && !user.suspended) {
    try {
      const code = await issuePasswordResetCode(user.id);
      if (isDev) {
        devCode = code;
        logger.log(`[forgot-password] dev — reset code for ${email}: ${code}`);
      } else {
        await sendPasswordResetEmail({ to: user.email, name: user.name, code });
      }
    } catch (e) {
      // Never leak the failure — fall through to the generic response.
      logger.error("[forgot-password] failed to issue/send reset code:", e);
    }
  }

  return NextResponse.json({ ok: true, ...(isDev && devCode ? { _devCode: devCode } : {}) });
}
