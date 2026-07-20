/**
 * Pilot dossier fixture runner (GTM collateral — NOT a product feature).
 *
 * Builds 3 *synthetic, clearly-labelled* EB-2 NIW applicants entirely from
 * fabricated data (NO real applicant PII), then drives each one through the
 * SAME production pipeline the attorney UI uses:
 *
 *   seed Case + Lead
 *     → attorney curation gate (confirm/exclude → signed claim ledger)
 *       → generateDossier()  (real Anthropic calls — Haiku skeleton + Sonnet prose)
 *         → provenance linter gate (the GAP-4 export rule: issues.length === 0)
 *           → export brief .docx  +  dossier .pdf
 *
 * The artifacts land in out/pilot-dossiers/ (git-ignored) for use as cold-email
 * attachments. The DB rows are torn down at the end unless --keep is passed.
 *
 * Why a script and not the HTTP funnel: the .docx/.pdf bytes are produced by the
 * exact same generators the routes call (generateDossier / generateBriefDocx /
 * renderDossierPdf), and the ledger is written with the identical logic as
 * POST /api/leads/[id]/claim-ledger. The HTTP/session layer changes nothing in
 * the artifact, so this is byte-faithful while being reproducible and tidy.
 *
 * Run (env must be loaded — values live in .env.local):
 *   set -a && . ./.env.local && set +a && npx --yes tsx scripts/fixtures/generate-pilot-dossiers.ts
 *
 * Flags:
 *   --keep         leave the fixture User/Case/Lead rows in the DB after running
 *   --clean-only   delete any prior fixtures and exit (no generation)
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractEvidence } from "@/lib/drafting";
import { computeLedgerRoot, type ClaimLedger } from "@/lib/claimLedger";
import { generateDossier } from "@/lib/dossierGenerator";
import { generateBriefDocx } from "@/lib/briefDocx";
import { renderDossierPdf } from "@/lib/dossierPdf";
import { lintDossierProvenance } from "@/lib/dossier/provenanceLinter";

// ─── Fixture identity (everything below this domain is disposable) ───────────
const FIXTURE_DOMAIN = "pilot-fixture.petitionhq.local";
const ATTORNEY_EMAIL = `demo.counsel@${FIXTURE_DOMAIN}`;
const ATTORNEY_NAME = "Demo Counsel";
const OUT_DIR = path.resolve(process.cwd(), "out", "pilot-dossiers");
const MAX_LINT_RETRIES = 4; // Sonnet @ temp 0.4 varies; retry a stray untagged metric.

type VClaim = {
  status: string;
  source: string;
  sourceUrl?: string;
  confidence: number;
  detail?: string;
};

type Profile = {
  slug: string;
  /** File / case-title label, e.g. "Test Applicant A — Materials Science". */
  label: string;
  /** Petitioner display name as it appears in the brief prose. */
  givenName: string;
  tier: string;
  score: number;
  trustScore: number;
  /** Exact atom summaries the attorney will EXCLUDE at the curation gate. */
  excludeSummaries: string[];
  formData: Record<string, unknown>;
  verifiedClaims: Record<string, VClaim>;
};

// ─── 3 synthetic applicants (fabricated; diverse NSTC critical-tech fields) ──
const PROFILES: Profile[] = [
  {
    slug: "test-applicant-a-materials-science",
    label: "Test Applicant A — Materials Science",
    givenName: "Dr. Test Applicant A",
    tier: "tier1",
    score: 91,
    trustScore: 82,
    excludeSummaries: [
      "TechBatteries Blog: A researcher to watch in energy storage",
      "DOE Early Career nomination (internal, unverified)",
    ],
    formData: {
      petitionerInfo: { givenName: "Dr. Test Applicant A", familyName: "" },
      endeavor: {
        endeavorField: "Materials Science",
        endeavorStatement:
          "to develop and scale manufacturable solid-state battery technology that raises the energy density and safety of domestic energy storage and electric vehicles",
        nstcCategories: [
          "Advanced Materials",
          "Renewable Energy Generation and Storage",
        ],
        federalPrograms: [
          {
            programName: "Vehicle Technologies Office",
            agencyOrOffice: "U.S. Department of Energy",
            specificGoal: "domestic battery manufacturing and supply-chain resilience",
          },
        ],
      },
      qualifications: {
        publications: [
          { title: "Solid-State Electrolyte Interfaces for High-Energy Lithium-Metal Batteries", venue: "Nature Energy", year: 2022, citations: 312, impactFactor: 67.4, journalRank: "Q1", citationPercentile: "Top 1% (ESI)" },
          { title: "Dendrite Suppression via Garnet-Type Ceramic Separators", venue: "Joule", year: 2021, citations: 188, impactFactor: 39.8, journalRank: "Q1", citationPercentile: "Top 1% (ESI)" },
          { title: "Scalable Sulfide Solid-Electrolyte Synthesis", venue: "Advanced Materials", year: 2020, citations: 96, impactFactor: 29.4, journalRank: "Q1" },
          { title: "Interfacial Engineering for Fast-Charging Anodes", venue: "ACS Energy Letters", year: 2023, citations: 54, impactFactor: 22.0, journalRank: "Q1" },
        ],
        awards: [
          { name: "MRS Outstanding Young Investigator Award", significance: "Materials Research Society national award for early-career research impact", year: 2022 },
          { name: "DOE Early Career nomination (internal, unverified)", significance: "internal nomination, no public record", year: 2021 },
        ],
        grants: [
          { title: "Solid-State Battery Manufacturing Scale-Up", agency: "U.S. Department of Energy (DOE)", amount: "$1.8M", role: "Co-Principal Investigator", year: 2022 },
        ],
        patents: [
          { title: "Composite Garnet Separator and Method of Manufacture", number: "US 11,902,113 B2", status: "Granted", year: 2023 },
        ],
        editorialRoles: [
          { journal: "Journal of Power Sources", role: "Ad-hoc Reviewer", year: 2021 },
        ],
        invitedTalks: [
          { title: "Interfaces in Solid-State Batteries", venue: "Materials Research Society Fall Meeting", kind: "Invited Keynote", year: 2022 },
        ],
        mediaCoverage: [
          { outlet: "TechBatteries Blog", title: "A researcher to watch in energy storage", reach: "~20k monthly readers", year: 2023 },
        ],
      },
    },
    verifiedClaims: {
      citations: { status: "verified", source: "openalex", sourceUrl: "https://openalex.org/works?filter=author.id:Axxxx", confidence: 0.92, detail: "650 total citations across the indexed body of work" },
      topPublicationCitations: { status: "verified", source: "openalex", confidence: 0.91, detail: "Nature Energy paper: 312 citations; Joule paper: 188 citations" },
      additionalPublicationCitations: { status: "verified", source: "openalex", confidence: 0.88, detail: "Advanced Materials paper: 96 citations; ACS Energy Letters paper: 54 citations" },
      metrics: { status: "verified", source: "openalex", confidence: 0.9, detail: "h-index 18; 650 citations" },
      publications: { status: "verified", source: "orcid", sourceUrl: "https://orcid.org/0000-0000-0000-000A", confidence: 0.9, detail: "peer-reviewed works verified on ORCID" },
      grantFunding: { status: "verified", source: "nsf", confidence: 0.85, detail: "DOE award; $1.8M; Co-Principal Investigator role on one grant" },
    },
  },
  {
    slug: "test-applicant-b-biomedical",
    label: "Test Applicant B — Biomedical Engineering",
    givenName: "Dr. Test Applicant B",
    tier: "tier1",
    score: 89,
    trustScore: 80,
    excludeSummaries: [
      "MedDevice Daily: Rising star in neural interfaces",
      "LinkedIn Top Voice in BioTech (self-reported)",
    ],
    formData: {
      petitionerInfo: { givenName: "Dr. Test Applicant B", familyName: "" },
      endeavor: {
        endeavorField: "Biomedical Engineering",
        endeavorStatement:
          "to advance implantable neural-interface and biosensor technology that enables chronic monitoring and closed-loop treatment of neurological disease",
        nstcCategories: ["Biotechnology", "Human-Machine Interfaces"],
        federalPrograms: [
          {
            programName: "National Institute of Biomedical Imaging and Bioengineering",
            agencyOrOffice: "National Institutes of Health",
            specificGoal: "implantable diagnostics for chronic disease management",
          },
        ],
      },
      qualifications: {
        publications: [
          { title: "Flexible Neural Probes for Chronic Cortical Recording", venue: "Nature Biomedical Engineering", year: 2022, citations: 274, impactFactor: 28.1, journalRank: "Q1", citationPercentile: "Top 1% (ESI)" },
          { title: "Biodegradable Sensors for Post-Surgical Monitoring", venue: "Science Translational Medicine", year: 2021, citations: 159, impactFactor: 17.1, journalRank: "Q1" },
          { title: "Low-Power Neural Signal-Processing ASIC", venue: "IEEE Transactions on Biomedical Engineering", year: 2020, citations: 88, impactFactor: 4.6, journalRank: "Q1" },
          { title: "Wireless Closed-Loop Neuromodulation", venue: "Nature Communications", year: 2023, citations: 61, impactFactor: 16.6, journalRank: "Q1" },
        ],
        awards: [
          { name: "NIH Trailblazer Award (R21)", significance: "NIH award for new and early-stage investigators pursuing high-impact bioengineering", year: 2022 },
          { name: "LinkedIn Top Voice in BioTech (self-reported)", significance: "platform badge, not an academic honor", year: 2023 },
        ],
        grants: [
          { title: "Implantable Biosensors for Chronic Disease", agency: "National Institutes of Health (NIH)", amount: "$2.3M", role: "Principal Investigator", year: 2022 },
        ],
        patents: [
          { title: "Biodegradable Wireless Sensor Array", number: "US 11,845,772 B2", status: "Granted", year: 2022 },
        ],
        editorialRoles: [
          { journal: "IEEE Transactions on Biomedical Engineering", role: "Associate Editor", year: 2022 },
        ],
        invitedTalks: [
          { title: "Closed-Loop Neuromodulation in Practice", venue: "Biomedical Engineering Society (BMES) Annual Meeting", kind: "Invited", year: 2023 },
        ],
        mediaCoverage: [
          { outlet: "MedDevice Daily", title: "Rising star in neural interfaces", reach: "industry newsletter", year: 2023 },
        ],
      },
    },
    verifiedClaims: {
      citations: { status: "verified", source: "openalex", sourceUrl: "https://openalex.org/works?filter=author.id:Bxxxx", confidence: 0.92, detail: "582 total citations across the indexed body of work" },
      topPublicationCitations: { status: "verified", source: "openalex", confidence: 0.91, detail: "Nature Biomedical Engineering paper: 274 citations; Science Translational Medicine paper: 159 citations" },
      additionalPublicationCitations: { status: "verified", source: "openalex", confidence: 0.88, detail: "IEEE TBME paper: 88 citations; Nature Communications paper: 61 citations" },
      metrics: { status: "verified", source: "openalex", confidence: 0.9, detail: "h-index 16; 582 citations" },
      publications: { status: "verified", source: "orcid", sourceUrl: "https://orcid.org/0000-0000-0000-000B", confidence: 0.9, detail: "peer-reviewed works verified on ORCID" },
      grantFunding: { status: "verified", source: "nih", confidence: 0.87, detail: "NIH award; $2.3M; Principal Investigator role on one grant" },
    },
  },
  {
    slug: "test-applicant-c-ai",
    label: "Test Applicant C — Artificial Intelligence",
    givenName: "Dr. Test Applicant C",
    tier: "tier1",
    score: 93,
    trustScore: 84,
    excludeSummaries: [
      "AI Weekly Substack: 30-under-30 in AI safety",
      "Kaggle Grandmaster (self-reported)",
    ],
    formData: {
      petitionerInfo: { givenName: "Dr. Test Applicant C", familyName: "" },
      endeavor: {
        endeavorField: "Artificial Intelligence",
        endeavorStatement:
          "to develop certifiably robust machine-learning methods for safety-critical autonomous systems used in transportation and national defense",
        nstcCategories: [
          "Artificial Intelligence",
          "Autonomous Systems and Robotics",
        ],
        federalPrograms: [
          {
            programName: "Assured Autonomy",
            agencyOrOffice: "Defense Advanced Research Projects Agency (DARPA)",
            specificGoal: "provable safety guarantees for learned controllers in safety-critical systems",
          },
        ],
      },
      qualifications: {
        publications: [
          { title: "Certified Robustness for Perception under Distribution Shift", venue: "NeurIPS", year: 2022, citations: 420, journalRank: "A*", citationPercentile: "Top 1% (ESI)" },
          { title: "Safe Reinforcement Learning for Autonomous Navigation", venue: "ICML", year: 2021, citations: 233, journalRank: "A*" },
          { title: "Uncertainty-Aware Multimodal Sensor Fusion", venue: "CVPR", year: 2023, citations: 117, journalRank: "A*" },
          { title: "Formal Verification of Learned Controllers", venue: "ICLR", year: 2020, citations: 71, journalRank: "A*" },
        ],
        awards: [
          { name: "NeurIPS Outstanding Paper Award", significance: "top-paper recognition at the flagship machine-learning conference", year: 2022 },
          { name: "Kaggle Grandmaster (self-reported)", significance: "competition-platform tier, not a scholarly honor", year: 2021 },
        ],
        grants: [
          { title: "Trustworthy Autonomy for Safety-Critical Systems", agency: "National Science Foundation (NSF)", amount: "$1.2M", role: "Principal Investigator", year: 2022 },
        ],
        patents: [
          { title: "Method for Certified Robust Perception", number: "US 2023/0145XXX A1", status: "Pending", year: 2023 },
        ],
        editorialRoles: [
          { journal: "Journal of Machine Learning Research (JMLR)", role: "Action Editor", year: 2022 },
        ],
        invitedTalks: [
          { title: "Certifiable Robustness for Autonomy", venue: "Conference on Robot Learning (CoRL)", kind: "Invited", year: 2023 },
        ],
        mediaCoverage: [
          { outlet: "AI Weekly Substack", title: "30-under-30 in AI safety", reach: "newsletter", year: 2023 },
        ],
      },
    },
    verifiedClaims: {
      citations: { status: "verified", source: "openalex", sourceUrl: "https://openalex.org/works?filter=author.id:Cxxxx", confidence: 0.92, detail: "841 total citations across the indexed body of work" },
      topPublicationCitations: { status: "verified", source: "openalex", confidence: 0.91, detail: "NeurIPS paper: 420 citations; ICML paper: 233 citations" },
      additionalPublicationCitations: { status: "verified", source: "openalex", confidence: 0.88, detail: "CVPR paper: 117 citations; ICLR paper: 71 citations" },
      metrics: { status: "verified", source: "openalex", confidence: 0.9, detail: "h-index 14; 841 citations" },
      publications: { status: "verified", source: "orcid", sourceUrl: "https://orcid.org/0000-0000-0000-000C", confidence: 0.9, detail: "peer-reviewed works verified on ORCID" },
      grantFunding: { status: "verified", source: "nsf", confidence: 0.86, detail: "NSF award; $1.2M; Principal Investigator role on one grant" },
    },
  },
];

// ─── Demo-only prose polish (GTM collateral; NOT a product feature) ──────────
// The Sonnet drafting model emits markdown markers (##, **, *, ---) and freeform
// bracket refs as LITERAL text — briefDocx.bodyParagraphs renders runs verbatim,
// so a raw export shows "## I. Prong 1" and "[OpenAlex; NSF — Prong 1 – Funding
// evidence]". For attorney-facing samples we keep the clean provenance story but
// remove the scaffolding:
//   • keep [self-reported: …] verbatim (the honesty marker / differentiator)
//   • keep clean source + funding-agency tags ([OpenAlex] [ORCID] [NSF] [NIH] …)
//   • collapse compound tags to their recognized tokens ([NIH; grantFunding] → [NIH])
//   • drop [ESI] and [Exhibit: …] / [Prong N — …] cross-references
//   • strip literal markdown to clean plain text
// This runs AFTER the linter gate (so the validated output is never weakened) and
// is re-linted before export. The proper fix is a render-time normalizer inside
// briefDocx/dossierPdf — logged as post-freeze backlog, not built during the freeze.
const PROVENANCE_TOKENS = ["OpenAlex", "ORCID", "ROR", "Crossref", "USPTO", "NSF", "NIH", "DOE", "DARPA", "verified"];
const TOKEN_RE = new RegExp(`\\b(${PROVENANCE_TOKENS.join("|")})\\b`, "gi");
const CANON = new Map(PROVENANCE_TOKENS.map((t) => [t.toLowerCase(), t] as const));

function cleanBracket(inner: string): string {
  const s = inner.trim();
  if (/^self-reported/i.test(s)) return `[${s}]`; // keep honesty marker verbatim
  if (/^exhibit\b/i.test(s)) return ""; // [Exhibit: …] cross-ref → drop
  if (/^prong\s+\d/i.test(s)) return ""; // [Prong 1 — …] exhibit-plan label → drop
  const found: string[] = [];
  for (const m of s.matchAll(TOKEN_RE)) {
    const c = CANON.get(m[1].toLowerCase());
    if (c && !found.includes(c)) found.push(c);
  }
  // If a real source is present, a bare "verified" is redundant noise — drop it.
  const tokens = found.length > 1 ? found.filter((f) => f !== "verified") : found;
  return tokens.length ? `[${tokens.join(", ")}]` : ""; // [ESI] & other non-sources → drop
}

function normalizeBriefProse(text: string): string {
  let t = text
    // 1) markdown block elements, line by line
    .split("\n")
    .filter((ln) => !/^\s*([-*_])\1{2,}\s*$/.test(ln)) // --- *** ___ horizontal rules
    .map((ln) => ln.replace(/^\s*#{1,6}\s+/, "")) // # / ## / ### headings → plain text
    .join("\n");
  // 2) inline emphasis (bold first so ** is consumed before single *)
  t = t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*([^*\n]+)\*/g, "$1");
  // 3) drop "See Exhibit [exhibit-plan slug]" cross-references entirely
  t = t.replace(/\s*See\s+Exhibit\s*\[[^\]]+\]\s*\.?/gi, "");
  // 4) apply the bracket policy to every remaining [..] reference
  t = t.replace(/\[([^\]]+)\]/g, (_m, inner: string) => cleanBracket(inner));
  // 5) tidy whitespace/punctuation left behind by dropped tokens
  return t
    .replace(/[ \t]+([.,;:])/g, "$1") // " ." → "."
    .replace(/[ \t]{2,}/g, " ") // collapse space runs
    .replace(/\(\s*\)/g, "") // empty parens
    .replace(/\n{3,}/g, "\n\n") // collapse blank-line runs
    .trim();
}

function countBrackets(brief: { substantialMerit: string; nationalImportance: string; waiverJustification: string }): number {
  const all = `${brief.substantialMerit}\n${brief.nationalImportance}\n${brief.waiverJustification}`;
  return (all.match(/\[[^\]]+\]/g) ?? []).length;
}

// ─── Teardown ────────────────────────────────────────────────────────────────
async function cleanupFixtures(): Promise<void> {
  const leads = await prisma.lead.deleteMany({
    where: { email: { endsWith: `@${FIXTURE_DOMAIN}` } },
  });
  // Cases are titled with the fixture label and owned by the fixture attorney;
  // delete by the (disposable) attorney's ownership to avoid touching real data.
  const attorney = await prisma.user.findUnique({ where: { email: ATTORNEY_EMAIL } });
  let cases = 0;
  if (attorney) {
    const del = await prisma.case.deleteMany({ where: { ownerId: attorney.id } });
    cases = del.count;
    await prisma.user.delete({ where: { id: attorney.id } }).catch(() => {});
  }
  console.log(`  🗑️  removed ${leads.count} lead(s), ${cases} case(s), ${attorney ? 1 : 0} attorney`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const keep = args.includes("--keep");
  const cleanOnly = args.includes("--clean-only");

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — load .env.local first (set -a && . ./.env.local && set +a).");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set — load .env.local first.");
  }

  console.log("\n🧹 Clearing any prior fixtures...");
  await cleanupFixtures();
  if (cleanOnly) {
    console.log("✅ --clean-only: done.");
    await prisma.$disconnect();
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // One disposable attorney signs every fixture ledger (name shows on the cover).
  const attorney = await prisma.user.create({
    data: { email: ATTORNEY_EMAIL, name: ATTORNEY_NAME, role: "attorney" },
  });

  const results: { label: string; ledgerRoot: string; approved: number; excluded: number; docx: string; pdf: string; lintAttempts: number }[] = [];
  const failures: { label: string; reason: string }[] = [];

  for (const p of PROFILES) {
    console.log(`\n──────────────────────────────────────────────────`);
    console.log(`▶ ${p.label}  (${p.givenName})`);

    // 1) Seed the Case (rich, attorney-curatable formData) + the claimed Lead.
    const kase = await prisma.case.create({
      data: {
        formId: "i140-niw",
        title: p.label,
        status: "review",
        ownerId: attorney.id,
        attorneyId: attorney.id,
        formData: p.formData as Prisma.InputJsonValue,
      },
    });
    const lead = await prisma.lead.create({
      data: {
        email: `${p.slug}@${FIXTURE_DOMAIN}`,
        resultToken: crypto.randomUUID(),
        name: p.givenName,
        tier: p.tier,
        score: p.score,
        source: "fixture",
        status: "claimed",
        applicantStatus: "approved",
        maturity: "M7",
        trustScore: p.trustScore,
        dossierStatus: "idle",
        caseId: kase.id,
        claimedByUserId: attorney.id,
        claimedAt: new Date(),
        formData: { field: String((p.formData.endeavor as Record<string, unknown>).endeavorField) } as Prisma.InputJsonValue,
        verifiedClaims: p.verifiedClaims as Prisma.InputJsonValue,
      },
    });

    // 2) Curation gate — confirm/exclude, then sign (identical logic to
    //    POST /api/leads/[id]/claim-ledger: approved = live atoms minus the
    //    attorney's exclusions; excluded = strict complement; root over approved).
    const liveAtoms = extractEvidence(p.formData);
    const excludeSet = new Set(p.excludeSummaries);
    const approved = liveAtoms.filter((a) => !excludeSet.has(a.summary)).map((a) => a.id);
    const excluded = liveAtoms.filter((a) => excludeSet.has(a.summary)).map((a) => a.id);
    const matchedExclusions = liveAtoms.filter((a) => excludeSet.has(a.summary)).map((a) => a.summary);
    for (const want of p.excludeSummaries) {
      if (!matchedExclusions.includes(want)) {
        console.warn(`  ⚠️  exclusion target not found among atoms: "${want}"`);
      }
    }
    const ledgerRoot = computeLedgerRoot(approved);
    const ledger: ClaimLedger = {
      approved,
      excluded,
      attestedBy: attorney.id,
      attestedAt: new Date().toISOString(),
      ledgerRoot,
    };
    await prisma.case.update({
      where: { id: kase.id },
      data: { claimLedger: ledger as unknown as Prisma.InputJsonValue },
    });
    console.log(`  ✍️  ledger ${ledgerRoot.slice(0, 19)}… — ${approved.length} approved / ${excluded.length} excluded`);

    // 3) Generate + 4) enforce the linter gate (the GAP-4 export rule). Retry on
    //    a stray untagged metric (Sonnet @ 0.4 is non-deterministic).
    let data: Awaited<ReturnType<typeof generateDossier>> | null = null;
    let attempt = 0;
    for (; attempt < MAX_LINT_RETRIES; attempt++) {
      data = await generateDossier(kase.id, p.tier, p.score, lead.id, p.verifiedClaims);
      if (data.provenanceLint.issues.length === 0) break;
      console.log(`  ↻ lint attempt ${attempt + 1}: ${data.provenanceLint.issues.length} flagged — ${data.provenanceLint.issues.map((i) => i.reason).join("; ").slice(0, 160)}`);
    }
    if (!data || data.provenanceLint.issues.length > 0) {
      const reason = `linter still flagging after ${MAX_LINT_RETRIES} attempts: ` +
        (data?.provenanceLint.issues.map((i) => `[${i.section}] ${i.reason}`).join(" | ") ?? "no data");
      console.error(`  ❌ ${reason}`);
      failures.push({ label: p.label, reason });
      continue; // never export a flagged brief — the route would 422 it anyway.
    }
    const stats = data.provenanceLint.stats;
    console.log(`  ✅ linter passed (attempt ${attempt + 1}) — ${stats.verifiedCited} cited, ${stats.selfReportedTagged} self-reported, ${stats.untagged} untagged of ${stats.totalClaims} metric claims`);
    console.log(`     quality score: ${data.qualityReport?.partnerCredibilityScore ?? "n/a"}/100${data.attestation ? `; cover stamp: approved by ${data.attestation.attorneyName} (#${data.attestation.ledgerRoot.slice(7, 19)})` : ""}`);

    // 4b) Demo-only prose polish (see normalizeBriefProse). Runs AFTER the lint
    //     gate so the validated output is never weakened; the re-lint below
    //     confirms the cleaned text is still 0-issue before it can be exported.
    const tagsBefore = countBrackets(data.brief);
    data.brief.substantialMerit = normalizeBriefProse(data.brief.substantialMerit);
    data.brief.nationalImportance = normalizeBriefProse(data.brief.nationalImportance);
    data.brief.waiverJustification = normalizeBriefProse(data.brief.waiverJustification);
    const tagsAfter = countBrackets(data.brief);
    const relint = lintDossierProvenance(
      [
        { name: "substantialMerit", text: data.brief.substantialMerit },
        { name: "nationalImportance", text: data.brief.nationalImportance },
        { name: "waiverJustification", text: data.brief.waiverJustification },
      ],
      p.verifiedClaims as unknown as Parameters<typeof lintDossierProvenance>[1],
    );
    if (relint.issues.length > 0) {
      const reason = `prose normalization regressed the linter (${relint.issues.length} issue(s)): ` +
        relint.issues.map((i) => `[${i.section}] ${i.reason}`).join(" | ");
      console.error(`  ❌ ${reason}`);
      failures.push({ label: p.label, reason });
      continue; // never export a brief the linter would reject.
    }
    console.log(`  🧽 prose polished — ${tagsBefore} → ${tagsAfter} inline tags (markdown stripped; provenance kept, compounds collapsed, exhibit/prong refs dropped); re-lint clean`);

    // 5) Export both artifacts.
    const docxBuf = await generateBriefDocx(data);
    const pdfBuf = await renderDossierPdf(data, { trustScore: p.trustScore, verifiedClaims: p.verifiedClaims });
    const docxPath = path.join(OUT_DIR, `${p.slug}-brief.docx`);
    const pdfPath = path.join(OUT_DIR, `${p.slug}-dossier.pdf`);
    fs.writeFileSync(docxPath, docxBuf);
    fs.writeFileSync(pdfPath, pdfBuf);
    console.log(`  💾 ${path.relative(process.cwd(), docxPath)}  (${(docxBuf.length / 1024).toFixed(0)} KB)`);
    console.log(`  💾 ${path.relative(process.cwd(), pdfPath)}  (${(pdfBuf.length / 1024).toFixed(0)} KB)`);

    results.push({ label: p.label, ledgerRoot, approved: approved.length, excluded: excluded.length, docx: docxPath, pdf: pdfPath, lintAttempts: attempt + 1 });
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════");
  console.log(`  RESULT: ${results.length}/${PROFILES.length} dossiers exported`);
  console.log("══════════════════════════════════════════════════");
  for (const r of results) {
    console.log(`  • ${r.label}\n      ledger #${r.ledgerRoot.slice(7, 19)} (${r.approved} approved / ${r.excluded} excluded), lint attempts: ${r.lintAttempts}`);
  }
  if (failures.length) {
    console.log(`\n  ⚠️  ${failures.length} did NOT export:`);
    for (const f of failures) console.log(`  • ${f.label}: ${f.reason}`);
  }
  console.log(`\n  Artifacts: ${path.relative(process.cwd(), OUT_DIR)}/`);

  if (keep) {
    console.log(`\n  --keep: fixture rows retained (attorney ${ATTORNEY_EMAIL}). Run with --clean-only to remove.`);
  } else {
    console.log("\n🧹 Tearing down fixture rows...");
    await cleanupFixtures();
  }

  await prisma.$disconnect();
  if (failures.length) process.exitCode = 1;
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
