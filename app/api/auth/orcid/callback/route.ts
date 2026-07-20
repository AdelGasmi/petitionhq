import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLead } from "@/lib/verification/orchestrator";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

const ORCID_HOST = process.env.ORCID_ENV === "sandbox"
  ? "https://sandbox.orcid.org"
  : "https://orcid.org";

type OrcidTokenResponse = {
  access_token: string;
  token_type: string;
  orcid: string;       // "0000-0001-2345-6789"
  name: string;
  scope: string;
  expires_in: number;
};

/**
 * GET /api/auth/orcid/callback?code=...&state=...
 *
 * Handles the ORCID OAuth callback. Exchanges the code for a token, extracts
 * the verified ORCID iD, updates the lead, and triggers a re-verification.
 *
 * Required env vars: ORCID_CLIENT_ID, ORCID_CLIENT_SECRET, ORCID_REDIRECT_URI
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.ORCID_CLIENT_ID;
  const clientSecret = process.env.ORCID_CLIENT_SECRET;
  const redirectUri = process.env.ORCID_REDIRECT_URI;

  // Behind Caddy, publicOrigin resolves to the internal 0.0.0.0:3000,
  // which the browser can't reach. Use the configured public origin for every
  // browser redirect instead (derive it from the OAuth redirect URI — same host
  // ORCID sent the user to — or NEXT_PUBLIC_BASE_URL).
  const publicOrigin =
    (redirectUri ? new URL(redirectUri).origin : null) ||
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    "https://petitionhq.us";

  if (!clientId || !clientSecret || !redirectUri) {
    logger.error("[orcid-callback] ORCID OAuth env vars not configured");
    return NextResponse.redirect(
      new URL("/check?orcid=config_error", publicOrigin),
    );
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/check?orcid=denied", publicOrigin),
    );
  }

  // Decode and validate state
  let leadId: string;
  let resultToken: string;
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf-8");
    [leadId, resultToken] = decoded.split(":");
    if (!leadId || !resultToken) throw new Error("malformed state");
  } catch {
    return NextResponse.redirect(new URL("/check?orcid=invalid_state", publicOrigin));
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, resultToken: true },
  });

  if (!lead || lead.resultToken !== resultToken) {
    return NextResponse.redirect(new URL("/check?orcid=invalid_state", publicOrigin));
  }

  // Exchange code for token
  let orcidId: string;
  try {
    const tokenRes = await fetch(`${ORCID_HOST}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      logger.error("[orcid-callback] Token exchange failed:", err);
      return NextResponse.redirect(
        new URL(`/check/result/${leadId}?orcid=token_error`, publicOrigin),
      );
    }

    const tokenData = (await tokenRes.json()) as OrcidTokenResponse;
    orcidId = tokenData.orcid;
    if (!orcidId) throw new Error("no orcid in token response");
  } catch (e) {
    logger.error("[orcid-callback] Token exchange error:", e);
    return NextResponse.redirect(
      new URL(`/check/result/${leadId}?orcid=token_error`, publicOrigin),
    );
  }

  // Store the verified ORCID iD and trigger re-verification
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      orcidAuthenticated: true,
      orcidVerifiedId: orcidId,
    },
  });

  // Re-verify in the background — don't block the redirect
  verifyLead(leadId, { reason: "orcid_oauth" }).catch((e) => {
    logger.error("[orcid-callback] Background re-verify failed:", e);
  });

  return NextResponse.redirect(
    new URL(`/check/result/${leadId}?orcid=verified`, publicOrigin),
  );
}
