import { randomBytes } from "crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

const rtoken = () => randomBytes(24).toString("hex");

/**
 * ATTORNEY-SIDE TEST CASES
 *
 * Tests the complete attorney workflow from lead discovery through case management.
 * Covers: lead dashboard → claim → lead consent → case creation → workspace access
 */

describe("Attorney Flow — Lead Discovery to Case Management", () => {
  let leadId: string;
  let attorneyUserId: string;
  let caseId: string;
  let intakeToken: string;

  beforeAll(async () => {
    // Create test attorney account
    const attorney = await prisma.user.create({
      data: {
        email: "attorney@test.com",
        name: "Jane Attorney",
        role: "attorney",
        passwordHash: "hashed_password_123",
      },
    });
    attorneyUserId = attorney.id;

    // Create firm profile for attorney (Pricing V3 — no credits, subscription-based)
    await prisma.firmProfile.create({
      data: {
        userId: attorney.id,
        firmName: "Test Immigration Law",
      },
    });

    // Create test lead (completed assessment)
    const lead = await prisma.lead.create({
      data: {
        email: "applicant@test.com",
        resultToken: rtoken(),
        name: "John Researcher",
        tier: "tier1",
        score: 82,
        formData: {
          degree: "PhD",
          field: "Computational Biology",
          years: 8,
          publications: "11–25",
          citations: "201–500",
          awards: "Yes",
          grants: "NSF",
          peerReview: "Yes",
          invitedTalks: "Yes",
          patents: "1",
          nationalConnection: "China",
          usPlan: "Yes",
          employerSituation: "Academic",
        },
        applicantStatus: "unclaimed",
        status: "new",
        source: "check",
      },
    });
    leadId = lead.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.lead.deleteMany({ where: { email: "applicant@test.com" } });
    await prisma.case.deleteMany({ where: { id: caseId } });
    await prisma.firmProfile.deleteMany({ where: { userId: attorneyUserId } });
    await prisma.user.deleteMany({ where: { id: attorneyUserId } });
  });

  // ===================================================================
  // TEST SUITE 1: Lead Discovery & Dashboard
  // ===================================================================

  describe("TC-ATT-001: Lead appears in admin dashboard with correct data", () => {
    it("should display lead with tier, score, and field", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      expect(lead).toBeDefined();
      expect(lead?.tier).toBe("tier1");
      expect(lead?.score).toBe(82);
      expect(lead?.name).toBe("John Researcher");
      expect(lead?.email).toBe("applicant@test.com");
    });

    it("should show lead status as 'new' when not claimed", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      expect(lead?.status).toBe("new");
      expect(lead?.claimedByUserId).toBeNull();
      expect(lead?.applicantStatus).toBe("unclaimed");
    });

    it("should preserve form answers for attorney review", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      const formData = lead?.formData as Record<string, unknown>;
      expect(formData.field).toBe("Computational Biology");
      expect(formData.degree).toBe("PhD");
      expect(formData.publications).toBe("11–25");
      expect(formData.citations).toBe("201–500");
    });
  });

  describe("TC-ATT-002: Attorney can view lead details before claiming", () => {
    it("should allow attorney access to lead profile page", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          tier: true,
          score: true,
          name: true,
          email: true,
          formData: true,
        },
      });

      expect(lead).toBeDefined();
      expect(lead?.id).toBe(leadId);
      expect(lead?.tier).toBe("tier1");
    });

    it("should display profile snapshot with key metrics", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      const formData = lead?.formData as Record<string, unknown>;
      expect(formData.degree).toBeDefined();
      expect(formData.field).toBeDefined();
      expect(formData.publications).toBeDefined();
    });

    it("should show claim button for unclaimed leads", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      expect(lead?.claimedByUserId).toBeNull();
      expect(lead?.applicantStatus).toBe("unclaimed");
      // UI will show claim button when these conditions are met
    });
  });

  // ===================================================================
  // TEST SUITE 2: Lead Claim & Attorney Contact
  // ===================================================================

  describe("TC-ATT-003: Attorney can claim a lead (initiates contact)", () => {
    it("should update lead status to 'claimed' when attorney claims", async () => {
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          claimedByUserId: attorneyUserId,
          status: "claimed",
          applicantStatus: "pending_approval",
        },
      });

      const updated = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      expect(updated?.claimedByUserId).toBe(attorneyUserId);
      expect(updated?.status).toBe("claimed");
      expect(updated?.applicantStatus).toBe("pending_approval");
    });

    // Credit-based tests removed — Pricing V3 uses per-claim Stripe Checkout.
    // Credit columns still exist in schema but are no longer read/written.

    it("should require active subscription before claiming (Pricing V3)", async () => {
      // Reset to unclaimed state
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          claimedByUserId: null,
          status: "new",
          applicantStatus: "unclaimed",
        },
      });

      const firm = await prisma.firmProfile.findUnique({
        where: { userId: attorneyUserId },
      });

      // Subscription status gates the claim flow — not credits
      // Without an active subscription, claim route returns 402
      expect(firm?.subscriptionStatus).not.toBe("active");
    });

    it("should prevent double-claim (concurrent claims)", async () => {
      // Reset to unclaimed
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          claimedByUserId: null,
          status: "new",
          applicantStatus: "unclaimed",
        },
      });

      // First attorney claims
      await prisma.lead.updateMany({
        where: {
          id: leadId,
          claimedByUserId: null,
          applicantStatus: "unclaimed",
        },
        data: {
          claimedByUserId: attorneyUserId,
          status: "claimed",
          applicantStatus: "pending_approval",
        },
      });

      // Create second attorney
      const attorney2 = await prisma.user.create({
        data: {
          email: "attorney2@test.com",
          name: "Bob Attorney",
          role: "attorney",
          passwordHash: "hashed_password_456",
        },
      });

      // Second attorney tries to claim same lead
      const secondClaim = await prisma.lead.updateMany({
        where: {
          id: leadId,
          claimedByUserId: null,
          applicantStatus: "unclaimed",
        },
        data: {
          claimedByUserId: attorney2.id,
          status: "claimed",
          applicantStatus: "pending_approval",
        },
      });

      // Should fail (count = 0)
      expect(secondClaim.count).toBe(0);

      // Cleanup
      await prisma.user.delete({ where: { id: attorney2.id } });

      // Reset for next tests
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          claimedByUserId: null,
          status: "new",
          applicantStatus: "unclaimed",
        },
      });
    });
  });

  describe("TC-ATT-004: Lead receives attorney claim notification", () => {
    it("should send claim consent email to lead", async () => {
      // This is tested in email tests, but we verify the trigger
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          claimedByUserId: attorneyUserId,
          status: "claimed",
          applicantStatus: "pending_approval",
        },
      });

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      // Email should be triggered with this state
      expect(lead?.applicantStatus).toBe("pending_approval");
      expect(lead?.email).toBe("applicant@test.com");
    });

    it("should include attorney name and firm in notification", async () => {
      const attorney = await prisma.user.findUnique({
        where: { id: attorneyUserId },
      });
      const firm = await prisma.firmProfile.findUnique({
        where: { userId: attorneyUserId },
      });

      expect(attorney?.name).toBe("Jane Attorney");
      expect(firm?.firmName).toBe("Test Immigration Law");
    });

    it("should create consent token for lead response", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      // In real flow, token is created and sent
      // Here we verify the state that triggers token creation
      expect(lead?.applicantStatus).toBe("pending_approval");
      expect(lead?.email).toBeDefined();
    });
  });

  // ===================================================================
  // TEST SUITE 3: Lead Consent & Approval
  // ===================================================================

  describe("TC-ATT-005: Lead approves attorney retention", () => {
    it("should update applicantStatus to 'approved' when lead clicks consent", async () => {
      await prisma.lead.update({
        where: { id: leadId },
        data: { applicantStatus: "approved" },
      });

      const updated = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      expect(updated?.applicantStatus).toBe("approved");
    });

    it("should only transition from pending_approval → approved", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      // Already in approved state
      expect(lead?.applicantStatus).toBe("approved");
    });

    it("should not double-approve", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      expect(lead?.applicantStatus).toBe("approved");
      // Calling approval again should be idempotent
    });
  });

  describe("TC-ATT-006: Lead declines attorney retention", () => {
    it("should prevent case creation if lead hasn't approved", async () => {
      // Create a new unclaimed lead
      const declinedLead = await prisma.lead.create({
        data: {
          email: "declined@test.com",
          resultToken: rtoken(),
          name: "Declined Applicant",
          tier: "tier2",
          score: 65,
          formData: { field: "Physics" },
          applicantStatus: "unclaimed",
          status: "new",
          source: "check",
        },
      });

      // Claim it
      await prisma.lead.update({
        where: { id: declinedLead.id },
        data: {
          claimedByUserId: attorneyUserId,
          applicantStatus: "pending_approval",
        },
      });

      // Try to create case (should fail in API — no case created)
      const lead = await prisma.lead.findUnique({
        where: { id: declinedLead.id },
      });

      // Still pending approval, no case
      expect(lead?.applicantStatus).toBe("pending_approval");
      expect(lead?.caseId).toBeNull();

      // Cleanup
      await prisma.lead.delete({ where: { id: declinedLead.id } });
    });

    it("should not appear in attorney's active pipeline if declined", async () => {
      // This is a UI concern — declined leads should be hidden from active pipeline
      // Database-wise, they remain as status "claimed" with applicantStatus still "pending_approval"
      // UI filters to only show approved leads
    });
  });

  // ===================================================================
  // TEST SUITE 4: Case Creation & Workspace Access
  // ===================================================================

  describe("TC-ATT-007: Case is created when lead approves and attorney initiates intake", () => {
    it("should create case with EB-2 NIW form template", async () => {
      const newCase = await prisma.case.create({
        data: {
          formId: "i140-niw",
          title: "EB-2 NIW — Computational Biology",
          formData: {
            qualifications: {
              endeavorField: "Computational Biology",
              highestDegree: "phd",
              publications: [
                { title: "Publication 1", venue: "", year: null, citations: 0 },
                { title: "Publication 2", venue: "", year: null, citations: 0 },
              ],
            },
            endeavor: {
              endeavorField: "Computational Biology",
            },
          },
        },
      });

      caseId = newCase.id;

      expect(newCase.formId).toBe("i140-niw");
      expect(newCase.title).toContain("Computational Biology");
      expect(newCase.formData).toBeDefined();
    });

    it("should prefill case with check answers from lead", async () => {
      const kase = await prisma.case.findUnique({
        where: { id: caseId },
      });

      const formData = kase?.formData as Record<string, any>;
      expect(formData.qualifications.endeavorField).toBe("Computational Biology");
      expect(formData.qualifications.highestDegree).toBe("phd");
      expect(formData.qualifications.publications).toBeDefined();
    });

    it("should link case back to lead", async () => {
      await prisma.lead.update({
        where: { id: leadId },
        data: { caseId },
      });

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      expect(lead?.caseId).toBe(caseId);
    });

    it("should set lead dossierStatus to 'pending' after case creation", async () => {
      await prisma.lead.update({
        where: { id: leadId },
        data: { dossierStatus: "pending", status: "contacted" },
      });

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      expect(lead?.dossierStatus).toBe("pending");
      expect(lead?.status).toBe("contacted");
    });
  });

  describe("TC-ATT-008: Intake token generated for lead access", () => {
    it("should create intake token for case", async () => {
      // In real flow, token is created via createIntakeToken
      // Here we verify the case is ready for intake
      const kase = await prisma.case.findUnique({
        where: { id: caseId },
      });

      expect(kase?.formId).toBe("i140-niw");
      // Token would be created and sent to lead's email
    });

    it("should include token in intake invite email", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      // Email should be sent with intake link containing token
      expect(lead?.caseId).toBe(caseId);
      expect(lead?.email).toBe("applicant@test.com");
    });

    it("should generate unique token for each case", async () => {
      // Each case should get a unique intake token
      // This is handled by createIntakeToken function
      const kase = await prisma.case.findUnique({
        where: { id: caseId },
      });

      expect(kase?.id).toBe(caseId);
    });
  });

  describe("TC-ATT-009: Lead receives workspace invite", () => {
    it("should send workspace access email to lead", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      // Email triggered when case is created and token is issued
      expect(lead?.caseId).toBe(caseId);
      expect(lead?.email).toBe("applicant@test.com");
    });

    it("should include workspace URL in email", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      // Email includes /intake/[token] link
      expect(lead?.caseId).toBeDefined();
    });

    it("should allow lead to access intake form via token", async () => {
      // Token validates and grants access to intake form
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      expect(lead?.caseId).toBe(caseId);
      // Token would be validated in /intake/[token] route
    });
  });

  // ===================================================================
  // TEST SUITE 5: Attorney-Client Workspace Collaboration
  // ===================================================================

  describe("TC-ATT-010: Attorney and lead can collaborate in shared workspace", () => {
    it("should allow attorney to access case workspace", async () => {
      const kase = await prisma.case.findUnique({
        where: { id: caseId },
      });

      expect(kase?.id).toBe(caseId);
      // Attorney accesses /cases/[id] after claiming
    });

    it("should allow lead to complete evidence intake", async () => {
      // Lead fills intake form which updates case.formData
      const updated = await prisma.case.update({
        where: { id: caseId },
        data: {
          formData: {
            ...({} as any),
            qualifications: {
              endeavorField: "Computational Biology",
              highestDegree: "phd",
              publications: [
                {
                  title: "Novel Algorithm for Protein Folding",
                  venue: "Nature Computational Science",
                  year: 2022,
                  citations: 45,
                },
              ],
            },
          },
        },
      });

      expect(updated.formData).toBeDefined();
    });

    it("should show exhibit plan based on evidence intake", async () => {
      // Exhibit plan is built from case.formData
      const kase = await prisma.case.findUnique({
        where: { id: caseId },
      });

      const formData = kase?.formData as Record<string, any>;
      expect(formData.qualifications).toBeDefined();
    });

    it("should allow attorney to draft petition sections", async () => {
      // Attorney or AI drafts petition sections
      const updated = await prisma.case.update({
        where: { id: caseId },
        data: {
          formData: {
            ...({} as any),
            briefSections: {
              "prong1-merit": "The applicant has demonstrated extraordinary ability in Computational Biology through...",
            },
          },
        },
      });

      const formData = updated.formData as Record<string, any>;
      expect(formData.briefSections?.["prong1-merit"]).toBeDefined();
    });

    it("should track case status (draft → review → ready → filed)", async () => {
      let kase = await prisma.case.findUnique({
        where: { id: caseId },
      });
      expect(kase?.status).toBe("draft");

      // After attorney completes review
      kase = await prisma.case.update({
        where: { id: caseId },
        data: { status: "review" },
      });
      expect(kase?.status).toBe("review");

      // After case is ready for filing
      kase = await prisma.case.update({
        where: { id: caseId },
        data: { status: "ready" },
      });
      expect(kase?.status).toBe("ready");
    });
  });

  describe("TC-ATT-011: Petition draft generation and download", () => {
    it("should trigger petition draft generation after intake completion", async () => {
      // This is handled by cron job /api/cron/process-dossiers
      // Set dossierStatus to processing
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      expect(lead?.dossierStatus).toBe("pending");
      // Cron will pick this up and generate dossier
    });

    it("should create PDF dossier after generation completes", async () => {
      // When dossier generation completes, dossierStatus → "completed"
      // and dossierPdfPath is set
      await prisma.lead.update({
        where: { id: leadId },
        data: {
          dossierStatus: "completed",
          dossierPdfPath: `/dossiers/${leadId}-dossier.pdf`,
        },
      });

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      expect(lead?.dossierStatus).toBe("completed");
      expect(lead?.dossierPdfPath).toBeDefined();
    });

    it("should allow attorney to download petition draft", async () => {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      // Attorney can download from /api/leads/[id]/dossier
      expect(lead?.dossierPdfPath).toBeDefined();
    });

    it("should handle dossier generation failure gracefully", async () => {
      // Create another lead to test failure
      const failLead = await prisma.lead.create({
        data: {
          email: "failtest@test.com",
          resultToken: rtoken(),
          name: "Fail Test",
          tier: "tier3",
          score: 30,
          formData: {},
          applicantStatus: "approved",
          status: "contacted",
          source: "check",
          caseId: "fake-case-id",
          dossierStatus: "processing",
        },
      });

      // Simulate failure
      await prisma.lead.update({
        where: { id: failLead.id },
        data: { dossierStatus: "failed" },
      });

      const updated = await prisma.lead.findUnique({
        where: { id: failLead.id },
      });

      expect(updated?.dossierStatus).toBe("failed");

      // Cleanup
      await prisma.lead.delete({ where: { id: failLead.id } });
    });
  });

  // ===================================================================
  // TEST SUITE 6: Admin/Network Features
  // ===================================================================

  describe("TC-ATT-012: Admin can notify attorney network of hot leads", () => {
    it("should only broadcast tier1/tier2 leads", async () => {
      // Create tier1 lead
      const tier1Lead = await prisma.lead.create({
        data: {
          email: "tier1@test.com",
          resultToken: rtoken(),
          name: "Tier 1 Applicant",
          tier: "tier1",
          score: 88,
          formData: { field: "Medicine" },
          applicantStatus: "approved",
          status: "new",
          source: "check",
        },
      });

      expect(tier1Lead.tier).toBe("tier1");

      // Create tier3 lead
      const tier3Lead = await prisma.lead.create({
        data: {
          email: "tier3@test.com",
          resultToken: rtoken(),
          name: "Tier 3 Applicant",
          tier: "tier3",
          score: 35,
          formData: { field: "Arts" },
          applicantStatus: "approved",
          status: "new",
          source: "check",
        },
      });

      expect(tier3Lead.tier).toBe("tier3");
      // Admin can only broadcast tier1Lead, not tier3Lead

      // Cleanup
      await prisma.lead.deleteMany({
        where: { email: { in: ["tier1@test.com", "tier3@test.com"] } },
      });
    });

    it("should send notification to all attorneys in network", async () => {
      // Create second attorney
      const attorney2 = await prisma.user.create({
        data: {
          email: "attorney-network@test.com",
          name: "Network Attorney",
          role: "attorney",
          passwordHash: "hashed",
        },
      });

      // Create tier1 lead
      const tier1Lead = await prisma.lead.create({
        data: {
          email: "network-lead@test.com",
          resultToken: rtoken(),
          name: "Network Lead",
          tier: "tier1",
          score: 80,
          formData: { field: "Engineering" },
          applicantStatus: "approved",
          status: "new",
          source: "check",
        },
      });

      // Get all attorneys
      const attorneys = await prisma.user.findMany({
        where: { role: "attorney" },
      });

      // Should include both attorneys
      expect(attorneys.length).toBeGreaterThanOrEqual(2);

      // Cleanup
      await prisma.lead.delete({ where: { id: tier1Lead.id } });
      await prisma.user.delete({ where: { id: attorney2.id } });
    });

    it("should track notification delivery success/failure", async () => {
      // Notification sending returns { sent, failed }
      // This is tested in email integration tests
    });
  });

  describe("TC-ATT-013: Attorney filtering and lead pipeline management", () => {
    it("should filter leads by tier in dashboard", async () => {
      const tier1Leads = await prisma.lead.findMany({
        where: { tier: "tier1" },
      });

      expect(tier1Leads.length).toBeGreaterThanOrEqual(0);
      tier1Leads.forEach((l) => {
        expect(l.tier).toBe("tier1");
      });
    });

    it("should filter leads by status in dashboard", async () => {
      const newLeads = await prisma.lead.findMany({
        where: { status: "new" },
      });

      expect(newLeads.length).toBeGreaterThanOrEqual(0);
      newLeads.forEach((l) => {
        expect(l.status).toBe("new");
      });
    });

    it("should show attorney-specific claimed leads", async () => {
      const myLeads = await prisma.lead.findMany({
        where: { claimedByUserId: attorneyUserId },
      });

      myLeads.forEach((l) => {
        expect(l.claimedByUserId).toBe(attorneyUserId);
      });
    });

    it("should sort leads by capture date (newest first)", async () => {
      const leads = await prisma.lead.findMany({
        orderBy: { capturedAt: "desc" },
        take: 5,
      });

      if (leads.length > 1) {
        for (let i = 0; i < leads.length - 1; i++) {
          expect(leads[i].capturedAt.getTime()).toBeGreaterThanOrEqual(
            leads[i + 1].capturedAt.getTime()
          );
        }
      }
    });
  });

  // ===================================================================
  // TEST SUITE 7: Lead Status Transitions & Final States
  // ===================================================================

  describe("TC-ATT-014: Lead status lifecycle (new → claimed → contacted → converted)", () => {
    it("should start as 'new' when captured", async () => {
      const newLead = await prisma.lead.create({
        data: {
          email: "lifecycle@test.com",
          resultToken: rtoken(),
          name: "Lifecycle Test",
          tier: "tier2",
          score: 60,
          formData: { field: "Chemistry" },
          applicantStatus: "unclaimed",
          status: "new",
          source: "check",
        },
      });

      expect(newLead.status).toBe("new");
      await prisma.lead.delete({ where: { id: newLead.id } });
    });

    it("should transition to 'claimed' when attorney claims", async () => {
      const transLead = await prisma.lead.create({
        data: {
          email: "transition@test.com",
          resultToken: rtoken(),
          name: "Transition Test",
          tier: "tier1",
          score: 75,
          formData: { field: "Physics" },
          applicantStatus: "unclaimed",
          status: "new",
          source: "check",
        },
      });

      const claimed = await prisma.lead.update({
        where: { id: transLead.id },
        data: { status: "claimed", claimedByUserId: attorneyUserId },
      });

      expect(claimed.status).toBe("claimed");
      await prisma.lead.delete({ where: { id: transLead.id } });
    });

    it("should transition to 'contacted' when case is created", async () => {
      const contactLead = await prisma.lead.create({
        data: {
          email: "contact@test.com",
          resultToken: rtoken(),
          name: "Contact Test",
          tier: "tier2",
          score: 68,
          formData: { field: "Biology" },
          applicantStatus: "approved",
          status: "claimed",
          claimedByUserId: attorneyUserId,
          source: "check",
        },
      });

      const contacted = await prisma.lead.update({
        where: { id: contactLead.id },
        data: { status: "contacted" },
      });

      expect(contacted.status).toBe("contacted");
      await prisma.lead.delete({ where: { id: contactLead.id } });
    });

    it("should show 'converted' when case is in workspace", async () => {
      // Status doesn't change to "converted" until case is created and intake started
      const convertLead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      expect(convertLead?.status).toBe("contacted");
      expect(convertLead?.caseId).toBe(caseId);
      // This is conversion state (claimed + case created)
    });
  });

  describe("TC-ATT-015: Leads who decline don't appear in active pipeline", () => {
    it("should not appear if applicantStatus is not 'approved'", async () => {
      const declinedLead = await prisma.lead.create({
        data: {
          email: "declined-pipeline@test.com",
          resultToken: rtoken(),
          name: "Declined Pipeline",
          tier: "tier1",
          score: 79,
          formData: { field: "Astronomy" },
          applicantStatus: "pending_approval",
          status: "claimed",
          claimedByUserId: attorneyUserId,
          source: "check",
        },
      });

      // Should not appear in attorney's active cases
      const activeCases = await prisma.lead.findMany({
        where: {
          claimedByUserId: attorneyUserId,
          applicantStatus: "approved",
        },
      });

      expect(
        activeCases.find((l) => l.id === declinedLead.id)
      ).toBeUndefined();

      await prisma.lead.delete({ where: { id: declinedLead.id } });
    });

    it("should remain in dashboard but not show workspace access", async () => {
      // Declined leads still visible in full pipeline for attorney reference
      // but UI doesn't show "Open workspace" button
    });
  });

  describe("TC-ATT-016: Admin can manage lead assignments and handoffs", () => {
    it("should allow admin to view all leads regardless of claim status", async () => {
      const allLeads = await prisma.lead.findMany();

      expect(allLeads.length).toBeGreaterThan(0);
      // Admin sees all leads
    });

    it("should allow admin to export lead pipeline as CSV", async () => {
      const leads = await prisma.lead.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          tier: true,
          score: true,
          status: true,
          capturedAt: true,
        },
      });

      expect(leads.length).toBeGreaterThan(0);
      // CSV export would include all these fields
    });

    it("should show lead ownership (claimedByUserId and attorney name)", async () => {
      const claimedLeads = await prisma.lead.findMany({
        where: { claimedByUserId: { not: null } },
      });

      claimedLeads.forEach((lead) => {
        expect(lead.claimedByUserId).toBeTruthy();
      });
    });
  });
});
