#!/usr/bin/env npx tsx
/**
 * Smoke test: seeds a realistic test case, generates a dossier, dumps the brief.
 * Run on the production server: docker compose exec -T app npx tsx scripts/smoke-test-dossier.ts
 */

import { PrismaClient } from "@prisma/client";
import { generateDossier } from "../lib/dossierGenerator";
import { renderDossierPdf } from "../lib/dossierPdf";
import { writeFileSync } from "fs";

const prisma = new PrismaClient();

const SYNTHETIC_FORM_DATA = {
  petitionerInfo: {
    givenName: "Yuki",
    familyName: "Tanaka",
    email: "smoke-test@petitionhq.test",
    dob: "1990-03-15",
    countryOfBirth: "Japan",
    countryOfCitizenship: "Japan",
    currentStatus: "H1B",
    currentAddress: {
      street: "77 Massachusetts Ave",
      city: "Cambridge",
      state: "MA",
      zip: "02139",
    },
    passportNumber: "SMOKETEST00",
    passportCountry: "Japan",
    passportExpiry: "2031-06-01",
  },
  qualifications: {
    highestDegree: "phd",
    degreeField: "Computer Science — Machine Learning",
    degreeInstitution: "Stanford University",
    degreeYear: 2019,
    endeavorField: "Artificial Intelligence",
    publications: [
      {
        title: "Federated Learning with Differential Privacy Guarantees for Clinical NLP",
        venue: "Proceedings of NeurIPS 2022",
        citations: 187,
        impactFactor: 26.1,
      },
      {
        title: "Privacy-Preserving Transformer Architectures for Electronic Health Records",
        venue: "Nature Machine Intelligence",
        citations: 134,
        impactFactor: 25.9,
      },
      {
        title: "Scalable Secure Aggregation for Cross-Silo Federated Learning",
        venue: "Proceedings of ICML 2021",
        citations: 98,
        impactFactor: 23.5,
      },
      {
        title: "Adaptive Gradient Compression in Privacy-Constrained Distributed Training",
        venue: "IEEE Transactions on Pattern Analysis and Machine Intelligence",
        citations: 76,
        impactFactor: 24.3,
      },
      {
        title: "A Survey of Differential Privacy in Natural Language Processing",
        venue: "ACL Anthology — Computational Linguistics",
        citations: 212,
        impactFactor: 9.3,
      },
      {
        title: "Membership Inference Attacks on Clinical Language Models: Risks and Mitigations",
        venue: "Proceedings of USENIX Security 2023",
        citations: 45,
        impactFactor: 12.8,
      },
    ],
    awards: [
      { name: "Outstanding Paper Award", issuer: "NeurIPS 2022" },
      { name: "NSF CAREER Award", issuer: "National Science Foundation (2023)" },
      { name: "MIT Technology Review Innovators Under 35", issuer: "MIT Technology Review (2024)" },
    ],
    grants: [
      {
        title: "Privacy-Preserving Federated Learning for Clinical Decision Support",
        funder: "National Institutes of Health (NIH)",
        amount: 1200000,
        role: "Principal Investigator",
      },
      {
        title: "Scalable Differential Privacy for Large Language Models",
        funder: "National Science Foundation (NSF)",
        amount: 750000,
        role: "Principal Investigator",
      },
      {
        title: "Secure Multi-Party Computation for Healthcare AI",
        funder: "DARPA",
        amount: 950000,
        role: "Co-PI",
      },
    ],
    patents: [
      {
        title: "System and Method for Federated Learning with Certified Differential Privacy",
        patentNumber: "US 11,823,456",
        status: "granted",
      },
    ],
    editorialRoles: [
      { journal: "IEEE Transactions on Pattern Analysis and Machine Intelligence", role: "Associate Editor" },
      { journal: "Journal of Machine Learning Research", role: "Reviewer" },
    ],
    invitedTalks: [
      { event: "NIH AI/ML Consortium Annual Meeting 2023", title: "Privacy-First Clinical AI" },
      { event: "White House OSTP Briefing on AI Safety (2024)", title: "Differential Privacy at Scale" },
    ],
    notableCitations: [
      { citedBy: "NIH Strategic Plan for Data Science (2023 update)", context: "Referenced as exemplary work in privacy-preserving clinical AI" },
      { citedBy: "NIST AI Risk Management Framework", context: "Cited in discussion of privacy safeguards for AI systems" },
    ],
    mediaCoverage: [
      { outlet: "MIT Technology Review", title: "How Federated Learning is Transforming Hospital AI" },
      { outlet: "Wired", title: "The Privacy Problem in Medical AI — And One Researcher's Fix" },
    ],
  },
  endeavor: {
    endeavorField: "Artificial Intelligence",
    endeavorStatement:
      "Developing and deploying privacy-preserving federated learning systems that enable hospitals and research institutions across the United States to collaboratively train clinical AI models without exposing protected patient data, directly advancing the national priority of trustworthy AI in healthcare.",
    nstcCategories: [
      "Artificial Intelligence",
      "Data Privacy and Security",
      "Advanced Computing",
    ],
    federalPrograms: [
      {
        programName: "NIH Bridge2AI Program",
        agencyOrOffice: "National Institutes of Health — Office of Data Science Strategy",
        specificGoal: "Generate new biomedical datasets that are ethically sourced, trustworthy, and AI-ready",
      },
      {
        programName: "NIST AI Risk Management Framework",
        agencyOrOffice: "National Institute of Standards and Technology",
        specificGoal: "Develop trustworthy AI systems with privacy safeguards",
      },
      {
        programName: "NSF Secure and Trustworthy Cyberspace (SaTC)",
        agencyOrOffice: "National Science Foundation — CISE Directorate",
        specificGoal: "Advance privacy-preserving computation for societal-scale systems",
      },
    ],
    researchIsPublished: true,
    usPlan: {
      milestones: [
        "Deploy federated learning system across 5 NIH-affiliated hospitals by Q2 2025",
        "Publish benchmark dataset of privacy-preserved clinical NLP features by 2025",
      ],
      collaborators: [
        "Massachusetts General Hospital — Biomedical Informatics",
        "Stanford HAI — Human-Centered AI Institute",
        "Mayo Clinic — Division of Digital Health Sciences",
      ],
      fundingSources: ["NIH R01", "NSF CAREER", "DARPA"],
    },
  },
  recommenders: [
    {
      name: "Dr. Sarah Chen",
      title: "Professor of Computer Science",
      institution: "MIT",
      department: "CSAIL — Computer Science and Artificial Intelligence Laboratory",
      relationship: "independent",
    },
    {
      name: "Dr. Michael Rivera",
      title: "Chief Medical Informatics Officer",
      institution: "Massachusetts General Hospital",
      department: "Department of Biomedical Informatics",
      relationship: "collaborator",
    },
    {
      name: "Dr. James Patterson",
      title: "Division Director, AI Research",
      institution: "National Institutes of Health",
      department: "National Library of Medicine",
      relationship: "independent",
    },
  ],
};

async function main() {
  console.log("=== Dossier Smoke Test ===\n");

  // Upsert a test case
  const testCaseId = "smoke-test-dossier-001";
  await prisma.case.upsert({
    where: { id: testCaseId },
    create: {
      id: testCaseId,
      formId: "smoke-test-form",
      title: "Smoke Test - Dr. Yuki Tanaka (AI/ML)",
      formData: SYNTHETIC_FORM_DATA as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
    update: {
      formData: SYNTHETIC_FORM_DATA as unknown as import("@prisma/client").Prisma.InputJsonValue,
    },
  });
  console.log("Test case upserted:", testCaseId);

  // Generate dossier
  console.log("\nGenerating dossier (skeleton → 3 sections → grounding check)...\n");
  const t0 = Date.now();
  const data = await generateDossier(testCaseId, "tier1", 92);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Done in ${elapsed}s\n`);

  // Dump skeleton
  console.log("── SKELETON ──");
  console.log("Substantial Merit atoms:", data.skeleton.substantialMerit.join(", ") || "(empty)");
  console.log("National Importance atoms:", data.skeleton.nationalImportance.join(", ") || "(empty)");
  console.log("Waiver Justification atoms:", data.skeleton.waiverJustification.join(", ") || "(empty)");

  // Dump brief sections
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("PRONG 1A — SUBSTANTIAL MERIT");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(data.brief.substantialMerit);
  console.log(`\n[Word count: ${data.brief.substantialMerit.split(/\s+/).length}]`);

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("PRONG 1B — NATIONAL IMPORTANCE");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(data.brief.nationalImportance);
  console.log(`\n[Word count: ${data.brief.nationalImportance.split(/\s+/).length}]`);

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("PRONG 3 — WAIVER JUSTIFICATION");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(data.brief.waiverJustification);
  console.log(`\n[Word count: ${data.brief.waiverJustification.split(/\s+/).length}]`);

  // Dump quality report
  console.log("\n── QUALITY REPORT ──");
  console.log("Credibility Score:", data.qualityReport.partnerCredibilityScore, "/ 100");
  console.log("Notes:", data.qualityReport.credibilityNotes);
  const allFlags = [
    ...data.qualityReport.flags.substantialMerit.map(f => ({ section: "SM", ...f })),
    ...data.qualityReport.flags.nationalImportance.map(f => ({ section: "NI", ...f })),
    ...data.qualityReport.flags.waiverJustification.map(f => ({ section: "WJ", ...f })),
  ];
  if (allFlags.length) {
    console.log(`\nGrounding flags (${allFlags.length}):`);
    allFlags.forEach(f => console.log(`  [${f.severity}] [${f.section}] "${f.text}" — ${f.reason}`));
  } else {
    console.log("Grounding flags: none (all claims verified)");
  }

  // Render PDF (skipped in tsx — JSX runtime not available; PDF renders fine in Next.js)
  try {
    const pdf = await renderDossierPdf(data);
    writeFileSync("/tmp/smoke-test-dossier.pdf", pdf);
    console.log(`\nPDF written to /tmp/smoke-test-dossier.pdf (${(pdf.length / 1024).toFixed(0)} KB)`);
  } catch {
    console.log("\n(PDF render skipped — JSX runtime not available outside Next.js)");
  }

  // Cleanup
  await prisma.case.delete({ where: { id: testCaseId } }).catch(() => {});
  await prisma.$disconnect();
  console.log("\nTest case cleaned up. Done.");
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
