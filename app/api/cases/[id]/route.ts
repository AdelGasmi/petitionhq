import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { readCase, patchFormData, deleteCase, patchCase } from "@/lib/db";
import { getSession, canAccessCase } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { sendCaseFiledEmail } from "@/lib/email";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

async function _GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c))
    return NextResponse.json({ error: "not found" }, { status: 404 });

  // S-10: audit log PII reads by non-owners (attorneys and admins accessing applicant data)
  if (session.role === "attorney" || session.role === "admin") {
    logActivity({ actor: session, caseId: id, caseTitle: c.title, action: "case.viewed" });
  }

  return NextResponse.json(c);
}

async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c))
    return NextResponse.json({ error: "not found" }, { status: 404 });

  // Filed cases are immutable — reject content edits (formData, title).
  // Status changes are still allowed (attorney can move filed → review if USCIS sends RFE).
  if (c.filedAt && (body.formData || body.title)) {
    return NextResponse.json(
      { error: "This case has been filed and is locked. Contact your attorney to unlock it." },
      { status: 409 }
    );
  }

  if (body.formData) await patchFormData(id, body.formData);
  if (body.title || body.status) {
    await patchCase(id, { title: body.title, status: body.status });
    if (body.status) {
      logActivity({ actor: session, caseId: id, caseTitle: c.title, action: "case.status_changed", detail: `→ ${body.status}` });
    }
    if (body.status === "filed") {
      // Set filedAt + lockedAt timestamps
      await prisma.case.update({
        where: { id },
        data: { filedAt: new Date(), lockedAt: new Date() },
      });

      const lead = await prisma.lead.findFirst({
        where: { caseId: id },
        select: { email: true, name: true },
      });
      if (lead) {
        sendCaseFiledEmail({
          to: lead.email,
          applicantName: lead.name,
          attorneyName: session.name ?? "Your attorney",
          caseTitle: c.title,
        }).catch((e) => logger.error("[case-filed] email failed:", e));
      }
    }
  }

  const updated = await readCase(id);
  return NextResponse.json(updated);
}

async function _DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c))
    return NextResponse.json({ error: "not found" }, { status: 404 });

  await deleteCase(id);
  logActivity({ actor: session, caseId: id, caseTitle: c.title, action: "case.deleted" });
  return NextResponse.json({ ok: true });
}

export const GET = withRoute(_GET);
export const PATCH = withRoute(_PATCH);
export const DELETE = withRoute(_DELETE);
