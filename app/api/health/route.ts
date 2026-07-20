import { NextResponse } from "next/server";
import { llmHealthCheck } from "@/lib/llm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [llm, db, storage] = await Promise.allSettled([
    llmHealthCheck(),
    prisma.$queryRaw`SELECT 1`.then(() => ({ ok: true })),
    checkStorage(),
  ]);

  const llmResult = llm.status === "fulfilled" ? llm.value : { ok: false, provider: "unknown", error: "check failed" };
  const dbResult = db.status === "fulfilled";
  const storageResult = storage.status === "fulfilled"
    ? (storage as PromiseFulfilledResult<{ ok: boolean; backend: string }>).value
    : { ok: false, backend: process.env.STORAGE_BACKEND ?? "local" };

  const result = {
    ok: dbResult && llmResult.ok,
    db: dbResult ? "ok" : "error",
    llm: llmResult,
    storage: storageResult,
    storageBackend: process.env.STORAGE_BACKEND ?? "local",
    ts: new Date().toISOString(),
  };

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}

async function checkStorage(): Promise<{ ok: boolean; backend: string }> {
  const backend = process.env.STORAGE_BACKEND ?? "local";
  if (backend === "r2") {
    const missing = ["R2_ENDPOINT", "R2_BUCKET_SECURE", "R2_BUCKET_PUBLIC", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]
      .filter((k) => !process.env[k]);
    if (missing.length) throw new Error(`R2 env vars missing: ${missing.join(", ")}`);
  }
  return { ok: true, backend };
}
