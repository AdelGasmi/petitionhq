/**
 * DATA-1: Analyze the 50 existing applicants.
 *
 * Outputs aggregate statistics — NO PII, NO individual records.
 * Reports: field distribution, score/trust-score distribution, consent rate
 * by field, ORCID-OAuth rate, and field breakdown of consented leads.
 *
 * Usage (local):
 *   npx tsx scripts/analyze-applicants.ts
 *
 * Usage (prod):
 *   ssh root@YOUR_SERVER_IP "cd /opt/petitionhq && npx tsx scripts/analyze-applicants.ts"
 */

import { prisma } from "../lib/prisma";

function pct(n: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((n / total) * 100)}%`;
}

function buckets(values: number[], edges: number[]): string {
  const counts = new Array(edges.length + 1).fill(0);
  for (const v of values) {
    let i = 0;
    while (i < edges.length && v >= edges[i]) i++;
    counts[i]++;
  }
  const labels = edges.map((e, i) => (i === 0 ? `<${e}` : `${edges[i - 1]}–${e - 1}`));
  labels.push(`≥${edges[edges.length - 1]}`);
  return labels.map((l, i) => `  ${l}: ${counts[i]}`).join("\n");
}

async function main() {
  const leads = await prisma.lead.findMany({
    select: {
      tier: true,
      score: true,
      trustScore: true,
      applicantStatus: true,
      orcidAuthenticated: true,
      maturity: true,
      formData: true,
      capturedAt: true,
    },
  });

  const total = leads.length;
  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`  DATA-1: Applicant Cohort Analysis`);
  console.log(`  Generated: ${new Date().toISOString()}`);
  console.log(`═══════════════════════════════════════════════\n`);
  console.log(`Total leads captured: ${total}`);

  // ── Consent breakdown ────────────────────────────────────────────────────────
  const consented = leads.filter((l) => l.applicantStatus === "approved");
  const declined = leads.filter((l) => l.applicantStatus === "declined");
  const unclaimed = leads.filter((l) => l.applicantStatus === "unclaimed");
  console.log(`\nConsent breakdown:`);
  console.log(`  Consented (approved): ${consented.length} (${pct(consented.length, total)})`);
  console.log(`  Declined:             ${declined.length} (${pct(declined.length, total)})`);
  console.log(`  Unclaimed:            ${unclaimed.length} (${pct(unclaimed.length, total)})`);

  // ── ORCID OAuth ───────────────────────────────────────────────────────────────
  const orcidTotal = leads.filter((l) => l.orcidAuthenticated).length;
  const orcidConsented = consented.filter((l) => l.orcidAuthenticated).length;
  console.log(`\nORCID OAuth (identity confirmed):`);
  console.log(`  All leads:       ${orcidTotal} / ${total} (${pct(orcidTotal, total)})`);
  console.log(`  Consented leads: ${orcidConsented} / ${consented.length} (${pct(orcidConsented, consented.length)})`);

  // ── Tier distribution ─────────────────────────────────────────────────────────
  const tierCounts: Record<string, number> = {};
  for (const l of leads) {
    const t = l.tier ?? "unknown";
    tierCounts[t] = (tierCounts[t] ?? 0) + 1;
  }
  console.log(`\nTier distribution (all leads):`);
  for (const [tier, count] of Object.entries(tierCounts).sort()) {
    console.log(`  ${tier}: ${count} (${pct(count, total)})`);
  }

  // ── Score distribution ────────────────────────────────────────────────────────
  const scores = leads.map((l) => l.score ?? 0).filter((s) => s > 0);
  const trustScores = leads.map((l) => l.trustScore).filter((s) => s > 0);
  console.log(`\nNIW score distribution (${scores.length} with score):`);
  console.log(buckets(scores, [40, 60, 70, 80, 90]));

  console.log(`\nTrust score distribution (${trustScores.length} with trust > 0):`);
  console.log(buckets(trustScores, [20, 40, 60, 80]));
  const above60 = trustScores.filter((s) => s >= 60).length;
  console.log(`  Above 60 (attorney-visible gate): ${above60} / ${trustScores.length} (${pct(above60, trustScores.length)})`);

  // ── Field distribution ────────────────────────────────────────────────────────
  function getField(fd: unknown): string {
    if (!fd || typeof fd !== "object") return "unknown";
    const d = fd as Record<string, unknown>;
    return typeof d.field === "string" && d.field.trim() ? d.field.trim() : "unknown";
  }

  const fieldCounts: Record<string, number> = {};
  for (const l of leads) {
    const f = getField(l.formData);
    fieldCounts[f] = (fieldCounts[f] ?? 0) + 1;
  }

  const sortedFields = Object.entries(fieldCounts).sort(([, a], [, b]) => b - a);
  console.log(`\nField distribution — all leads (top 20):`);
  for (const [field, count] of sortedFields.slice(0, 20)) {
    console.log(`  ${field}: ${count} (${pct(count, total)})`);
  }

  // ── Field breakdown of consented leads ───────────────────────────────────────
  const consentedFieldCounts: Record<string, number> = {};
  for (const l of consented) {
    const f = getField(l.formData);
    consentedFieldCounts[f] = (consentedFieldCounts[f] ?? 0) + 1;
  }
  const sortedConsentedFields = Object.entries(consentedFieldCounts).sort(([, a], [, b]) => b - a);
  console.log(`\nField breakdown — consented leads (${consented.length} total):`);
  for (const [field, count] of sortedConsentedFields) {
    console.log(`  ${field}: ${count} (${pct(count, consented.length)} of consented)`);
  }

  // ── Consent rate by field (top fields) ───────────────────────────────────────
  console.log(`\nConsent rate by field (fields with ≥2 leads):`);
  for (const [field] of sortedFields.slice(0, 15)) {
    const fieldLeads = leads.filter((l) => getField(l.formData) === field);
    const fieldConsented = fieldLeads.filter((l) => l.applicantStatus === "approved");
    if (fieldLeads.length >= 2) {
      console.log(`  ${field}: ${fieldConsented.length}/${fieldLeads.length} (${pct(fieldConsented.length, fieldLeads.length)})`);
    }
  }

  // ── Maturity distribution ─────────────────────────────────────────────────────
  const maturityCounts: Record<string, number> = {};
  for (const l of leads) {
    const m = l.maturity ?? "unknown";
    maturityCounts[m] = (maturityCounts[m] ?? 0) + 1;
  }
  console.log(`\nMaturity stage distribution:`);
  for (const [m, count] of Object.entries(maturityCounts).sort()) {
    console.log(`  ${m}: ${count}`);
  }
  const m7 = maturityCounts["M7"] ?? 0;
  console.log(`  M7 (attorney-ready): ${m7} / ${total} (${pct(m7, total)})`);

  // ── Degree distribution ───────────────────────────────────────────────────────
  const degreeCounts: Record<string, number> = {};
  for (const l of leads) {
    const fd = l.formData as Record<string, unknown> | null;
    const deg = typeof fd?.degree === "string" ? fd.degree.trim() : "unknown";
    degreeCounts[deg] = (degreeCounts[deg] ?? 0) + 1;
  }
  const sortedDegrees = Object.entries(degreeCounts).sort(([, a], [, b]) => b - a);
  console.log(`\nDegree distribution:`);
  for (const [deg, count] of sortedDegrees) {
    console.log(`  ${deg}: ${count} (${pct(count, total)})`);
  }

  // ── AI/ML wedge hypothesis check ─────────────────────────────────────────────
  const aiFields = [
    "machine learning", "artificial intelligence", "deep learning", "nlp",
    "computer science", "computer vision", "data science", "robotics",
    "ai", "ml", "neural", "llm", "generative",
  ];
  const isAI = (f: string) => aiFields.some((kw) => f.toLowerCase().includes(kw));

  const aiLeads = leads.filter((l) => isAI(getField(l.formData)));
  const aiConsented = aiLeads.filter((l) => l.applicantStatus === "approved");
  const nonAiLeads = leads.filter((l) => !isAI(getField(l.formData)));
  const nonAiConsented = nonAiLeads.filter((l) => l.applicantStatus === "approved");

  console.log(`\nAI/ML wedge hypothesis:`);
  console.log(`  AI/ML-adjacent leads: ${aiLeads.length} / ${total} (${pct(aiLeads.length, total)})`);
  console.log(`    Consent rate: ${pct(aiConsented.length, aiLeads.length)} (${aiConsented.length}/${aiLeads.length})`);
  console.log(`  Non-AI/ML leads: ${nonAiLeads.length} / ${total} (${pct(nonAiLeads.length, total)})`);
  console.log(`    Consent rate: ${pct(nonAiConsented.length, nonAiLeads.length)} (${nonAiConsented.length}/${nonAiLeads.length})`);

  const aiShare = consented.length > 0 ? Math.round((aiConsented.length / consented.length) * 100) : 0;
  if (aiLeads.length > 0) {
    console.log(`  → AI/ML makes up ${aiShare}% of consented cohort`);
    if (aiShare >= 50) {
      console.log(`  ✓ AI/ML WEDGE CONFIRMED: AI/ML leads dominate the consented cohort.`);
    } else {
      console.log(`  ✗ AI/ML wedge NOT confirmed by data — consented cohort is diverse.`);
    }
  }

  console.log(`\n═══════════════════════════════════════════════\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
