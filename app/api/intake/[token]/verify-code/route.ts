import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { verifyIntakeToken } from "@/lib/db";
import { verifyToken as verifyOtp, consumeToken, hasActiveToken } from "@/lib/tokens";
import { setIntakeVerifiedCookie } from "@/lib/intake-auth";

export const dynamic = "force-dynamic";

/**
 * Verify a 6-digit OTP code for intake email verification.
 * On success, sets a signed JWT cookie that gates all intake data access.
 */
async function _POST(
  req: NextRequest,
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

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter a 6-digit code" }, { status: 400 });
  }

  const otpSubjectId = `intake:${intake.id}`;

  // Use scoped verification — same approach as user account verification
  const verified = await verifyOtp(code, "user_verify", otpSubjectId);
  if (!verified) {
    // Distinguish "wrong code" from "no code / expired"
    const hasCode = await hasActiveToken("user", otpSubjectId, "user_verify");
    const message = hasCode
      ? "Incorrect code. Please try again."
      : "Code expired. Request a new one.";
    return NextResponse.json({ error: message, expired: !hasCode }, { status: 401 });
  }

  // Consume the OTP (single-use)
  await consumeToken(verified.id);

  // Set the signed cookie — proves this browser verified the email
  await setIntakeVerifiedCookie(token);

  return NextResponse.json({ ok: true });
}

export const POST = withRoute(_POST);
