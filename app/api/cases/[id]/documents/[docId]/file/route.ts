import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { readCase } from "@/lib/db";
import { getSession, canAccessCase } from "@/lib/auth";
import { storageGet, storageExists } from "@/lib/storage";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, docId } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c)) {
    return NextResponse.json({ error: "case not found" }, { status: 404 });
  }

  const doc = c.documents[docId];
  if (!doc?.storedFilename) {
    return NextResponse.json({ error: "no file uploaded" }, { status: 404 });
  }

  // storedFilename is the full storage key (e.g. "uploads/caseId/docId/abc-file.pdf")
  const key = doc.storedFilename;
  if (!await storageExists(key)) {
    return NextResponse.json({ error: "file missing in storage" }, { status: 404 });
  }

  const buffer = await storageGet(key, "secure");

  // S-10: audit document downloads by attorneys and admins
  if (session.role === "attorney" || session.role === "admin") {
    logActivity({ actor: session, caseId: id, caseTitle: c.title, action: "document.downloaded", detail: doc.filename ?? docId });
  }

  const inline = new URL(req.url).searchParams.get("download") !== "1" ? "inline" : "attachment";
  const filenameForHeader = (doc.filename || key.split("/").pop() || "file").replace(/"/g, "");

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `${inline}; filename="${filenameForHeader}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const GET = withRoute(_GET);
