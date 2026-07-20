import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { trackFunnel } from "@/lib/funnel";
import { sendConsentConfirmation } from "@/lib/email";
import { nextMaturity } from "@/lib/leadMaturity";
import type { LeadMaturity } from "@/lib/leadMaturity";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/leads/[id]/consent
 * Upstream consent — applicant opts in to attorney matching directly
 * from the result page. Sets applicantStatus = "approved" immediately,
 * killing the async email-token loop that was losing ~60% of intent.
 *
 * Requires resultToken in body — the capability token sent to the applicant
 * in their confirmation email. Rejects 401 if missing or mismatched.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as { resultToken?: string };
  const { resultToken } = body;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, applicantStatus: true, maturity: true, resultToken: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!resultToken || lead.resultToken == null || lead.resultToken !== resultToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only transition from unclaimed → approved
    if (lead.applicantStatus !== "unclaimed") {
      return NextResponse.json({ ok: true, status: lead.applicantStatus });
    }

    const newMaturity = nextMaturity(lead.maturity as LeadMaturity, "consent_given");

    await prisma.lead.update({
      where: { id },
      data: {
        applicantStatus: "approved",
        ...(newMaturity ? { maturity: newMaturity } : {}),
      },
    });

    logActivity({ action: "lead.consented", detail: id });
    trackFunnel({ event: "lead.consent_given", leadId: id });

    // Fire-and-forget: confirm consent in their inbox
    if (lead.email) {
      sendConsentConfirmation({ to: lead.email, name: lead.name }).catch((e) =>
        logger.error("[lead-consent] confirmation email failed:", e)
      );
    }

    return NextResponse.json({ ok: true, status: "approved" });
  } catch (err) {
    logger.error("[lead-consent]", err);
    return NextResponse.json({ error: "Failed to save consent" }, { status: 500 });
  }
}
