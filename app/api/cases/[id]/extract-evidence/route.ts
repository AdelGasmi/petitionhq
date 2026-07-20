import { NextRequest, NextResponse } from "next/server";
import { readCase, patchFormData } from "@/lib/db";
import { getSession, canAccessCase } from "@/lib/auth";
import { completeStructured, type LlmOptions } from "@/lib/lmstudio";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export type ExtractedEvidence = {
  degree: { level: string; field: string; institution: string; year: number | null } | null;
  endeavorField: string;
  publications: { title: string; venue: string; year: number | null; citations: number | null; impactFactor: number | null; journalRank: string | null }[];
  awards: { name: string; issuer: string; year: number | null }[];
  grants: { title: string; agency: string; amount: string; year: number | null }[];
  editorialRoles: { journal: string; role: string }[];
  invitedTalks: { title: string; venue: string }[];
  patents: { title: string; number: string; year: number | null; status: string }[];
  confidence: "high" | "medium" | "low";
  notes: string;
};

const MAX_CHARS = 18000; // ~4500 tokens — enough for a full CV

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Accept either a file upload (multipart) or raw text (JSON)
  let cvText = "";
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData().catch(() => null);
    if (!formData) return NextResponse.json({ error: "Could not parse upload" }, { status: 400 });

    const file = formData.get("file");
    if (!file || !(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      try {
        // Require the inner lib directly — the main entry point runs a test suite on load
        const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (buf: Buffer) => Promise<{ text: string }>;
        const result = await pdfParse(buffer);
        cvText = result.text;
      } catch (pdfErr) {
        const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
        logger.error("[extract-evidence] pdf-parse failed:", msg);
        return NextResponse.json({ error: `PDF parse failed: ${msg}` }, { status: 400 });
      }
    } else {
      // Treat as plain text (txt, md, docx plain export)
      cvText = buffer.toString("utf-8");
    }
  } else {
    // JSON with { text: "..." } — pasted CV text
    const body = await req.json().catch(() => ({})) as { text?: string };
    if (!body.text?.trim()) return NextResponse.json({ error: "No text provided" }, { status: 400 });
    cvText = body.text;
  }

  if (!cvText.trim()) return NextResponse.json({ error: "Document appears to be empty" }, { status: 400 });

  // Truncate to avoid token overflow — keep start and end (bio + publications usually at top, recent work at bottom)
  if (cvText.length > MAX_CHARS) {
    const half = MAX_CHARS / 2;
    cvText = cvText.slice(0, half) + "\n\n[...truncated...]\n\n" + cvText.slice(-half);
  }

  const llmOpts: LlmOptions = { tier: "fast", temperature: 0.1, maxTokens: 2500, usageContext: { caseId: id, route: "extract-evidence" } };

  const system = `You are an expert at parsing academic CVs and extracting structured evidence for immigration petitions. Extract all verifiable evidence from the CV text provided. Return ONLY valid JSON:
{
  "degree": { "level": string, "field": string, "institution": string, "year": number | null } | null,
  "endeavorField": string,
  "publications": [{ "title": string, "venue": string, "year": number | null, "citations": number | null, "impactFactor": number | null, "journalRank": string | null }],
  "awards": [{ "name": string, "issuer": string, "year": number | null }],
  "grants": [{ "title": string, "agency": string, "amount": string, "year": number | null }],
  "editorialRoles": [{ "journal": string, "role": string }],
  "invitedTalks": [{ "title": string, "venue": string }],
  "patents": [{ "title": string, "number": string, "year": number | null, "status": string }],
  "confidence": "high" | "medium" | "low",
  "notes": string
}

Rules:
- degree: highest degree only (PhD > MD > Master's > Bachelor's)
- endeavorField: infer from publications, job titles, and research topics — be specific (not just "Engineering")
- publications: include all peer-reviewed papers found. citations: only if explicitly stated in the CV, otherwise null. impactFactor: only if explicitly stated (e.g. "IF=14.3"), otherwise null. journalRank: extract if stated (e.g. "Q1", "Top 5%", "Nature Index"), otherwise null
- awards: only named awards — not "Best paper nominee" without a name. issuer: the organization, not the conference
- grants: include grant number or project title. amount: preserve exact text (e.g. "$1.2M", "€500,000")
- editorialRoles: reviewer, associate editor, editorial board, program committee
- invitedTalks: keynotes and invited talks only, not contributed presentations
- patents: include pending and granted
- confidence: high = clean CV with clear sections. medium = some ambiguity. low = poor formatting or incomplete
- notes: flag anything unusual or ambiguous (max 2 sentences)`;

  const user = `Extract all evidence from this CV:\n\n${cvText}`;

  try {
    const extracted = await completeStructured<ExtractedEvidence>(
      [{ role: "system", content: system }, { role: "user", content: user }],
      llmOpts
    );
    return NextResponse.json(extracted);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Merge extracted evidence into existing formData — called after user confirms
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { extracted?: ExtractedEvidence; merge?: boolean };
  const extracted = body.extracted;
  if (!extracted) return NextResponse.json({ error: "No extracted data" }, { status: 400 });

  const q = ((c.formData.qualifications ?? {}) as Record<string, unknown>);
  const e = ((c.formData.endeavor ?? {}) as Record<string, unknown>);

  // Dedup helper — normalise title/name to lowercase stripped string for comparison
  const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  function dedup<T extends Record<string, unknown>>(existing: T[], incoming: T[], key: keyof T): T[] {
    const seen = new Set(existing.map(x => norm(x[key])));
    return [...existing, ...incoming.filter(x => {
      const k = norm(x[key]);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })];
  }

  // Merge: don't overwrite fields already filled, append to lists
  const existingPubs = (q.publications as Record<string, unknown>[] | undefined) ?? [];
  const existingAwards = (q.awards as Record<string, unknown>[] | undefined) ?? [];
  const existingGrants = (q.grants as Record<string, unknown>[] | undefined) ?? [];
  const existingRoles = (q.editorialRoles as Record<string, unknown>[] | undefined) ?? [];
  const existingTalks = (q.invitedTalks as Record<string, unknown>[] | undefined) ?? [];
  const existingPatents = (q.patents as Record<string, unknown>[] | undefined) ?? [];

  const newQualifications: Record<string, unknown> = {
    ...q,
    ...(extracted.degree && !q.highestDegree ? {
      highestDegree: extracted.degree.level,
      degreeInstitution: extracted.degree.institution,
      degreeYear: extracted.degree.year,
      degreeField: extracted.degree.field,
    } : {}),
    publications: dedup(existingPubs, extracted.publications as Record<string, unknown>[], "title"),
    awards: dedup(existingAwards, extracted.awards as Record<string, unknown>[], "name"),
    grants: dedup(existingGrants, extracted.grants as Record<string, unknown>[], "title"),
    editorialRoles: dedup(existingRoles, extracted.editorialRoles as Record<string, unknown>[], "journal"),
    invitedTalks: dedup(existingTalks, extracted.invitedTalks as Record<string, unknown>[], "title"),
    patents: dedup(existingPatents, extracted.patents as Record<string, unknown>[], "title"),
  };

  const newEndeavor: Record<string, unknown> = {
    ...e,
    ...(extracted.endeavorField && !e.endeavorField ? { endeavorField: extracted.endeavorField } : {}),
  };

  await patchFormData(id, { qualifications: newQualifications, endeavor: newEndeavor });
  return NextResponse.json({ ok: true });
}
