#!/usr/bin/env npx tsx
/**
 * Manual lead verification CLI.
 *
 * Usage:
 *   npx tsx scripts/manual/verify-lead.ts <leadId>
 *   npx tsx scripts/manual/verify-lead.ts <leadId> --quick   # quickPing only
 *   npx tsx scripts/manual/verify-lead.ts --list             # list recent leads
 *
 * Requires local Postgres (DATABASE_URL in .env or defaults to dev).
 */

import { verifyLead, quickPing } from "../../lib/verification/orchestrator";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function listLeads() {
  const leads = await prisma.lead.findMany({
    orderBy: { capturedAt: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      email: true,
      maturity: true,
      trustScore: true,
      lastVerifiedAt: true,
      capturedAt: true,
    },
  });

  console.log("\nRecent leads:\n");
  console.log(
    "ID".padEnd(28) +
    "Name".padEnd(25) +
    "Maturity".padEnd(10) +
    "Trust".padEnd(7) +
    "Verified".padEnd(22) +
    "Captured",
  );
  console.log("-".repeat(110));

  for (const lead of leads) {
    console.log(
      lead.id.padEnd(28) +
      (lead.name ?? "—").slice(0, 23).padEnd(25) +
      String(lead.maturity ?? "M0").padEnd(10) +
      String(lead.trustScore ?? 0).padEnd(7) +
      (lead.lastVerifiedAt ? lead.lastVerifiedAt.toISOString().slice(0, 19) : "—").padEnd(22) +
      (lead.capturedAt?.toISOString().slice(0, 19) ?? "—"),
    );
  }
  console.log();
}

async function runQuickPing(leadId: string) {
  console.log(`\nQuick ping for lead ${leadId}...\n`);
  const start = Date.now();
  const result = await quickPing(leadId);
  const elapsed = Date.now() - start;

  if (result.found) {
    console.log(`Found in ${elapsed}ms:`);
    console.log(`  Match confidence: ${result.matchConfidence}`);
    console.log(`  Works count:      ${result.worksCount}`);
    console.log(`  Cited by:         ${result.citedByCount}`);
    console.log(`  Institution:      ${result.institution ?? "—"}`);
  } else {
    console.log(`Not found (${elapsed}ms)`);
  }
  console.log();
}

async function runFullVerification(leadId: string) {
  // Load lead first to show current state
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    console.error(`Lead ${leadId} not found`);
    process.exit(1);
  }

  const formData = (lead.formData ?? {}) as Record<string, unknown>;
  console.log(`\nVerifying lead: ${lead.name ?? lead.email}`);
  console.log(`  Current maturity: ${lead.maturity}`);
  console.log(`  Current trust:    ${lead.trustScore}`);
  console.log(`  Form data:        ${JSON.stringify(formData, null, 2)}`);
  console.log();

  const start = Date.now();
  const result = await verifyLead(leadId, { reason: "manual" });
  const elapsed = Date.now() - start;

  console.log(`Verification complete (${elapsed}ms):\n`);
  console.log(`  Trust score:   ${result.trustScore}/100`);
  console.log(`  New maturity:  ${result.newMaturity}`);
  console.log(`  Events written: ${result.eventCount}`);
  console.log();

  // Print scoring breakdown
  console.log("Scoring breakdown:");
  for (const rule of result.scoringBreakdown) {
    const sign = rule.points >= 0 ? "+" : "";
    console.log(`  ${sign}${rule.points}  ${rule.rule}: ${rule.reason}`);
  }
  console.log();

  // Print verified claims
  console.log("Verified claims:");
  for (const [key, claim] of Object.entries(result.verifiedClaims)) {
    const icon =
      claim.status === "verified" ? "V" :
      claim.status === "not_found" ? "X" :
      claim.status === "contradicted" ? "!" :
      claim.status === "self_reported" ? "~" : "?";
    console.log(`  [${icon}] ${key} (${claim.source}, confidence: ${claim.confidence})`);
    if (claim.detail) console.log(`      ${claim.detail}`);
    if (claim.sourceUrl) console.log(`      ${claim.sourceUrl}`);
  }
  console.log();
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help") {
    console.log("Usage:");
    console.log("  npx tsx scripts/manual/verify-lead.ts <leadId>");
    console.log("  npx tsx scripts/manual/verify-lead.ts <leadId> --quick");
    console.log("  npx tsx scripts/manual/verify-lead.ts --list");
    process.exit(0);
  }

  if (args[0] === "--list") {
    await listLeads();
    process.exit(0);
  }

  const leadId = args[0];
  const isQuick = args.includes("--quick");

  if (isQuick) {
    await runQuickPing(leadId);
  } else {
    await runFullVerification(leadId);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
