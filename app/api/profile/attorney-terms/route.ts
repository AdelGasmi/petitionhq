import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getSession } from "@/lib/auth";
import { acceptAttorneyTerms } from "@/lib/users";
import { ATTORNEY_TERMS_VERSION } from "@/lib/attorneyTerms";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/**
 * POST /api/profile/attorney-terms — stamp attorneyTermsAcceptedAt +
 * attorneyTermsVersion for the current attorney session. Server-enforced gate
 * lives in app/network/layout.tsx; claim/claim-ledger routes re-check.
 */
async function _POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "attorney") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await acceptAttorneyTerms(session.userId, ATTORNEY_TERMS_VERSION);
  await logActivity({
    actor: session,
    action: "attorney_terms.accepted",
    detail: `version ${ATTORNEY_TERMS_VERSION}`,
  });
  return NextResponse.json({ ok: true, version: ATTORNEY_TERMS_VERSION });
}

export const POST = withRoute(_POST);
