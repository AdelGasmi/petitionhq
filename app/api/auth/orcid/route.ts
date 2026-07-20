import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ORCID_HOST = process.env.ORCID_ENV === "sandbox"
  ? "https://sandbox.orcid.org"
  : "https://orcid.org";

/**
 * GET /api/auth/orcid?leadId=...
 *
 * Initiates the ORCID OAuth "Sign in with ORCID" flow. The leadId is encoded
 * in the state param so the callback can look up the correct lead.
 *
 * Required env vars: ORCID_CLIENT_ID, ORCID_REDIRECT_URI
 */
async function _GET(req: NextRequest) {
  const clientId = process.env.ORCID_CLIENT_ID;
  const redirectUri = process.env.ORCID_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "ORCID OAuth not configured" }, { status: 503 });
  }

  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "Missing leadId" }, { status: 400 });
  }

  // Validate the lead exists and hasn't already authenticated
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, resultToken: true, orcidAuthenticated: true },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (lead.orcidAuthenticated) {
    // Already done — redirect back to result. Use the public origin (the OAuth
    // redirect URI's host), not req.nextUrl.origin, which behind Caddy is the
    // internal 0.0.0.0:3000.
    const publicOrigin = new URL(redirectUri).origin;
    return NextResponse.redirect(
      new URL(`/check/result/${leadId}?orcid=already`, publicOrigin),
    );
  }

  // state = leadId:resultToken (validates the callback came from a real session)
  const state = Buffer.from(`${leadId}:${lead.resultToken}`).toString("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "/authenticate",
    redirect_uri: redirectUri,
    state,
  });

  return NextResponse.redirect(`${ORCID_HOST}/oauth/authorize?${params}`);
}

export const GET = withRoute(_GET);
