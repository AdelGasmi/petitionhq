/**
 * POST /api/upload-url
 *
 * Generates a presigned PUT URL so the browser can upload a file directly to
 * the Cloudflare R2 SECURE bucket without routing through the Next.js server.
 *
 * Flow:
 *   1. Browser calls POST /api/upload-url  with { caseId, docId, filename, mimeType }
 *   2. Server validates auth, generates presigned PUT URL
 *   3. Browser PUTs file directly to R2 using that URL
 *   4. Browser calls the normal document API to record the storage key in DB
 *
 * Auth: attorney, admin, or applicant who owns the case.
 *
 * Body:
 *   { caseId: string, docId: string, filename: string, mimeType: string }
 *
 * Response:
 *   { url: string, key: string, expiresIn: number }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, canAccessCase } from "@/lib/auth";
import { readCase } from "@/lib/db";
import { storagePresignPut } from "@/lib/storage";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

// Allowed MIME types for user uploads
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
]);

// S-19: Allowed file extensions (must match MIME type)
const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".txt",
]);

// Max file size: 25 MB
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { caseId?: string; docId?: string; filename?: string; mimeType?: string; size?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { caseId, docId, filename, mimeType, size } = body;

  // Validate required fields
  if (!caseId || !docId || !filename || !mimeType) {
    return NextResponse.json(
      { error: "Required: caseId, docId, filename, mimeType" },
      { status: 400 }
    );
  }

  // S-19: Validate file extension
  const ext = filename.includes(".") ? ("." + filename.split(".").pop()!.toLowerCase()) : "";
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: `File extension not allowed: ${ext || "(none)"}. Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}.` },
      { status: 400 }
    );
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: `File type not allowed: ${mimeType}. Allowed: PDF, Word, JPEG, PNG, plain text.` },
      { status: 400 }
    );
  }

  // Validate file size if provided
  if (size !== undefined && size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File too large. Maximum size: ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.` },
      { status: 400 }
    );
  }

  // Verify case access
  const c = await readCase(caseId);
  if (!c || !canAccessCase(session, c)) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  // Sanitize filename: strip path traversal, normalize extension
  const safeName = filename.replace(/[^a-zA-Z0-9._\-]/g, "_").slice(0, 128);
  const key = `uploads/${caseId}/${docId}/${safeName}`;

  try {
    const { url, key: finalKey } = await storagePresignPut(key, mimeType); // S-20: 5 min default
    return NextResponse.json({ url, key: finalKey, expiresIn: 300 });
  } catch (err) {
    logger.error("[upload-url] Failed to generate presigned URL:", err);
    return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
  }
}
