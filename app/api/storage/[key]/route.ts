import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { storageGet } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Local-backend proxy for storageSignUrl. Never enabled when STORAGE_BACKEND=r2
// (the R2 path returns a direct signed URL, bypassing this route entirely).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  if (process.env.STORAGE_BACKEND === "r2") {
    return new NextResponse("Not used in R2 mode", { status: 404 });
  }

  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });

  const { key } = await params;
  const decoded = decodeURIComponent(key);

  try {
    const buf = await storageGet(decoded, "secure");
    const ext = decoded.split(".").pop()?.toLowerCase() ?? "";
    const mime = ext === "pdf" ? "application/pdf"
      : ext === "png" ? "image/png"
      : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : "application/octet-stream";

    return new NextResponse(buf as unknown as BodyInit, {
      headers: { "Content-Type": mime, "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
