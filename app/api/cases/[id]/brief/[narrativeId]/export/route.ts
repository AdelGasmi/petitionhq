import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { readCase } from "@/lib/db";
import { getForm } from "@/forms";
import { getSession, canAccessCase, canDraftCase } from "@/lib/auth";
import { generatePetitionBriefDocx, type BriefSection } from "@/lib/petitionBriefDocx";
import { generatePetitionBriefPdf } from "@/lib/petitionBriefPdf";

export const dynamic = "force-dynamic";

/**
 * GET /api/cases/[id]/brief/[narrativeId]/export?format=pdf|docx
 *
 * Exports the case-workspace petition brief (the section-by-section draft in
 * `formData.narrativeDrafts[narrativeId]`) as a white-label PDF or DOCX.
 * Attorney-on-case, or the case owner if flagged into the self-petitioner
 * beta (canDraftCase); BOLA-gated by canAccessCase.
 */
async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; narrativeId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, narrativeId } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canDraftCase(session, c))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = getForm(c.formId);
  const narrative = form?.narratives?.find((n) => n.id === narrativeId);
  if (!narrative) return NextResponse.json({ error: "Narrative not found" }, { status: 404 });

  const narrativeDrafts = (c.formData.narrativeDrafts ?? {}) as Record<string, unknown>;
  const drafts = (narrativeDrafts[narrativeId] ?? {}) as Record<string, string>;

  // Assemble sections in outline order; include every outline section so the
  // exported brief is structurally complete (un-drafted sections render a
  // visible placeholder rather than silently disappearing).
  const sections: BriefSection[] = narrative.outline.map((s) => ({
    heading: s.heading,
    body: typeof drafts[s.id] === "string" ? drafts[s.id] : "",
  }));

  if (sections.every((s) => !s.body.trim())) {
    return NextResponse.json({ error: "No brief sections drafted yet." }, { status: 400 });
  }

  const petitionerInfo = (c.formData.petitionerInfo ?? {}) as Record<string, unknown>;
  const petitionerName =
    [String(petitionerInfo.givenName ?? ""), String(petitionerInfo.familyName ?? "")]
      .filter(Boolean)
      .join(" ") || "Applicant";
  const title = c.title || "EB-2 NIW Petition Brief";

  const safeBase =
    `${petitionerName} - Petition Brief`.replace(/[^a-z0-9 .\-]/gi, "").trim() || "Petition Brief";

  const format = (req.nextUrl.searchParams.get("format") ?? "pdf").toLowerCase();

  if (format === "docx") {
    const buf = await generatePetitionBriefDocx(sections, { title, petitionerName });
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeBase}.docx"`,
      },
    });
  }

  const buf = await generatePetitionBriefPdf(sections, { title, petitionerName });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeBase}.pdf"`,
    },
  });
}

export const GET = withRoute(_GET);
