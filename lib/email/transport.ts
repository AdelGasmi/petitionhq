import nodemailer from "nodemailer";
import { prisma } from "../prisma";
import type { SessionPayload } from "../auth";
import logger from "../logger";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: process.env.SMTP_SECURE === "true",
  auth:
    process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
});

// In dev/testing without a verified domain, override all recipients to your own address.
// S-11: throw in production so a misconfigured env doesn't silently leak real emails.
export const resolveRecipient = (to: string): string => {
  const override = process.env.SMTP_TO_OVERRIDE;
  if (override) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`[email] SMTP_TO_OVERRIDE is set in production — remove it to deliver real emails.`);
    }
    return override;
  }
  return to;
};

export async function recordEmail(opts: {
  to: string;
  subject: string;
  kind: string;
  caseId?: string;
  caseTitle?: string;
  actor?: SessionPayload | null;
  status: "sent" | "failed";
  error?: string;
}) {
  try {
    await prisma.emailLog.create({
      data: {
        to: opts.to,
        subject: opts.subject,
        kind: opts.kind,
        caseId: opts.caseId,
        caseTitle: opts.caseTitle,
        actorId: opts.actor?.userId,
        actorName: opts.actor?.name,
        status: opts.status,
        error: opts.error,
      },
    });
  } catch { /* never break actual send */ }
}

export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://petitionhq.us";

/** S-22: HTML-escape user-supplied strings before interpolation into email HTML. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Tier labels for attorney-facing / admin contexts */
export const TIER_LABEL_ADMIN: Record<string, string> = {
  tier1: "Tier 1 — Strong",
  tier2: "Tier 2 — Developing",
  tier3: "Tier 3 — Early Stage",
};

/** Tier labels for applicant-facing contexts — never show "Borderline" */
export const TIER_LABEL_APPLICANT: Record<string, string> = {
  tier1: "Strong Foundation",
  tier2: "Developing Case",
  tier3: "Early-Stage Profile",
};

/** Admin alert emoji */
export const TIER_EMOJI: Record<string, string> = {
  tier1: "🟢",
  tier2: "🟡",
  tier3: "🔴",
};

// Shared email wrapper — consistent brand look across all emails
export function emailWrapper(bodyHtml: string) {
  return `
    <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;color:#1a1a1a;line-height:1.75;padding:0 0 32px">
      <div style="border-bottom:2px solid #1c1917;padding:24px 0 16px;margin-bottom:32px">
        <span style="font-family:system-ui,sans-serif;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#1c1917">
          petitionhq.us
        </span>
      </div>
      ${bodyHtml}
      <div style="border-top:1px solid #e7e5e4;margin-top:40px;padding-top:20px">
        <p style="font-size:12px;color:#a8a29e;margin:0;line-height:1.6">
          petitionhq.us — EB-2 NIW made accessible.<br/>
          Questions? Reply to this email — a real person reads every reply.
        </p>
      </div>
    </div>
  `;
}

export { logger };
