import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendLeadNotification } from "@/lib/email";
import { issueToken, TTL } from "@/lib/tokens";
import { trackFunnel } from "@/lib/funnel";
import { legacyTierToCanonical } from "@/lib/scoring";

export const dynamic = "force-dynamic";

// POST /api/leads/[id]/notify — admin broadcasts a tier1/2 lead to all attorneys
async function _POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (legacyTierToCanonical(lead.tier) === "early") {
    return NextResponse.json({ error: "Only strong/developing leads are notified" }, { status: 400 });
  }

  const attorneys = await prisma.user.findMany({
    where: { role: "attorney" },
    select: { email: true, name: true },
  });

  const field = (() => {
    const fd = lead.formData as Record<string, unknown> | null;
    return fd ? String(fd.field ?? "Research") : "Research";
  })();

  const vc = lead.verifiedClaims as Record<string, unknown> | null;
  const hasVerification = vc != null && Object.keys(vc).filter(k => k !== "preliminary").length > 0;

  const { plaintext: previewToken } = await issueToken({
    kind: "lead_preview",
    subjectType: "lead",
    subjectId: id,
    ttlMs: TTL.LEAD_PREVIEW,
    createdById: session.userId,
  });

  const results = await Promise.allSettled(
    attorneys.map((a) =>
      sendLeadNotification({
        to: a.email,
        leadId: id,
        tier: lead.tier!,
        field,
        hasVerification,
        trustScore: hasVerification ? lead.trustScore : undefined,
        previewToken,
      })
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;

  if (sent > 0) trackFunnel({ event: "lead.attorney_notified", leadId: id, userId: session.userId, props: { sent, failed } });

  return NextResponse.json({ ok: true, sent, failed });
}

export const POST = withRoute(_POST);
