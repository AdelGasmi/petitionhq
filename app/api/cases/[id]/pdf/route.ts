import { NextRequest, NextResponse } from "next/server";
import { readCase } from "@/lib/db";
import { getSession, canAccessCase } from "@/lib/auth";
import { getFieldMap, fillPdf } from "@/lib/pdf";
import { getForm } from "@/forms";
import { formPdfFilename } from "@/lib/fileNames";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  // UPL guard (2026-07-05): official-USCIS-form auto-fill is attorney tooling
  // only. Self-petitioners (incl. beta) get letters/brief/evidence surfaces,
  // never filled government forms — see self_petitioner_beta.md §4.4.
  if (session.role !== "attorney") {
    return new NextResponse(
      JSON.stringify({ error: "Form auto-fill is available to attorneys only." }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const { id } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c))
    return new NextResponse("Not found", { status: 404 });

  const map = getFieldMap(c.formId);
  if (!map) {
    return new NextResponse(
      JSON.stringify({ error: `PDF auto-fill is not yet available for form ${c.formId}.` }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const pdfBytes = await fillPdf(map, c.formData as Record<string, unknown>);
    const petitionerInfo = (c.formData as Record<string, unknown>).petitionerInfo as Record<string, unknown> | null;
    const formNumber = getForm(c.formId)?.formNumber ?? c.formId.toUpperCase();
    const filename = formPdfFilename(formNumber, petitionerInfo);

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("[pdf] fill error:", msg);
    return new NextResponse(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
