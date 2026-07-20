import { NextRequest, NextResponse } from "next/server";
import { deleteCase, patchCase, setAttorney } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { findUserById } from "@/lib/users";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/** PATCH — bulk reassign attorney or bulk change status */
export async function PATCH(req: NextRequest) {
  let admin;
  try { admin = await requireAdmin(); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { action, caseIds, attorneyId, status } = await req.json();

  if (!Array.isArray(caseIds) || caseIds.length === 0)
    return NextResponse.json({ error: "caseIds required" }, { status: 400 });

  if (action === "reassign") {
    if (!attorneyId) return NextResponse.json({ error: "attorneyId required" }, { status: 400 });
    const user = await findUserById(attorneyId);
    if (!user || user.role !== "attorney")
      return NextResponse.json({ error: "Not a valid attorney" }, { status: 400 });
    await Promise.all(caseIds.map((id: string) => setAttorney(id, attorneyId)));
    logActivity({ actor: admin, action: "case.attorney_assigned", detail: `Bulk: ${caseIds.length} cases → ${user.name}` });
    return NextResponse.json({ ok: true, affected: caseIds.length });
  }

  if (action === "status") {
    const valid = ["draft", "review", "ready", "filed"];
    if (!status || !valid.includes(status))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    await Promise.all(caseIds.map((id: string) => patchCase(id, { status })));
    logActivity({ actor: admin, action: "case.status_changed", detail: `Bulk: ${caseIds.length} cases → ${status}` });
    return NextResponse.json({ ok: true, affected: caseIds.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/** DELETE — bulk delete cases */
export async function DELETE(req: NextRequest) {
  let admin;
  try { admin = await requireAdmin(); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { caseIds } = await req.json();
  if (!Array.isArray(caseIds) || caseIds.length === 0)
    return NextResponse.json({ error: "caseIds required" }, { status: 400 });

  await Promise.all(caseIds.map((id: string) => deleteCase(id)));
  logActivity({ actor: admin, action: "case.deleted", detail: `Bulk: ${caseIds.length} cases` });
  return NextResponse.json({ ok: true, affected: caseIds.length });
}
