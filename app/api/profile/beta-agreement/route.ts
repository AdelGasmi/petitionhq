import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getSession } from "@/lib/auth";
import { findUserById, acceptBetaAgreement } from "@/lib/users";

export const dynamic = "force-dynamic";

/**
 * POST /api/profile/beta-agreement — stamp betaAgreementAcceptedAt for the
 * current session's user. Server-enforced gate lives in app/cases/[id]/page.tsx.
 */
async function _POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await findUserById(session.userId);
  if (!user || !user.selfPetitionerBeta) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await acceptBetaAgreement(session.userId);
  return NextResponse.json({ ok: true });
}

export const POST = withRoute(_POST);
