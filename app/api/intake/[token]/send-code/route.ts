import { NextRequest, NextResponse } from "next/server";
import { verifyIntakeToken } from "@/lib/db";
import { issueToken, revokeTokensFor, TTL } from "@/lib/tokens";
import { sendIntakeVerificationEmail } from "@/lib/email";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Send a 6-digit OTP to the email associated with this intake token.
 * The OTP is stored as a user_verify token scoped to the intake token's ID.
 *
 * Rate limiting: revokes any existing code before issuing a new one,
 * so only the latest code is valid. Frontend enforces a 60s cooldown.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const intake = await verifyIntakeToken(token);
  if (!intake) {
    return NextResponse.json(
      { error: "Invalid or expired intake link" },
      { status: 404 }
    );
  }

  // Revoke any previous OTP for this intake token, then issue a fresh one.
  // Scoped via synthetic subjectId "intake:{tokenRowId}" — avoids schema migration
  // for a new TokenSubjectType while keeping OTPs isolated per intake link.
  const otpSubjectId = `intake:${intake.id}`;
  await revokeTokensFor("user", otpSubjectId, "user_verify");
  const { plaintext: code } = await issueToken({
    kind: "user_verify",
    subjectType: "user",
    subjectId: otpSubjectId,
    ttlMs: TTL.USER_VERIFY, // 10 minutes
  });

  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    logger.log(`[intake/send-code] dev mode — code: ${code} for ${intake.email}`);
  } else {
    try {
      await sendIntakeVerificationEmail({ to: intake.email, code });
    } catch (e) {
      logger.error("[intake/send-code]", e);
      return NextResponse.json(
        { error: "Failed to send verification email" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    ok: true,
    maskedEmail: maskEmail(intake.email),
    ...(isDev && { _devCode: code }),
  });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  const maskedLocal =
    local.length <= 2
      ? local[0] + "•••"
      : local[0] + "•".repeat(Math.min(local.length - 2, 4)) + local[local.length - 1];
  const [domainName, ...tld] = domain.split(".");
  const maskedDomain =
    domainName.length <= 2
      ? domainName[0] + "•••"
      : domainName[0] + "•".repeat(Math.min(domainName.length - 2, 3)) + domainName[domainName.length - 1];
  return `${maskedLocal}@${maskedDomain}.${tld.join(".")}`;
}
