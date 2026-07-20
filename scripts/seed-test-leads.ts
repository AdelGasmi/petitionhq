/**
 * Seed REAL researcher profiles to validate the verification pipeline.
 *
 * These are real, publicly-documented researchers whose scholarly output is
 * a matter of public record. We use them (not synthetic names) because the
 * whole point is to prove the verifier FINDS real people and scores them
 * fairly — synthetic names can't be corroborated by any public API, so they
 * could never have caught the false-low bug that motivated this rewrite.
 *
 * Field coverage is deliberately diverse (CS, biomed, physics, math,
 * chemistry, economics, climate) to exercise field-aware source routing.
 * One profile — Mustapha Bounoua — is the original case that scored 10/100;
 * his institution is intentionally left blank to prove the matcher no longer
 * gates on institution metadata.
 *
 * `tier`/`score` here are the self-reported pre-screen values, NOT the trust
 * score; trust is computed by verification.
 *
 * Usage:
 *   npx tsx scripts/seed-test-leads.ts           # insert leads only
 *   npx tsx scripts/seed-test-leads.ts --verify   # insert + run full verification on each
 *   npx tsx scripts/seed-test-leads.ts --quick     # insert + run quickPing only
 *   npx tsx scripts/seed-test-leads.ts --clean     # delete all test leads first, then seed
 */

import { prisma } from "../lib/prisma";
import type { Prisma } from "@prisma/client";
import crypto from "crypto";

const TEST_EMAIL_DOMAIN = "test-seed.petitionhq.local";

// ─── 10 Researcher Profiles ────────────────────────────────────────────────

type SeedProfile = {
  name: string;
  email: string;
  tier: string;
  score: number;
  formData: Record<string, unknown>;
};

const profiles: SeedProfile[] = [
  {
    // THE ORIGINAL FAILING CASE. CS / ML researcher who scored 10/100.
    // Institution intentionally BLANK to prove the matcher no longer gates
    // on institution metadata. Modest self-reported counts (early-career).
    name: "Mustapha Bounoua",
    email: `mustapha.bounoua@${TEST_EMAIL_DOMAIN}`,
    tier: "tier2",
    score: 65,
    formData: {
      field: "Machine Learning",
      degree: "PhD",
      yearsExperience: "4-7 years",
      publications: "4-10",
      citations: "1-50",
      patents: "None",
      awards: "None",
      grants: "None",
      peerReview: "Yes, occasionally",
      invitedTalks: "None",
      nationalConnection: "Published in machine learning venues (NeurIPS, ICML workshops)",
      usPlan: "Advance representation-learning research at a US institution",
      employerSituation: "Postdoctoral researcher",
      name: "Mustapha Bounoua",
      // institution intentionally omitted
    },
  },
  {
    // CS / AI. Name-ORDER tolerance test ("Fei-Fei Li" vs "Li Fei-Fei").
    name: "Fei-Fei Li",
    email: `feifei.li@${TEST_EMAIL_DOMAIN}`,
    tier: "tier1",
    score: 95,
    formData: {
      field: "Computer Science",
      degree: "PhD",
      yearsExperience: "More than 15 years",
      publications: "More than 25",
      citations: "More than 500",
      patents: "1-3",
      awards: "4 or more",
      grants: "4 or more",
      peerReview: "Yes, regularly",
      invitedTalks: "3 or more",
      nationalConnection: "Co-director of Stanford HAI; ImageNet; member of US science advisory bodies",
      usPlan: "Lead human-centered AI research at Stanford",
      employerSituation: "Tenured faculty",
      name: "Fei-Fei Li",
      institution: "Stanford University",
      university: "Stanford University",
    },
  },
  {
    // CS / deep learning. Institution ACRONYM test (NYU).
    name: "Yann LeCun",
    email: `yann.lecun@${TEST_EMAIL_DOMAIN}`,
    tier: "tier1",
    score: 96,
    formData: {
      field: "Computer Science",
      degree: "PhD",
      yearsExperience: "More than 15 years",
      publications: "More than 25",
      citations: "More than 500",
      patents: "4 or more",
      awards: "4 or more",
      grants: "4 or more",
      peerReview: "Yes, regularly",
      invitedTalks: "3 or more",
      nationalConnection: "Turing Award; convolutional networks; US National Academy of Sciences",
      usPlan: "Continue deep-learning research leadership at NYU",
      employerSituation: "Tenured faculty",
      name: "Yann LeCun",
      institution: "NYU",
      university: "New York University",
    },
  },
  {
    // BIOMED — exercises PubMed + NIH routing. Diacritic-free common surname.
    name: "Jennifer Doudna",
    email: `jennifer.doudna@${TEST_EMAIL_DOMAIN}`,
    tier: "tier1",
    score: 97,
    formData: {
      field: "Biochemistry / Molecular Biology",
      degree: "PhD",
      yearsExperience: "More than 15 years",
      publications: "More than 25",
      citations: "More than 500",
      patents: "4 or more",
      awards: "4 or more",
      grants: "4 or more",
      peerReview: "Yes, regularly",
      invitedTalks: "3 or more",
      nationalConnection: "Nobel laureate (CRISPR); HHMI investigator; NIH-funded",
      usPlan: "Lead genome-engineering research at UC Berkeley",
      employerSituation: "Tenured faculty",
      name: "Jennifer Doudna",
      institution: "University of California, Berkeley",
      university: "University of California, Berkeley",
    },
  },
  {
    // MATHEMATICS — exercises arXiv routing.
    name: "Terence Tao",
    email: `terence.tao@${TEST_EMAIL_DOMAIN}`,
    tier: "tier1",
    score: 98,
    formData: {
      field: "Mathematics",
      degree: "PhD",
      yearsExperience: "More than 15 years",
      publications: "More than 25",
      citations: "More than 500",
      patents: "None",
      awards: "4 or more",
      grants: "4 or more",
      peerReview: "Yes, regularly",
      invitedTalks: "3 or more",
      nationalConnection: "Fields Medal; US National Academy of Sciences",
      usPlan: "Continue analysis & number-theory research at UCLA",
      employerSituation: "Tenured faculty",
      name: "Terence Tao",
      institution: "University of California, Los Angeles",
      university: "University of California, Los Angeles",
    },
  },
  {
    // PHYSICS — exercises arXiv routing.
    name: "Edward Witten",
    email: `edward.witten@${TEST_EMAIL_DOMAIN}`,
    tier: "tier1",
    score: 98,
    formData: {
      field: "Physics",
      degree: "PhD",
      yearsExperience: "More than 15 years",
      publications: "More than 25",
      citations: "More than 500",
      patents: "None",
      awards: "4 or more",
      grants: "1-3",
      peerReview: "Yes, regularly",
      invitedTalks: "3 or more",
      nationalConnection: "Fields Medal; string theory; Institute for Advanced Study",
      usPlan: "Continue theoretical-physics research at IAS",
      employerSituation: "Tenured faculty",
      name: "Edward Witten",
      institution: "Institute for Advanced Study",
      university: "Institute for Advanced Study",
    },
  },
  {
    // CHEMISTRY — exercises Crossref-heavy routing.
    name: "Frances Arnold",
    email: `frances.arnold@${TEST_EMAIL_DOMAIN}`,
    tier: "tier1",
    score: 97,
    formData: {
      field: "Chemical Engineering",
      degree: "PhD",
      yearsExperience: "More than 15 years",
      publications: "More than 25",
      citations: "More than 500",
      patents: "4 or more",
      awards: "4 or more",
      grants: "4 or more",
      peerReview: "Yes, regularly",
      invitedTalks: "3 or more",
      nationalConnection: "Nobel laureate (directed evolution); Caltech; NAS/NAE/NAM",
      usPlan: "Lead protein-engineering research at Caltech",
      employerSituation: "Tenured faculty",
      name: "Frances Arnold",
      institution: "California Institute of Technology",
      university: "California Institute of Technology",
    },
  },
  {
    // SOCIAL / ECONOMICS — exercises social-science routing.
    name: "Esther Duflo",
    email: `esther.duflo@${TEST_EMAIL_DOMAIN}`,
    tier: "tier1",
    score: 96,
    formData: {
      field: "Economics",
      degree: "PhD",
      yearsExperience: "More than 15 years",
      publications: "More than 25",
      citations: "More than 500",
      patents: "None",
      awards: "4 or more",
      grants: "4 or more",
      peerReview: "Yes, regularly",
      invitedTalks: "3 or more",
      nationalConnection: "Nobel laureate (development economics); MIT; J-PAL",
      usPlan: "Continue development-economics research at MIT",
      employerSituation: "Tenured faculty",
      name: "Esther Duflo",
      institution: "Massachusetts Institute of Technology",
      university: "Massachusetts Institute of Technology",
    },
  },
  {
    // ENVIRONMENTAL / CLIMATE — exercises environmental routing.
    name: "Michael E. Mann",
    email: `michael.mann@${TEST_EMAIL_DOMAIN}`,
    tier: "tier1",
    score: 92,
    formData: {
      field: "Climate Science",
      degree: "PhD",
      yearsExperience: "More than 15 years",
      publications: "More than 25",
      citations: "More than 500",
      patents: "None",
      awards: "1-3",
      grants: "4 or more",
      peerReview: "Yes, regularly",
      invitedTalks: "3 or more",
      nationalConnection: "Lead author IPCC; NSF-funded; US National Academy of Sciences",
      usPlan: "Continue climate-modeling research at the University of Pennsylvania",
      employerSituation: "Tenured faculty",
      name: "Michael E. Mann",
      institution: "University of Pennsylvania",
      university: "University of Pennsylvania",
    },
  },
  {
    // CS / computational biology — interdisciplinary; tests field detection.
    name: "Daphne Koller",
    email: `daphne.koller@${TEST_EMAIL_DOMAIN}`,
    tier: "tier1",
    score: 94,
    formData: {
      field: "Computer Science",
      degree: "PhD",
      yearsExperience: "More than 15 years",
      publications: "More than 25",
      citations: "More than 500",
      patents: "1-3",
      awards: "4 or more",
      grants: "4 or more",
      peerReview: "Yes, regularly",
      invitedTalks: "3 or more",
      nationalConnection: "Probabilistic graphical models; Coursera co-founder; NAE",
      usPlan: "Lead machine-learning-for-medicine research (insitro) in the US",
      employerSituation: "Industry research leadership",
      name: "Daphne Koller",
      institution: "Stanford University",
      university: "Stanford University",
    },
  },
];

// ─── Main ──────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const doVerify = args.includes("--verify");
  const doQuick = args.includes("--quick");
  const doClean = args.includes("--clean");

  if (doClean) {
    const deleted = await prisma.lead.deleteMany({
      where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
    });
    console.log(`🗑️  Cleaned ${deleted.count} existing test leads`);
  }

  console.log(`\n🌱 Seeding ${profiles.length} test researcher profiles...\n`);

  const created: { id: string; name: string; tier: string; score: number }[] = [];

  for (const p of profiles) {
    // Check for existing (idempotent)
    const existing = await prisma.lead.findUnique({ where: { email: p.email } });
    if (existing) {
      console.log(`  ⏭️  ${p.name} (${p.email}) — already exists, skipping`);
      created.push({ id: existing.id, name: p.name, tier: p.tier, score: p.score });
      continue;
    }

    const lead = await prisma.lead.create({
      data: {
        email: p.email,
        resultToken: crypto.randomUUID(),
        name: p.name,
        tier: p.tier,
        score: p.score,
        formData: p.formData as Prisma.InputJsonValue,
        source: "seed",
        status: "new",
        maturity: "M2", // Deep wizard complete — ready for verification
        dossierStatus: "idle",
      },
    });

    console.log(`  ✅ ${p.name} — ${p.tier} (score ${p.score}) → ${lead.id}`);
    created.push({ id: lead.id, name: p.name, tier: p.tier, score: p.score });
  }

  console.log(`\n📊 Seeded: ${created.length} leads (${created.filter(c => c.tier === "tier1").length} T1, ${created.filter(c => c.tier === "tier2").length} T2)`);

  // ── Optional: run verification ────────────────────────────────────

  if (doVerify || doQuick) {
    // Dynamic import to avoid loading heavy modules when just seeding
    const { verifyLead, quickPing } = await import("../lib/verification/orchestrator");

    console.log(`\n🔍 Running ${doVerify ? "full verification" : "quickPing"} on all leads...\n`);

    for (const c of created) {
      const start = Date.now();
      try {
        if (doVerify) {
          const result = await verifyLead(c.id, { reason: "backfill" });
          const elapsed = ((Date.now() - start) / 1000).toFixed(1);
          console.log(
            `  ${c.name} (${c.tier})` +
            `  trust=${result.trustScore}` +
            `  maturity=${result.newMaturity}` +
            `  events=${result.eventCount}` +
            `  ${elapsed}s`
          );
          if (result.scoringBreakdown.length > 0) {
            for (const b of result.scoringBreakdown) {
              const sign = b.points >= 0 ? "+" : "";
              console.log(`    ${sign}${b.points}  ${b.reason}`);
            }
          }
        } else {
          const result = await quickPing(c.id);
          const elapsed = ((Date.now() - start) / 1000).toFixed(1);
          console.log(
            `  ${c.name} (${c.tier})` +
            `  found=${result.found}` +
            `  confidence=${result.matchConfidence ?? "—"}` +
            `  works=${result.worksCount ?? "—"}` +
            `  cited=${result.citedByCount ?? "—"}` +
            `  inst=${result.institution ?? "—"}` +
            `  ${elapsed}s`
          );
        }
      } catch (err) {
        console.error(`  ❌ ${c.name}: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Rate-limit: 1s between leads to be polite to public APIs
      if (doVerify) await new Promise(r => setTimeout(r, 1000));
    }
  }

  // ── Summary ───────────────────────────────────────────────────────

  const allLeads = await prisma.lead.findMany({
    where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
    select: { name: true, tier: true, score: true, maturity: true, trustScore: true },
    orderBy: { score: "desc" },
  });

  console.log("\n═══════════════════════════════════════");
  console.log("  FINAL STATE");
  console.log("═══════════════════════════════════════");
  console.log(`${"Name".padEnd(25)} ${"Tier".padEnd(6)} ${"Score".padEnd(6)} ${"Mat".padEnd(4)} Trust`);
  console.log("─".repeat(55));
  for (const l of allLeads) {
    console.log(
      `${(l.name ?? "?").padEnd(25)} ${(l.tier ?? "?").padEnd(6)} ${String(l.score ?? 0).padEnd(6)} ${l.maturity.padEnd(4)} ${l.trustScore}`
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
