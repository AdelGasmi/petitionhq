/**
 * Seed script — populates DB + S3 with realistic demo data.
 *
 * Usage:
 *   npx tsx scripts/seed.ts           # local (MinIO + Postgres:5433)
 *   npx tsx scripts/seed.ts --prod    # production (R2 + Postgres)
 *
 * Creates:
 *   - 3 users (admin, attorney, applicant)
 *   - 2 cases with form data
 *   - 4 documents (2 secure uploads, 2 public assets)
 *   - 5 leads across all tiers
 *   - 2 letters with versions
 */

import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();

// ─── S3 setup ──────────────────────────────────────────────────────────────

function getS3() {
  const endpoint = process.env.R2_ENDPOINT ?? "http://localhost:9000";
  return new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "minioadmin",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "minioadmin",
    },
  });
}

const SECURE_BUCKET = process.env.R2_BUCKET_SECURE ?? "petitionhq-secure-data";
const PUBLIC_BUCKET = process.env.R2_BUCKET_PUBLIC ?? "petitionhq-public-assets";

async function ensureBucket(s3: S3Client, bucket: string) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    console.log(`  Creating bucket: ${bucket}`);
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

async function uploadToS3(s3: S3Client, bucket: string, key: string, content: Buffer, mimeType: string) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: content,
    ContentType: mimeType,
    ContentLength: content.byteLength,
  }));
  console.log(`  ↑ ${bucket}/${key} (${content.byteLength} bytes)`);
}

// ─── Fake document content generators ──────────────────────────────────────

function fakePdf(title: string): Buffer {
  // Minimal valid PDF (displays title text)
  const content = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
  /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj
4 0 obj <</Length 44>>
stream
BT /F1 24 Tf 72 700 Td (${title}) Tj ET
endstream endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000360 00000 n
trailer <</Size 6 /Root 1 0 R>>
startxref
441
%%EOF`;
  return Buffer.from(content);
}

function fakeImage(label: string): Buffer {
  // 1x1 pixel PNG with label in metadata isn't practical,
  // so create a simple SVG converted to buffer
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="#f5f5f4" rx="8"/>
    <text x="200" y="150" text-anchor="middle" font-family="system-ui" font-size="18" fill="#44403c">${label}</text>
    <text x="200" y="180" text-anchor="middle" font-family="system-ui" font-size="12" fill="#a8a29e">PetitionHQ Seed Data</text>
  </svg>`;
  return Buffer.from(svg);
}

function fakeTxt(content: string): Buffer {
  return Buffer.from(content, "utf-8");
}

// ─── Seed ──────────────────────────────────────────────────────────────────

async function seed() {
  console.log("\n🌱 PetitionHQ Seed Script\n");

  const s3 = getS3();
  await ensureBucket(s3, SECURE_BUCKET);
  await ensureBucket(s3, PUBLIC_BUCKET);
  console.log("✓ S3 buckets ready\n");

  // ── 1. Users ──────────────────────────────────────────────────────
  console.log("Creating users...");
  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@petitionhq.us" },
    update: {},
    create: {
      email: "admin@petitionhq.us",
      name: "Admin User",
      role: "admin",
      passwordHash,
      verified: true,
    },
  });
  console.log(`  ✓ Admin: ${admin.email} (${admin.id})`);

  const attorney = await prisma.user.upsert({
    where: { email: "attorney@petitionhq.us" },
    update: {},
    create: {
      email: "attorney@petitionhq.us",
      name: "Sarah Chen",
      role: "attorney",
      passwordHash,
      verified: true,
      phone: "+1-555-0101",
    },
  });
  console.log(`  ✓ Attorney: ${attorney.email} (${attorney.id})`);

  const applicant = await prisma.user.upsert({
    where: { email: "applicant@petitionhq.us" },
    update: {},
    create: {
      email: "applicant@petitionhq.us",
      name: "Dr. Wei Zhang",
      role: "applicant",
      passwordHash,
      verified: true,
      plan: "standard",
    },
  });
  console.log(`  ✓ Applicant: ${applicant.email} (${applicant.id})`);

  // ── 2. Firm profile for attorney ──────────────────────────────────
  await prisma.firmProfile.upsert({
    where: { userId: attorney.id },
    update: {},
    create: {
      userId: attorney.id,
      firmName: "Chen & Associates Immigration Law",
      specialties: ["EB-2 NIW", "EB-1A", "O-1"],
    },
  });
  console.log("  ✓ Firm profile for attorney\n");

  // ── 3. Cases ──────────────────────────────────────────────────────
  console.log("Creating cases...");

  // Case 1: Strong NIW case (applicant-owned, attorney assigned)
  const case1 = await prisma.case.create({
    data: {
      formId: "i140-niw",
      title: "EB-2 NIW — Dr. Wei Zhang (Machine Learning)",
      status: "review",
      ownerId: applicant.id,
      attorneyId: attorney.id,
      formData: {
        field: "Machine Learning",
        degree: "PhD",
        yearsExperience: "More than 10 years",
        publications: "More than 25",
        citations: "More than 500",
        awards: "International award or prize",
        grants: "Large grant (over $500K)",
        peerReview: "Editorial board member or associate editor",
        invitedTalks: "4 or more",
        patents: "3 or more",
        nationalConnection: "My work directly addresses a named national initiative with documented urgency",
        usPlan: "Funded position, signed agreement, or active collaboration",
        employerSituation: "My research is self-directed — no single employer applies",
        beneficiaryName: "Wei Zhang",
        beneficiaryEmail: "wei.zhang@example.com",
      },
    },
  });
  console.log(`  ✓ Case 1: ${case1.title} (${case1.id})`);

  // Case 2: Draft NIW case (applicant-owned, no attorney)
  const case2 = await prisma.case.create({
    data: {
      formId: "i140-niw",
      title: "EB-2 NIW — Dr. Maria Santos (Climate Science)",
      status: "draft",
      ownerId: applicant.id,
      formData: {
        field: "Climate Science",
        degree: "PhD",
        yearsExperience: "5–10 years",
        publications: "11–25",
        citations: "201–500",
        beneficiaryName: "Maria Santos",
      },
    },
  });
  console.log(`  ✓ Case 2: ${case2.title} (${case2.id})`);

  // ── 4. Documents + S3 uploads ─────────────────────────────────────
  console.log("\nUploading documents...");

  // Secure bucket: case evidence documents
  const cvPdf = fakePdf("Curriculum Vitae - Dr. Wei Zhang");
  const cvKey = `uploads/${case1.id}/cv/cv-wei-zhang.pdf`;
  await uploadToS3(s3, SECURE_BUCKET, cvKey, cvPdf, "application/pdf");

  const doc1 = await prisma.document.create({
    data: {
      caseId: case1.id,
      requirementId: "cv",
      status: "uploaded",
      filename: "cv-wei-zhang.pdf",
      storedFilename: cvKey,
      mimeType: "application/pdf",
      size: cvPdf.byteLength,
    },
  });
  console.log(`  ✓ Doc (secure): CV — ${doc1.id}`);

  const pubList = fakeTxt(`Publication List — Dr. Wei Zhang

1. Zhang, W. et al. "Deep Learning for Drug Discovery." Nature ML, 2024. (142 citations)
2. Zhang, W. & Lee, S. "Federated Learning in Healthcare." ICML 2023. (89 citations)
3. Zhang, W. "Transformers for Genomic Sequence Analysis." NeurIPS 2022. (201 citations)
4. Zhang, W. et al. "Privacy-Preserving ML in Clinical Trials." JAMA AI, 2023. (67 citations)
5. Zhang, W. "Scalable Graph Neural Networks for Protein Folding." Science, 2024. (312 citations)

Total: 25+ publications, 800+ citations
Google Scholar: https://scholar.google.com/citations?user=example`);
  const pubKey = `uploads/${case1.id}/publications/publication-list.txt`;
  await uploadToS3(s3, SECURE_BUCKET, pubKey, pubList, "text/plain");

  const doc2 = await prisma.document.create({
    data: {
      caseId: case1.id,
      requirementId: "publications",
      status: "uploaded",
      filename: "publication-list.txt",
      storedFilename: pubKey,
      mimeType: "text/plain",
      size: pubList.byteLength,
    },
  });
  console.log(`  ✓ Doc (secure): Publications — ${doc2.id}`);

  // Secure bucket: case 2 document
  const cv2Pdf = fakePdf("CV - Dr. Maria Santos");
  const cv2Key = `uploads/${case2.id}/cv/cv-maria-santos.pdf`;
  await uploadToS3(s3, SECURE_BUCKET, cv2Key, cv2Pdf, "application/pdf");

  await prisma.document.create({
    data: {
      caseId: case2.id,
      requirementId: "cv",
      status: "uploaded",
      filename: "cv-maria-santos.pdf",
      storedFilename: cv2Key,
      mimeType: "application/pdf",
      size: cv2Pdf.byteLength,
    },
  });
  console.log(`  ✓ Doc (secure): CV for case 2`);

  // Public bucket: marketing/branding assets
  const logoSvg = fakeImage("PetitionHQ Logo");
  await uploadToS3(s3, PUBLIC_BUCKET, "assets/logo.svg", logoSvg, "image/svg+xml");
  console.log(`  ✓ Asset (public): logo.svg`);

  const bannerSvg = fakeImage("EB-2 NIW Assessment Banner");
  await uploadToS3(s3, PUBLIC_BUCKET, "assets/banner-niw.svg", bannerSvg, "image/svg+xml");
  console.log(`  ✓ Asset (public): banner-niw.svg`);

  // ── 5. Letters ────────────────────────────────────────────────────
  console.log("\nCreating letters...");

  const letter1Id = crypto.randomUUID().slice(0, 16).replace(/-/g, "");
  const letter1 = await prisma.letter.create({
    data: {
      id: letter1Id,
      caseId: case1.id,
      requirementId: "rec-letter-1",
      recommender: {
        name: "Prof. James Liu",
        title: "Department Chair, Computer Science",
        org: "Stanford University",
        email: "j.liu@stanford.example.com",
        relationship: "PhD Advisor",
      },
      currentDraft: `Dear USCIS Officer,

I am writing to support the EB-2 National Interest Waiver petition of Dr. Wei Zhang. As Dr. Zhang's doctoral advisor at Stanford University, I have had the privilege of observing his extraordinary contributions to the field of Machine Learning over the past decade.

Dr. Zhang's research on privacy-preserving machine learning has been cited over 800 times, and his work on federated learning in healthcare has been adopted by three major hospital systems.

I strongly recommend approval of Dr. Zhang's NIW petition.

Sincerely,
Prof. James Liu`,
    },
  });
  console.log(`  ✓ Letter 1: Prof. James Liu (${letter1.id})`);

  const versionId1 = crypto.randomUUID().slice(0, 16).replace(/-/g, "");
  await prisma.letterVersion.create({
    data: {
      id: versionId1,
      letterId: letter1.id,
      content: letter1.currentDraft!,
    },
  });

  const letter2Id = crypto.randomUUID().slice(0, 16).replace(/-/g, "");
  const letter2 = await prisma.letter.create({
    data: {
      id: letter2Id,
      caseId: case1.id,
      requirementId: "rec-letter-2",
      recommender: {
        name: "Dr. Emily Park",
        title: "Director of AI Research",
        org: "National Institutes of Health",
        email: "e.park@nih.example.gov",
        relationship: "Collaborator",
      },
    },
  });
  console.log(`  ✓ Letter 2: Dr. Emily Park (${letter2.id})`);

  // ── 6. Leads ──────────────────────────────────────────────────────
  console.log("\nCreating leads...");

  const leads = [
    { email: "strong-lead@example.com", name: "Dr. Amir Patel", tier: "tier1", score: 82, field: "Biomedical Engineering" },
    { email: "borderline-lead@example.com", name: "Dr. Yuki Tanaka", tier: "tier2", score: 58, field: "Environmental Science" },
    { email: "weak-lead-1@example.com", name: "Raj Kumar", tier: "tier3", score: 35, field: "Software Engineering" },
    { email: "weak-lead-2@example.com", name: "Ana Petrova", tier: "tier3", score: 28, field: "Data Science" },
    { email: "claimed-lead@example.com", name: "Dr. Carlos Rivera", tier: "tier1", score: 88, field: "Neuroscience" },
  ];

  for (const l of leads) {
    const lead = await prisma.lead.upsert({
      where: { email: l.email },
      update: {},
      create: {
        email: l.email,
        resultToken: randomBytes(24).toString("hex"),
        name: l.name,
        tier: l.tier,
        score: l.score,
        formData: { field: l.field, degree: l.score > 50 ? "PhD" : "Master's" },
        source: "check",
        status: "new",
        // Last lead is claimed by attorney
        ...(l.email === "claimed-lead@example.com"
          ? { claimedByUserId: attorney.id, applicantStatus: "approved" }
          : {}),
      },
    });
    console.log(`  ✓ Lead: ${l.name} (${l.tier}, score: ${l.score}) — ${lead.id}`);
  }

  // ── 7. Activity log entries ───────────────────────────────────────
  console.log("\nCreating activity log...");
  await prisma.activityLog.createMany({
    data: [
      { caseId: case1.id, action: "case_created", actorId: applicant.id, detail: "Case created via /check funnel" },
      { caseId: case1.id, action: "attorney_assigned", actorId: admin.id, detail: `Attorney ${attorney.name} assigned` },
      { caseId: case1.id, action: "document_uploaded", actorId: applicant.id, detail: "CV uploaded" },
      { caseId: case1.id, action: "document_uploaded", actorId: applicant.id, detail: "Publication list uploaded" },
      { caseId: case1.id, action: "status_changed", actorId: attorney.id, detail: "Status → review" },
      { caseId: case1.id, action: "letter_created", actorId: attorney.id, detail: "Letter from Prof. James Liu" },
    ],
  });
  console.log("  ✓ 6 activity log entries\n");

  // ── Summary ───────────────────────────────────────────────────────
  const counts = {
    users: await prisma.user.count(),
    cases: await prisma.case.count(),
    documents: await prisma.document.count(),
    letters: await prisma.letter.count(),
    leads: await prisma.lead.count(),
  };

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Seed complete!");
  console.log(`   Users: ${counts.users}  |  Cases: ${counts.cases}  |  Docs: ${counts.documents}`);
  console.log(`   Letters: ${counts.letters}  |  Leads: ${counts.leads}`);
  console.log(`   S3 Secure: ${SECURE_BUCKET}  |  S3 Public: ${PUBLIC_BUCKET}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n🔑 Login credentials (all users): password123\n");
}

seed()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
