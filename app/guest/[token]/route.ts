import { NextRequest, NextResponse } from "next/server";
import { findCaseIdByGuestToken } from "@/lib/db";
import { signToken, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Magic-link entry point for the applicant to fill in their case.
 * Validates the token, issues a scoped applicant session, redirects to the case.
 * No account required — the link IS the credential. Access is narrowed to the
 * single case via `guestCaseId`, which `canAccessCase` checks before role.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const caseId = await findCaseIdByGuestToken(token);
  if (!caseId) {
    const url = new URL("/login", process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000");
    url.searchParams.set("error", "guest-expired");
    return NextResponse.redirect(url);
  }

  const jwt = await signToken({
    userId: `guest_${token.slice(0, 8)}`,
    email: "",
    role: "applicant",
    name: "Applicant",
    guestCaseId: caseId,
  });

  const opts = sessionCookieOptions(jwt);
  // Shorten to 8 hours for guest sessions
  opts.maxAge = 8 * 60 * 60;

  const caseUrl = new URL(
    `/cases/${caseId}`,
    process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000"
  );
  const res = NextResponse.redirect(caseUrl);
  res.cookies.set(opts);
  return res;
}
