/**
 * GET /api/download-url?key=<storageKey>&ttl=<seconds>
 *
 * Generates a presigned GET URL for an object in the SECURE R2 bucket.
 * Used by the attorney/admin dashboard to view user CVs and documents.
 *
 * Auth: attorney or admin only. Applicants cannot use this endpoint
 *       (they access their own uploads through the case workspace directly).
 *
 * Query params:
 *   key  — storage key, e.g. "uploads/caseId/docId/cv.pdf"
 *   ttl  — optional, seconds (default: 900 = 15 min, max: 3600)
 *
 * Response:
 *   { url: string, expiresAt: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { storageSignUrl } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_TTL = 3600; // 1 hour hard cap

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only attorneys and admins can generate download links
  if (session.role !== "attorney" && session.role !== "admin") {
    return NextResponse.json(
      { error: "Only attorneys and admins may generate download links" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const ttlParam = parseInt(searchParams.get("ttl") ?? "900", 10);

  if (!key) {
    return NextResponse.json({ error: "Missing required query param: key" }, { status: 400 });
  }

  // Block path traversal attempts
  if (key.includes("..") || key.startsWith("/")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  // For attorneys, verify the key belongs to a case they're assigned to
  // or a lead they've claimed. Admins can sign any key.
  if (session.role === "attorney") {
    const allowed = await attorneyMayAccessKey(key, session.userId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Cap TTL: 60s minimum, 3600s maximum
  const ttl = Math.max(60, Math.min(ttlParam, MAX_TTL));

  try {
    const url = await storageSignUrl(key, ttl, "secure");
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    return NextResponse.json({ url, expiresAt });
  } catch (err) {
    logger.error("[download-url] Failed to generate presigned URL:", err);
    return NextResponse.json({ error: "Failed to generate download URL" }, { status: 500 });
  }
}

async function attorneyMayAccessKey(key: string, attorneyId: string): Promise<boolean> {
  // Case document: uploads/<caseId>/<docId>/<file>
  const uploadMatch = key.match(/^uploads\/([^/]+)\//);
  if (uploadMatch) {
    const c = await prisma.case.findUnique({
      where: { id: uploadMatch[1] },
      select: { attorneyId: true },
    });
    return c?.attorneyId === attorneyId;
  }

  // Dossier: dossiers/<folder>/<leadId>.pdf
  const dossierMatch = key.match(/^dossiers\/[^/]+\/([^/]+)\.pdf$/);
  if (dossierMatch) {
    const lead = await prisma.lead.findUnique({
      where: { id: dossierMatch[1] },
      select: { claimedByUserId: true },
    });
    return lead?.claimedByUserId === attorneyId;
  }

  return false;
}
