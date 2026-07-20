/**
 * Seed — full E2E test dataset covering GTM-A through GTM-D funnel + case workspace.
 * Run: node prisma/seed.mjs
 * Password for all accounts: 12345678
 *
 * Scenarios seeded:
 *   S1  Full funnel    — Tier 1, dossier completed, unclaimed     → attorney browses + claims
 *   S2  Active case    — Tier 1, claimed, intake done             → case workspace open
 *   S3  Pending        — Tier 1, dossier generating               → polling spinner
 *   S4  Idle CTA       — Tier 2, awaiting "get dossier" click     → convert → intake
 *   S5  Weak profile   — Tier 3, just captured                    → "build profile" messaging
 *   S6  Referral lead  — Tier 1, refCode set                      → referral tracking
 *   S7  Out of credits — Attorney 2 has 0 credits                 → buy credits CTA
 *   S8  Case workspace — Two deep NIW cases (AI Safety, Climate)   → drafting + review flow
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient({
  datasourceUrl: "postgresql://uscis:uscis_dev@localhost:5433/uscis",
});

const id = () => randomBytes(8).toString("hex");
const PASS_HASH = await bcrypt.hash("12345678", 10);

// ─── Wipe (order respects FK constraints) ────────────────────────────────────
await prisma.sectionComment.deleteMany();
await prisma.letterComment.deleteMany();
await prisma.message.deleteMany();
await prisma.letterVersion.deleteMany();
await prisma.letter.deleteMany();
await prisma.document.deleteMany();
await prisma.activityLog.deleteMany();
await prisma.caseNote.deleteMany();
await prisma.emailLog.deleteMany();
await prisma.firmProfile.deleteMany();
await prisma.lead.deleteMany();
await prisma.case.deleteMany();
await prisma.user.deleteMany();
console.log("🗑  Cleared all tables");

// ─── Users ────────────────────────────────────────────────────────────────────
const admin = await prisma.user.create({ data: {
  id: id(), email: "admin@platform.com", passwordHash: PASS_HASH,
  name: "Platform Admin", role: "admin", verified: true,
}});

// Attorney 1 — has trial credits, active cases
const atty1 = await prisma.user.create({ data: {
  id: id(), email: "sarah.johnson@lawfirm.com", passwordHash: PASS_HASH,
  name: "Sarah Johnson", role: "attorney", verified: true,
}});

// Attorney 2 — 0 credits (tests buy-credits CTA)
const atty2 = await prisma.user.create({ data: {
  id: id(), email: "michael.chen@lawfirm.com", passwordHash: PASS_HASH,
  name: "Michael Chen", role: "attorney", verified: true,
}});

// Applicant accounts (linked to deep cases S8)
const app1 = await prisma.user.create({ data: {
  id: id(), email: "priya.patel@university.edu", passwordHash: PASS_HASH,
  name: "Dr. Priya Patel", role: "applicant", verified: true,
}});
const app2 = await prisma.user.create({ data: {
  id: id(), email: "marco.rossi@research.org", passwordHash: PASS_HASH,
  name: "Dr. Marco Rossi", role: "applicant", verified: true,
}});

console.log("👤  Created users");

// ─── FirmProfiles ────────────────────────────────────────────────────────────
// S1/S2/S6: Attorney 1 — 2 trial credits left, 1 used to claim S2
await prisma.firmProfile.create({ data: {
  userId: atty1.id,
  firmName: "Johnson Immigration Law",
  specialties: ["NIW", "EB-1A", "O-1A"],
  networkTier: "standard",
  trialCredits: 2,
  purchasedCredits: 0,
  trialExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
}});

// S7: Attorney 2 — 0 credits total (trial expired, no purchased)
await prisma.firmProfile.create({ data: {
  userId: atty2.id,
  firmName: "Chen & Partners",
  specialties: ["NIW", "EB-2", "EB-3"],
  networkTier: "standard",
  trialCredits: 3,
  purchasedCredits: 0,
  trialExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // expired yesterday
}});

console.log("🏢  Created firm profiles");

// ─── S8a: Deep case — Dr. Priya Patel (AI Safety) ────────────────────────────
// This is the richest case for testing the full drafting workspace.

const case1Id = id();
const case1 = await prisma.case.create({ data: {
  id: case1Id,
  formId: "i140-niw",
  title: "Dr. Priya Patel — NIW EB-2 (AI Safety Research)",
  status: "review",
  ownerId: app1.id,
  attorneyId: atty1.id,
  formData: {
    "petitioner-info": {
      fullName: "Priya Patel",
      dob: "1989-03-15",
      countryOfBirth: "India",
      countryOfCitizenship: "India",
      currentAddress: { street: "1400 University Ave", city: "Berkeley", state: "CA", zip: "94720" },
    },
    endeavor: {
      endeavorStatement: "I propose to advance the safety and robustness of large-scale AI systems deployed in high-stakes national infrastructure — power grids, healthcare diagnostics, and financial markets. My work develops formal verification methods and adversarial robustness benchmarks that allow government and industry to certify AI systems before deployment.",
      endeavorField: "AI Safety & Machine Learning",
      nationalImportanceArgument: "The White House Executive Order on AI Safety (Oct 2023) and NIST AI Risk Management Framework explicitly identify trustworthy AI as a national security and economic priority. DARPA's Assured Autonomy program and NSF's National AI Research Institutes have collectively allocated over $500M to AI safety research.",
    },
    qualifications: {
      highestDegree: "phd",
      field: "AI Safety",
      publications: [
        { title: "Certified Adversarial Robustness via Randomized Smoothing at Scale", venue: "NeurIPS", year: 2022, citations: 312, role: "first-author", impactFactor: 18.4 },
        { title: "Formal Verification of Deep Neural Networks for Safety-Critical Systems", venue: "IEEE S&P", year: 2023, citations: 187, role: "corresponding", impactFactor: 7.2 },
        { title: "Benchmarking AI Safety: A National Infrastructure Perspective", venue: "AAAI", year: 2024, citations: 94, role: "first-author", impactFactor: 9.1 },
      ],
      awards: [
        { name: "NSF CAREER Award", issuer: "National Science Foundation", year: 2023, significance: "Awarded to fewer than 20% of applicants." },
        { name: "MIT Technology Review Innovators Under 35", issuer: "MIT Technology Review", year: 2023, significance: "Annual global recognition list." },
      ],
      grants: [
        { title: "Certified AI Safety for National Infrastructure", funder: "NSF", amount: 1200000, year: 2023, role: "PI" },
        { title: "Adversarially Robust AI for DARPA Assured Autonomy", funder: "DARPA", amount: 900000, year: 2022, role: "PI" },
      ],
      editorialRoles: [
        { venue: "NeurIPS", role: "Area Chair", year: 2024 },
        { venue: "ICLR", role: "Reviewer", year: 2023 },
      ],
    },
    nstcCategories: ["AI & Machine Learning", "Cybersecurity"],
    briefSections: {
      "prong1-merit": "Dr. Patel's proposed endeavor — developing certified adversarial robustness methods and AI safety benchmarks for critical national infrastructure — carries both substantial merit and profound national importance under the Dhanasar framework.\n\nHer 2022 NeurIPS paper, 'Certified Adversarial Robustness via Randomized Smoothing at Scale,' represents a foundational advance: it demonstrated, for the first time, that provable robustness guarantees can be scaled to modern neural networks at production resolution. The 312 citations accumulated in four years confirm that both academics and practitioners regard it as load-bearing work. Her follow-on IEEE S&P 2023 paper introduced the first formal threat model for adversarial attacks on grid-connected AI, which NIST has since incorporated into its draft AI Robustness Framework.\n\nNational importance is not inferred — it is explicit. The White House Executive Order on AI Safety (E.O. 14110, October 2023) names trustworthy AI deployment as a national security imperative. DARPA's Assured Autonomy program ($85M) and NSF's National AI Research Institutes ($400M) both fund programs that map directly to Dr. Patel's research agenda. The Department of Energy's 2023 Grid Modernization Roadmap listed adversarially robust AI as a critical capability gap. Dr. Patel's SafetyBench-AI toolkit, already adopted by 40+ government contractors, is the technical substrate for the NIST guidance agencies must publish under the EO's 12-month mandate.",
    },
  },
}});

// Documents for case 1
for (const d of [
  { requirementId: "passport", status: "validated", filename: "passport_patel.pdf", storedFilename: "passport_patel.pdf", mimeType: "application/pdf", size: 245000 },
  { requirementId: "diplomas", status: "validated", filename: "phd_diploma_iit.pdf", storedFilename: "phd_diploma_iit.pdf", mimeType: "application/pdf", size: 1200000 },
  { requirementId: "cv", status: "validated", filename: "cv_priya_patel_2026.pdf", storedFilename: "cv_priya_patel_2026.pdf", mimeType: "application/pdf", size: 380000 },
  { requirementId: "citation-reports", status: "uploaded", filename: "google_scholar_export.pdf", storedFilename: "google_scholar_export.pdf", mimeType: "application/pdf", size: 210000 },
  { requirementId: "publication-pdfs", status: "uploaded", filename: "key_publications.pdf", storedFilename: "key_publications.pdf", mimeType: "application/pdf", size: 4500000 },
  { requirementId: "grants-funding", status: "missing" },
]) { await prisma.document.create({ data: { id: id(), caseId: case1Id, ...d } }); }

// Petition letter
const petDraft = `IN THE MATTER OF THE IMMIGRANT PETITION FOR ALIEN WORKER
Form I-140 — EB-2 National Interest Waiver
Petitioner: Priya Patel, Ph.D.

INTRODUCTION

Dr. Priya Patel respectfully submits this petition for an EB-2 National Interest Waiver pursuant to INA § 203(b)(2)(B). Dr. Patel is a leading researcher in artificial intelligence safety whose work addresses one of the most critical challenges identified in the White House Executive Order on AI Safety (October 2023): ensuring that AI systems deployed in high-stakes national infrastructure are trustworthy, robust, and formally verifiable.

PRONG 1 — SUBSTANTIAL MERIT AND NATIONAL IMPORTANCE

Dr. Patel's proposed endeavor — certifying adversarial robustness of AI in power grids, healthcare diagnostics, and financial systems — carries explicit federal mandate. The White House EO 14110 (Oct 2023) requires agencies to develop AI safety testing standards within 12 months. DARPA's Assured Autonomy ($85M) and NSF's National AI Research Institutes ($400M) fund exactly this work. Dr. Patel's 2022 NeurIPS paper has 312 citations; her SafetyBench-AI toolkit is used by 40+ government contractors and is incorporated into NIST draft guidance.

PRONG 2 — WELL-POSITIONED

NSF CAREER Award (2023, <20% acceptance rate). MIT Technology Review Innovators Under 35. $2.1M federal PI funding (NSF + DARPA). First-author papers at NeurIPS, AAAI; corresponding author at IEEE S&P. Citation rate places her in top 2% of her cohort.

PRONG 3 — BENEFICIAL TO WAIVE

No specific employer — Dr. Patel is a self-directed researcher spanning government, academic, and industry applications. DARPA program officers have noted in writing that fewer than 50 U.S. researchers hold her specific combination of formal verification and large-scale ML expertise. The EO's 12-month mandate cannot wait for a multi-year labor certification process.

Respectfully submitted,
Dr. Priya Patel`.trim();

await prisma.letter.create({ data: {
  id: id(), caseId: case1Id, requirementId: "petition-letter",
  recommender: { name: "Self (Petitioner)", title: "Assistant Professor", institution: "UC Berkeley" },
  selectedEvidence: ["cv", "publication-pdfs", "citation-reports", "grants-funding"],
  currentDraft: petDraft,
  qualityReport: {
    overallScore: 87,
    dimensions: {
      "Argument Structure": { score: 90, notes: "Three-prong Dhanasar framework clearly laid out" },
      "Evidence Integration": { score: 85, notes: "Publications and awards well cited; funding section thin" },
      "National Importance": { score: 88, notes: "EO and DARPA references are specific and on-point" },
      "Prong 3 Strength": { score: 78, notes: "Impracticality argument needs a direct employer/agency statement" },
    },
    weakParagraphs: [{ paragraph: "No specific employer", issue: "Lead with DARPA PM quote on talent scarcity — more concrete" }],
    strengths: ["Strong 593-citation body", "Federal initiative citations are pinpoint (EO 14110, DARPA Assured Autonomy)", "Clear three-prong structure"],
    readyToSend: false,
  },
  versions: { create: [{ id: id(), content: petDraft, qualityReport: { overallScore: 87, dimensions: {}, weakParagraphs: [], strengths: [], readyToSend: false }, note: "Initial AI draft", createdAt: new Date("2026-04-12T10:00:00Z") }] },
}});

// Independent rec — Yoshua Bengio
const bengioRec = `May 1, 2026

To Whom It May Concern:

I am writing in strong support of Dr. Priya Patel's petition for an EB-2 National Interest Waiver. I am Professor Yoshua Bengio, Full Professor at Université de Montréal and Scientific Director of Mila — Quebec AI Institute. I am a Turing Award laureate (2018). I have not collaborated directly with Dr. Patel; I know her through her publications and conference presentations.

Dr. Patel's 2022 NeurIPS paper on certified robustness via randomized smoothing represents a fundamental advance: she demonstrated, for the first time, that provable robustness guarantees can be scaled to modern neural networks at production resolution. The 312 citations this paper accumulated in four years is exceptional for safety-focused theoretical work — it tells me that both academics and practitioners regard it as foundational. The follow-on IEEE S&P paper applying these methods to safety-critical systems introduced the first formal threat model for adversarial attacks on grid-connected AI, which NIST incorporated into its draft AI Robustness Framework.

The United States faces a specific strategic problem: AI systems are being deployed in national infrastructure faster than the tools to certify their safety can be developed. Dr. Patel is one of perhaps fifty researchers globally who possesses both the formal methods background and the systems ML expertise to close this gap. I unreservedly support her petition.

Sincerely,
Prof. Yoshua Bengio
Turing Award Laureate, 2018 | Mila — Quebec AI Institute`.trim();

await prisma.letter.create({ data: {
  id: id(), caseId: case1Id, requirementId: "rec-independent",
  recommender: { name: "Prof. Yoshua Bengio", title: "Full Professor & Scientific Director", institution: "Mila — Quebec AI Institute", credentials: "Turing Award 2018; 300,000+ Google Scholar citations", relationship: "Independent", country: "Canada" },
  selectedEvidence: ["publication-pdfs", "citation-reports", "cv"],
  currentDraft: bengioRec,
  qualityReport: { overallScore: 95, dimensions: { "Recommender Credibility": { score: 99, notes: "Turing Award laureate" }, "Specificity": { score: 92, notes: "Cites specific papers and citation counts" }, "Prong Coverage": { score: 93, notes: "Addresses all three Dhanasar prongs" } }, weakParagraphs: [], strengths: ["Highest possible recommender credibility", "Specific citation counts and venues", "Addresses national importance directly"], readyToSend: true },
  versions: { create: [{ id: id(), content: bengioRec, qualityReport: { overallScore: 95, dimensions: {}, weakParagraphs: [], strengths: [], readyToSend: true }, note: "Initial AI draft", createdAt: new Date("2026-04-13T09:00:00Z") }] },
}});

// Dependent rec — Stuart Russell
const russellRec = `April 30, 2026

To Whom It May Concern:

I am Professor Stuart Russell, Professor of CS at UC Berkeley and Director of the Center for Human-Compatible AI. Dr. Patel joined my department as Assistant Professor in 2020. I have observed her work closely through faculty seminars and grant review committees.

Dr. Patel's approach to adversarial robustness is technically distinguished in a critical way: she provides certificates — mathematical proofs — not empirical observations. A defense contractor deploying AI in critical infrastructure cannot rely on empirical benchmarks that a new attack can always break; Dr. Patel's methods give operators a provable guarantee, which is far more valuable for high-stakes deployment.

During her time at Berkeley, Dr. Patel has grown her group to 12 PhD students, attracted $2.1M in federal grants, and published 9 peer-reviewed papers at top venues. Her ability to train students in AI safety is itself a national asset — the U.S. faces a severe shortage of researchers trained at the intersection of formal methods and ML.

I enthusiastically support this petition.

Professor Stuart Russell | UC Berkeley | Director, CHAI`.trim();

await prisma.letter.create({ data: {
  id: id(), caseId: case1Id, requirementId: "rec-dependent",
  recommender: { name: "Prof. Stuart Russell", title: "Professor of CS; Director, CHAI", institution: "UC Berkeley", credentials: "Author of 'AI: A Modern Approach' (world's most-used AI textbook)", relationship: "Direct colleague — same department", yearsKnown: 6 },
  selectedEvidence: ["cv", "grants-funding", "publication-pdfs"],
  currentDraft: russellRec,
  qualityReport: { overallScore: 91, dimensions: { "Direct Observation": { score: 97, notes: "Faculty colleague with lab visibility" }, "Technical Depth": { score: 93, notes: "Certificate vs empirical distinction is compelling" }, "Prong 3": { score: 72, notes: "Closing is too brief" } }, weakParagraphs: [{ paragraph: "I enthusiastically support this petition.", issue: "Add one sentence on national urgency" }], strengths: ["Direct observation of lab output", "Quantified: 12 PhD students, $2.1M grants, 9 papers"], readyToSend: false },
  versions: { create: [{ id: id(), content: russellRec, qualityReport: { overallScore: 91, dimensions: {}, weakParagraphs: [], strengths: [], readyToSend: false }, note: "Initial AI draft", createdAt: new Date("2026-04-15T08:30:00Z") }] },
}});

// Thread
for (const m of [
  { senderId: app1.id, senderName: "Dr. Priya Patel", senderRole: "applicant", text: "Hi Sarah, I've uploaded passport and transcripts. Still waiting on the updated citation report from Scopus — should have it by end of week.", createdAt: new Date("2026-04-10T10:15:00Z"), read: true },
  { senderId: atty1.id, senderName: "Sarah Johnson", senderRole: "attorney", text: "Got it — no rush. The petition draft is strong. One note: in Prong 3, let's add a reference to the DARPA PM's statement on the talent shortage. Do you have that email?", createdAt: new Date("2026-04-11T14:30:00Z"), read: true },
  { senderId: app1.id, senderName: "Dr. Priya Patel", senderRole: "applicant", text: "Yes, I have it from January 2025. I'll scan and upload it under 'grants-funding'. Should I also include the DoE Grid Modernization roadmap citation?", createdAt: new Date("2026-04-12T09:00:00Z"), read: false },
]) { await prisma.message.create({ data: { id: id(), caseId: case1Id, ...m } }); }

await prisma.sectionComment.create({ data: { id: id(), caseId: case1Id, sectionId: "endeavor", authorId: atty1.id, authorName: "Sarah Johnson", authorRole: "attorney", text: "This section is excellent. One suggestion: add the specific page number from the NSF program announcement where AI safety is listed as a priority. USCIS officers appreciate pinpoint citations.", resolved: false, createdAt: new Date("2026-04-11T15:00:00Z") } });

console.log("📁  Case S8a: Dr. Priya Patel (AI Safety) — status: review, 3 letters, thread active");

// ─── S8b: Deep case — Dr. Marco Rossi (Climate Risk) ────────────────────────
const case2Id = id();
await prisma.case.create({ data: {
  id: case2Id, formId: "i140-niw",
  title: "Dr. Marco Rossi — NIW EB-2 (Climate Risk Modeling)",
  status: "draft", ownerId: app2.id, attorneyId: atty2.id,
  formData: {
    "petitioner-info": { fullName: "Marco Rossi", dob: "1985-07-22", countryOfBirth: "Italy", countryOfCitizenship: "Italy", currentAddress: { street: "300 Science Drive", city: "Boulder", state: "CO", zip: "80303" } },
    endeavor: {
      endeavorStatement: "I propose to develop high-resolution climate risk models that quantify economic losses from extreme weather events at the county level, enabling federal agencies to direct infrastructure investment and emergency preparedness resources with unprecedented precision.",
      endeavorField: "Climate Science & Risk Modeling",
      nationalImportanceArgument: "FEMA's National Risk Index and the U.S. National Climate Assessment identify $150B+ annual extreme weather economic cost as a critical national vulnerability. The Inflation Reduction Act ($369B in climate spending) specifically calls for improved county-level risk quantification to guide resilience investments.",
    },
    qualifications: {
      highestDegree: "phd",
      field: "Climate Science",
      publications: [
        { title: "County-Level Economic Loss Projections from 21st Century Extreme Heat Events", venue: "Nature Climate Change", year: 2023, citations: 241, role: "first-author", impactFactor: 29.6 },
        { title: "Probabilistic Flood Risk Assessment Under CMIP6 Climate Scenarios", venue: "Geophysical Research Letters", year: 2022, citations: 178, role: "corresponding", impactFactor: 4.7 },
      ],
      awards: [{ name: "AGU Outstanding Early Career Scientist", issuer: "American Geophysical Union", year: 2024, significance: "Recognizes exceptional early-career Earth scientists." }],
    },
  },
}});

for (const d of [
  { requirementId: "passport", status: "uploaded", filename: "passport_rossi.pdf", storedFilename: "passport_rossi.pdf", mimeType: "application/pdf", size: 198000 },
  { requirementId: "cv", status: "uploaded", filename: "cv_marco_rossi_2026.pdf", storedFilename: "cv_marco_rossi_2026.pdf", mimeType: "application/pdf", size: 290000 },
  { requirementId: "diplomas", status: "pending" },
  { requirementId: "citation-reports", status: "missing" },
  { requirementId: "publication-pdfs", status: "missing" },
]) { await prisma.document.create({ data: { id: id(), caseId: case2Id, ...d } }); }

await prisma.letter.create({ data: {
  id: id(), caseId: case2Id, requirementId: "petition-letter",
  recommender: { name: "Self (Petitioner)", title: "Senior Research Scientist", institution: "NCAR / UCAR" },
  selectedEvidence: ["cv", "publication-pdfs", "citation-reports"], currentDraft: null, qualityReport: null,
  versions: { create: [] },
}});

await prisma.letter.create({ data: {
  id: id(), caseId: case2Id, requirementId: "rec-independent",
  recommender: { name: "Dr. Katharine Hayhoe", title: "Chief Scientist", institution: "The Nature Conservancy", credentials: "TIME100 Most Influential; 200+ peer-reviewed papers", relationship: "Independent — knows Dr. Rossi through publications and AGU", country: "USA" },
  selectedEvidence: ["publication-pdfs", "citation-reports"], currentDraft: null, qualityReport: null,
  versions: { create: [] },
}});

await prisma.message.create({ data: { id: id(), caseId: case2Id, senderId: atty2.id, senderName: "Michael Chen", senderRole: "attorney", text: "Welcome Marco! The Nature Climate Change publication is very strong — it'll anchor Prong 1. Your first task: upload diplomas and get the Scopus citation report. Once those are in, we can generate the petition letter draft.", createdAt: new Date("2026-04-20T11:00:00Z"), read: false } });

console.log("📁  Case S8b: Dr. Marco Rossi (Climate Risk) — status: draft, 2 letter stubs");

// ─── LEADS ────────────────────────────────────────────────────────────────────
// Lead formData mirrors check wizard answers (used in /leads/[id] profile snapshot)
const checkData = (field, degree, pubs, citations, awards, connection) => ({
  field, degree, publications: pubs, citations, awards, nationalConnection: connection,
});

// ── S1: Tier 1, dossier completed, unclaimed — main "browse + claim" scenario ──
// Linked to a rich case so exhibit plan + Prong 1 teaser render
const s1CaseId = id();
await prisma.case.create({ data: {
  id: s1CaseId, formId: "i140-niw",
  title: "EB-2 NIW — Structural Biology",
  status: "draft",
  intakeToken: "intake-s1-demo",
  intakeEmail: "aiko.tanaka@scripps.edu",
  formData: {
    endeavor: { endeavorStatement: "I develop cryo-EM methods for resolving membrane protein structures implicated in antibiotic resistance, providing structural blueprints that pharmaceutical firms use to design next-generation antibiotics.", endeavorField: "Structural Biology", nationalImportanceArgument: "The White House National Biodefense Strategy (2022) and the BARDA antibiotic resistance program identify novel antibiotic scaffolds as a national security priority. My structural blueprints feed directly into FDA-fast-tracked drug development pipelines." },
    qualifications: {
      highestDegree: "phd", field: "Structural Biology",
      publications: [
        { title: "Cryo-EM Structure of OXA-48 Carbapenemase in Complex with a Novel Inhibitor", venue: "Nature Structural & Molecular Biology", year: 2023, citations: 189, role: "first-author", impactFactor: 15.4 },
        { title: "Conformational Dynamics of NDM-1 Metallo-β-Lactamase Reveal Allosteric Inhibition Site", venue: "PNAS", year: 2022, citations: 134, role: "corresponding", impactFactor: 11.1 },
        { title: "High-Resolution Membrane Protein Structure Determination at Physiological Temperature", venue: "eLife", year: 2024, citations: 67, role: "first-author", impactFactor: 7.7 },
      ],
      awards: [{ name: "NIH K99/R00 Pathway to Independence Award", issuer: "National Institutes of Health", year: 2024, significance: "Highly competitive early-career award." }],
      grants: [{ title: "Structural Basis of Carbapenem Resistance in Clinical Pathogens", funder: "NIH NIAID", amount: 800000, year: 2024, role: "PI" }],
    },
    briefSections: {
      "prong1-merit": "Dr. Tanaka's proposed endeavor — determining high-resolution cryo-EM structures of clinically critical antibiotic resistance enzymes — carries substantial merit and direct national importance.\n\nAntibiotic resistance is classified by the White House National Biodefense Strategy (2022) and the CDC as one of the most urgent public health threats facing the United States. Carbapenem-resistant organisms, the specific target of Dr. Tanaka's work, are responsible for over 13,000 deaths annually in the U.S. and cost the healthcare system $4.7B per year in excess care costs. Dr. Tanaka's 2023 Nature Structural & Molecular Biology paper resolved the first complete structure of OXA-48 carbapenemase — the most clinically prevalent carbapenem resistance enzyme in Europe — in complex with a novel inhibitor. This structure has already been downloaded 3,200 times from the Protein Data Bank and is being used by three separate pharmaceutical companies (AstraZeneca, Pfizer, and a biotech whose name Dr. Tanaka is not authorized to disclose) in active drug discovery campaigns.\n\nThe national importance is not aspirational — it is measurable. BARDA has a standing program to accelerate antibiotic development for resistant organisms. The FDA grants priority review and fast-track designation to antibiotics targeting carbapenem-resistant organisms. Dr. Tanaka's structural work is the upstream input that makes these development programs possible.",
    },
  },
}});

const s1Lead = await prisma.lead.create({ data: {
  id: id(), email: "aiko.tanaka@scripps.edu", name: "Dr. Aiko Tanaka",
  tier: "tier1", score: 83,
  formData: checkData("Structural Biology", "PhD", "6–10", "390", "Yes — NIH K99/R00", "Yes — antibiotic resistance maps directly to BARDA and White House Biodefense Strategy"),
  source: "check", status: "new",
  dossierStatus: "completed",
  caseId: s1CaseId,
}});

console.log(`✅  S1: Lead tier1/completed/unclaimed — ${s1Lead.email}`);

// ── S2: Tier 1, dossier completed, claimed by attorney 1 ──────────────────────
// Links to a full intake case for workspace testing
const s2CaseId = id();
await prisma.case.create({ data: {
  id: s2CaseId, formId: "i140-niw",
  title: "EB-2 NIW — Quantum Computing",
  status: "draft",
  attorneyId: atty1.id,
  formData: {
    endeavor: { endeavorStatement: "I develop fault-tolerant quantum error correction codes that reduce qubit overhead by 40%, making large-scale quantum computers practical for NIST post-quantum cryptography standardization and national defense applications.", endeavorField: "Quantum Computing", nationalImportanceArgument: "The National Quantum Initiative Act (2018) and NSC Quantum Memorandum (2022) designate quantum computing as a critical national security technology. NIST's post-quantum cryptography standards rely on quantum hardware that my error correction work enables." },
    qualifications: {
      highestDegree: "phd", field: "Quantum Computing",
      publications: [
        { title: "Threshold Fault Tolerance via Surface Codes with 40% Reduced Qubit Overhead", venue: "Physical Review Letters", year: 2023, citations: 203, role: "first-author", impactFactor: 9.2 },
        { title: "Logical Qubit Lifetime Extension Through Adaptive Decoding Algorithms", venue: "Nature Physics", year: 2024, citations: 88, role: "corresponding", impactFactor: 21.3 },
      ],
      awards: [{ name: "DoE Early Career Award", issuer: "Department of Energy", year: 2024, significance: "Top early-career award in quantum science." }],
      grants: [{ title: "Fault-Tolerant Quantum Computing for National Security Applications", funder: "DARPA", amount: 1500000, year: 2023, role: "PI" }],
    },
    briefSections: {
      "prong1-merit": "Dr. Chen's proposed endeavor — developing fault-tolerant quantum error correction with substantially reduced qubit overhead — is both technically groundbreaking and nationally critical.\n\nThe National Quantum Initiative Act (2018) and the NSC Memorandum on Quantum Computing (October 2022) both designate quantum computing as a critical national security technology. The specific policy driver for Dr. Chen's work is NIST's post-quantum cryptography standardization effort: the algorithms NIST selected require quantum hardware that does not yet exist at scale. Dr. Chen's 2023 Physical Review Letters paper reduces the qubit overhead required for fault-tolerant computation by 40% — a single advance that brings large-scale quantum computers from theoretical to engineering feasibility within a decade.\n\nThe national security dimension is direct. DARPA's Quantum Benchmarking Initiative and the NSA's quantum computing readiness program both fund the precise hardware development that Dr. Chen's error correction work enables. Her DARPA grant ($1.5M, 2023) was awarded specifically because DARPA program managers determined that her approach to adaptive decoding represents the most credible path to practical fault tolerance at the qubit counts required for cryptographically relevant computation.",
    },
  },
}});

const s2Lead = await prisma.lead.create({ data: {
  id: id(), email: "mei.chen@mit.edu", name: "Dr. Mei Chen",
  tier: "tier1", score: 79,
  formData: checkData("Quantum Computing", "PhD", "4–5", "291", "Yes — DoE Early Career Award", "Yes — National Quantum Initiative Act and NIST post-quantum standards"),
  source: "check", status: "claimed",
  dossierStatus: "completed",
  caseId: s2CaseId,
  claimedByUserId: atty1.id,
}});

console.log(`✅  S2: Lead tier1/completed/claimed by Sarah Johnson — ${s2Lead.email}`);

// ── S3: Tier 1, dossier pending — tests polling spinner ──────────────────────
const s3Lead = await prisma.lead.create({ data: {
  id: id(), email: "rafael.lima@usp.br", name: "Dr. Rafael Lima",
  tier: "tier1", score: 76,
  formData: checkData("Bioinformatics", "PhD", "6–10", "180", "Yes", "Yes — NIH Human Genome Research"),
  source: "check", status: "contacted",
  dossierStatus: "pending",
  caseId: null,
}});

console.log(`⏳  S3: Lead tier1/dossier pending — ${s3Lead.email}`);

// ── S4: Tier 2, dossier idle — tests "Get my dossier" CTA ────────────────────
const s4Lead = await prisma.lead.create({ data: {
  id: id(), email: "elena.vasquez@utexas.edu", name: "Elena Vasquez",
  tier: "tier2", score: 61,
  formData: checkData("Environmental Engineering", "PhD", "3–5", "62", "No", "Somewhat — EPA Superfund remediation programs"),
  source: "check", status: "new",
  dossierStatus: "idle",
  caseId: null,
}});

console.log(`💤  S4: Lead tier2/dossier idle — ${s4Lead.email}`);

// ── S5: Tier 3, just captured — tests weak-profile path ──────────────────────
const s5Lead = await prisma.lead.create({ data: {
  id: id(), email: "james.okafor@gmail.com", name: "James Okafor",
  tier: "tier3", score: 38,
  formData: checkData("Software Engineering", "MS", "0", "0", "No", "No — work is commercial, not tied to national priority"),
  source: "check", status: "new",
  dossierStatus: "idle",
  caseId: null,
}});

console.log(`❌  S5: Lead tier3/weak profile — ${s5Lead.email}`);

// ── S6: Tier 1, referral — tests refCode tracking ────────────────────────────
const s6Lead = await prisma.lead.create({ data: {
  id: id(), email: "nina.okonkwo@yale.edu", name: "Dr. Nina Okonkwo",
  tier: "tier1", score: 80,
  formData: checkData("Public Health", "PhD", "4–5", "155", "Yes — Gates Foundation award", "Yes — CDC priority areas, opioid and maternal mortality"),
  source: "check", status: "new",
  dossierStatus: "idle",
  caseId: null,
  refCode: s1Lead.id, // referred by Dr. Tanaka (S1)
}});

console.log(`🔗  S6: Lead tier1/referral from S1 — ${s6Lead.email}`);

// ─── Summary ──────────────────────────────────────────────────────────────────
await prisma.$disconnect();

console.log(`
╔══════════════════════════════════════════════════════════╗
║                  SEED COMPLETE                           ║
╠══════════════════════════════════════════════════════════╣
║ ACCOUNTS  (password: 12345678)                           ║
║   admin@platform.com          — Platform Admin           ║
║   sarah.johnson@lawfirm.com   — Attorney (2 credits)     ║
║   michael.chen@lawfirm.com    — Attorney (0 credits)     ║
║   priya.patel@university.edu  — Applicant                ║
║   marco.rossi@research.org    — Applicant                ║
╠══════════════════════════════════════════════════════════╣
║ TEST SCENARIOS                                           ║
║  S1  /network/leads → tier1 unclaimed (Structural Bio)   ║
║      /leads/${s1Lead.id}     ║
║  S2  Already claimed by Sarah (Quantum Computing)        ║
║      /cases/${s2CaseId}     ║
║  S3  /check/result/${s3Lead.id}  (polling spinner)    ║
║  S4  /check/result/${s4Lead.id}  (idle CTA, tier2)    ║
║  S5  /check/result/${s5Lead.id}  (tier3 weak profile) ║
║  S6  /check/result/${s6Lead.id}  (tier1 with refCode) ║
║  S7  Login as michael.chen → /network/leads → 0 credits  ║
║  S8a /cases/${case1Id}  (AI Safety, review status)   ║
║  S8b /cases/${case2Id}  (Climate Risk, draft status)  ║
╚══════════════════════════════════════════════════════════╝
`);
