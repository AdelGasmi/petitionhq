/**
 * Diagnostic endpoint — tests LLM, storage, and email with real calls.
 * Only accessible with CRON_SECRET header to prevent public exposure.
 *
 * GET /api/diag
 * Header: x-cron-secret: <CRON_SECRET>
 *
 * Returns:
 *   { llm, storage, email, ts }
 *
 * Storage key namespace:
 *   secure/
 *     uploads/<caseId>/<docId>/<filename>   evidence docs
 *     dossiers/<caseId>/dossier.pdf         AI-generated PDFs
 *     intake/<token>/<filename>             intake attachments
 *     diag/test-<ts>.txt                    (auto-deleted)
 *   public/
 *     assets/logos/<filename>              logos, UI images
 *     assets/og/<filename>                 open graph images
 */

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getModel } from "@/lib/llm";
import { storagePut, storageGet, storageDelete } from "@/lib/storage";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [llm, storage, email] = await Promise.allSettled([testLlm(), testStorage(), testEmail()]);

  const result = {
    llm:     llm.status     === "fulfilled" ? llm.value     : { ok: false, error: String((llm     as PromiseRejectedResult).reason) },
    storage: storage.status === "fulfilled" ? storage.value : { ok: false, error: String((storage as PromiseRejectedResult).reason) },
    email:   email.status   === "fulfilled" ? email.value   : { ok: false, error: String((email   as PromiseRejectedResult).reason) },
    ts: new Date().toISOString(),
  };

  const allOk = result.llm.ok && result.storage.ok && result.email.ok;
  return NextResponse.json(result, { status: allOk ? 200 : 500 });
}

// ---------------------------------------------------------------------------

async function testLlm(): Promise<{ ok: boolean; provider: string; model: string; response?: string; error?: string }> {
  const provider = process.env.LLM_PROVIDER ?? "lmstudio";
  const model = getModel("fast");

  const { text } = await generateText({
    model,
    system: "You are a test assistant.",
    messages: [{ role: "user", content: 'Reply with exactly the word "pong" and nothing else.' }],
    maxOutputTokens: 10,
    temperature: 0,
  });

  if (!text.toLowerCase().includes("pong")) {
    return { ok: false, provider, model: String(model), error: `Unexpected response: "${text}"` };
  }

  return { ok: true, provider, model: String(model), response: text.trim() };
}

async function testStorage(): Promise<{ ok: boolean; backend: string; error?: string }> {
  const backend = process.env.STORAGE_BACKEND ?? "local";
  const key = `diag/test-${Date.now()}.txt`;
  const payload = Buffer.from("petitionhq-diag-ok");

  await storagePut(key, payload, "text/plain", "secure");
  const read = await storageGet(key, "secure");
  await storageDelete(key, "secure");

  if (read.toString() !== "petitionhq-diag-ok") {
    throw new Error(`Round-trip mismatch: got "${read.toString()}"`);
  }

  return { ok: true, backend };
}

async function testEmail(): Promise<{ ok: boolean; transport: string; messageId?: string; mailpitVerified?: boolean; error?: string }> {
  const host = process.env.SMTP_HOST ?? "localhost";
  const port = Number(process.env.SMTP_PORT ?? 1025);
  const transport = `${host}:${port}`;

  const t = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  const tag = `diag-${Date.now()}`;
  const info = await t.sendMail({
    from: process.env.SMTP_FROM ?? "PetitionHQ <hello@petitionhq.us>",
    to: "diag@petitionhq.test",
    subject: `[diag] email round-trip ${tag}`,
    text: `Automated diagnostic email. Tag: ${tag}`,
  });

  // In local dev, verify against Mailpit REST API
  let mailpitVerified: boolean | undefined;
  const mailpitBase = `http://${host === "localhost" ? "localhost" : host}:8025`;
  try {
    const res = await fetch(`${mailpitBase}/api/v1/search?query=${encodeURIComponent(tag)}&limit=1`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json() as { messages?: { Subject: string }[] };
      mailpitVerified = (data.messages?.length ?? 0) > 0;
    }
  } catch { /* mailpit not available in prod — skip verify */ }

  return {
    ok: true,
    transport,
    messageId: info.messageId,
    ...(mailpitVerified !== undefined ? { mailpitVerified } : {}),
  };
}
