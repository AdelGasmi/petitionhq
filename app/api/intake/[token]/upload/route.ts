import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { getCaseByIntakeToken, setDocumentStatus } from "@/lib/db";
import { storagePut, storageList, storageDelete } from "@/lib/storage";
import { isIntakeVerified } from "@/lib/intake-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_DOC_IDS = new Set([
  "passport", "cv", "diplomas", "citation-reports", "i94",
  "credential-eval", "publication-pdfs", "grants-funding", "patents",
  "media-coverage", "peer-review", "endeavor-documentation",
]);

const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "image/",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
];

// S-19: Allowed file extensions
const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".gif", ".webp",
]);

const MAX_BYTES = 25 * 1024 * 1024;

function safeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 120) || "upload";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!(await isIntakeVerified(token))) {
    return NextResponse.json({ error: "Email not verified" }, { status: 403 });
  }
  const c = await getCaseByIntakeToken(token);
  if (!c) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    return NextResponse.json({ error: `Could not parse upload: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 });
  }

  const file = formData.get("file");
  const docId = String(formData.get("docId") ?? "");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file in 'file' field" }, { status: 400 });
  }
  if (!docId || !ALLOWED_DOC_IDS.has(docId)) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: "File is empty" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 413 });
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
    return NextResponse.json({ error: `Unsupported file type: ${mime}` }, { status: 415 });
  }

  // S-19: Validate file extension
  const ext = file.name?.includes(".") ? ("." + file.name.split(".").pop()!.toLowerCase()) : "";
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: `File extension not allowed: ${ext || "(none)"}` }, { status: 415 });
  }

  // Replace any previous upload for this doc slot
  const prefix = `uploads/${c.id}/${docId}/`;
  const existing = await storageList(prefix);
  await Promise.all(existing.map((k) => storageDelete(k)));

  const original = safeFilename(file.name || "upload");
  const rnd = new Uint8Array(4);
  crypto.getRandomValues(rnd);
  const hex = Array.from(rnd).map((b) => b.toString(16).padStart(2, "0")).join("");
  const storageKey = `${prefix}${hex}-${original}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await storagePut(storageKey, buffer, mime);

  await setDocumentStatus(c.id, docId, {
    status: "uploaded",
    filename: original,
    storedFilename: storageKey,
    mimeType: mime,
    size: file.size,
  });

  return NextResponse.json({ ok: true, filename: original, size: file.size });
}
