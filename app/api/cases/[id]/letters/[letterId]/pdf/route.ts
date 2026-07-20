import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { readCase } from "@/lib/db";
import { getForm } from "@/forms";
import { getSession, canAccessCase, canDraftCase } from "@/lib/auth";
import { generateLetterPdf } from "@/lib/letterPdf";
import { petitionerSlug, petitionLetterFilename, recLetterFilename } from "@/lib/fileNames";

export const dynamic = "force-dynamic";

async function _GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; letterId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, letterId } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canDraftCase(session, c)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const letter = c.letters[letterId];
  if (!letter) return NextResponse.json({ error: "Letter not found" }, { status: 404 });

  if (!letter.currentDraft)
    return NextResponse.json({ error: "No draft to export yet" }, { status: 400 });

  const form = getForm(c.formId);
  const letterReq = form?.letters.find((l) => l.id === letter.requirementId);
  const isPetition = letterReq?.kind === "petition-letter";

  const petitionerInfo = (c.formData.petitionerInfo ?? {}) as Record<string, unknown>;
  const applicantName = [
    String(petitionerInfo.givenName ?? ""),
    String(petitionerInfo.familyName ?? ""),
  ].filter(Boolean).join(" ") || "Applicant";

  const pdfBuffer = await generateLetterPdf(letter, {
    isPetition: isPetition ?? false,
    applicantName,
    caseTitle: c.title,
  });

  const filename = isPetition
    ? petitionLetterFilename(petitionerInfo, "pdf")
    : recLetterFilename(letter.recommender.name, petitionerInfo, "pdf");

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export const GET = withRoute(_GET);
