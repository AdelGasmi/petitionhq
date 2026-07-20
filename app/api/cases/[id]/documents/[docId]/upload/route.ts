import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { readCase, setDocumentStatus } from "@/lib/db";
import { getSession, canAccessCase } from "@/lib/auth";
import { storagePut, storageDelete, storageList } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED_MIME_PREFIXES = [
  "application/pdf",
  "image/",
  "text/",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
];

// S-19: Allowed file extensions
const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".txt",
]);

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

function safeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 120) || "upload";
}

function uploadPrefix(caseId: string, docId: string): string {
  return `uploads/${caseId}/${docId}/`;
}

export async function POST(
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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    return NextResponse.json({ error: `Could not parse upload: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file in 'file' field" }, { status: 400 });
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

  // Delete any previous file for this doc slot
  const prefix = uploadPrefix(id, docId);
  const existing = await storageList(prefix);
  await Promise.all(existing.map((k) => storageDelete(k)));

  const original = safeFilename(file.name || "upload");
  const rnd = new Uint8Array(4);
  crypto.getRandomValues(rnd);
  const hex = Array.from(rnd).map((b) => b.toString(16).padStart(2, "0")).join("");
  const stored = `${hex}-${original}`;
  const storageKey = `${prefix}${stored}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await storagePut(storageKey, buffer, mime);

  const updated = await setDocumentStatus(id, docId, {
    status: "uploaded",
    filename: original,
    storedFilename: storageKey, // store the full key, not just the basename
    mimeType: mime,
    size: file.size,
  });

  return NextResponse.json({
    ok: true,
    filename: original,
    size: file.size,
    mimeType: mime,
    document: updated?.documents[docId] ?? null,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, docId } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c)) {
    return NextResponse.json({ error: "case not found" }, { status: 404 });
  }

  const prefix = uploadPrefix(id, docId);
  const existing = await storageList(prefix);
  await Promise.all(existing.map((k) => storageDelete(k)));

  await setDocumentStatus(id, docId, {
    status: "missing",
    filename: undefined,
    storedFilename: undefined,
    mimeType: undefined,
    size: undefined,
  });
  return NextResponse.json({ ok: true });
}
