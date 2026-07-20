import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { readCase } from "@/lib/db";
import { getForm } from "@/forms";
import { getSession, canAccessCase, canDraftCase } from "@/lib/auth";
import { generateLetterPdf } from "@/lib/letterPdf";
import { sendLetterEmail } from "@/lib/email";
import { petitionLetterFilename, recLetterFilename } from "@/lib/fileNames";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function _POST(
  req: NextRequest,
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
    return NextResponse.json({ error: "No draft to send yet" }, { status: 400 });

  const { to } = await req.json();
  if (!to?.trim()) return NextResponse.json({ error: "Recipient email required" }, { status: 400 });

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

  const subject = isPetition
    ? `NIW Petition Letter — ${applicantName}`
    : `Letter of Recommendation for ${applicantName} — from ${letter.recommender.name}`;

  const firm = await prisma.firmProfile.findUnique({
    where: { userId: session.userId },
    select: { firmName: true },
  });
  const firmName = firm?.firmName ?? undefined;
  await sendLetterEmail({
    to: to.trim(),
    subject,
    recipientName: isPetition ? undefined : letter.recommender.name,
    applicantName,
    letterType: isPetition ? "I-140 Petition Letter" : "Recommendation Letter",
    pdfBuffer,
    filename,
    firmName,
    attorneyName: session.name ?? undefined,
    caseId: id,
    caseTitle: c.title,
    actor: session,
  });

  return NextResponse.json({ ok: true });
}

export const POST = withRoute(_POST);
