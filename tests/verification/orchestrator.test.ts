/**
 * Verification orchestrator integration tests.
 *
 * Real DB (local Postgres) + real public APIs.
 * Creates test leads, runs verifyLead(), asserts on trustScore,
 * verifiedClaims, maturity advancement, and event rows.
 *
 * Requires: local Postgres on port 5433 (Docker dev compose).
 */

import { describe, it, expect, afterAll } from "vitest";
import { verifyLead, quickPing } from "@/lib/verification/orchestrator";
import {
  testPrisma,
  createTestLead,
  cleanupTestData,
  disconnectTestDb,
} from "../integration/helpers";

// Track IDs for cleanup
const createdLeadIds: string[] = [];

afterAll(async () => {
  // Events cascade-delete with leads
  if (createdLeadIds.length > 0) {
    await testPrisma.leadVerificationEvent.deleteMany({
      where: { leadId: { in: createdLeadIds } },
    });
    await cleanupTestData({ leadIds: createdLeadIds });
  }
  await disconnectTestDb();
});

describe("verifyLead", () => {
  // ─── Happy path: rich profile ──────────────────────────────────────

  it("scores a well-known researcher with high trust", async () => {
    const lead = await createTestLead({
      name: "Yann LeCun",
      formData: {
        name: "Yann LeCun",
        institution: "NYU",
        field: "deep learning",
        publications: 400,
      },
    });
    createdLeadIds.push(lead.id);

    const result = await verifyLead(lead.id, { reason: "manual" });

    // Should get a decent score from OpenAlex + possibly ORCID/ROR
    expect(result.trustScore).toBeGreaterThanOrEqual(20);
    expect(result.verifiedClaims).toBeDefined();
    expect(result.scoringBreakdown.length).toBeGreaterThan(0);

    // researcher_profile should be verified via OpenAlex
    expect(result.verifiedClaims.researcher_profile).toBeDefined();
    expect(result.verifiedClaims.researcher_profile.status).toBe("verified");
    expect(result.verifiedClaims.researcher_profile.source).toBe("openalex");

    // Events should have been written
    expect(result.eventCount).toBeGreaterThan(0);

    // Maturity should have advanced (M0 → verified state)
    expect(result.newMaturity).toBeDefined();

    // Verify the lead was actually updated in DB
    const updated = await testPrisma.lead.findUnique({ where: { id: lead.id } });
    expect(updated!.trustScore).toBe(result.trustScore);
    expect(updated!.lastVerifiedAt).not.toBeNull();
  }, 60_000);

  // ─── Happy path: medium profile ────────────────────────────────────

  it("scores a researcher with name + institution only", async () => {
    const lead = await createTestLead({
      name: "George Church",
      formData: {
        name: "George Church",
        institution: "Harvard",
      },
    });
    createdLeadIds.push(lead.id);

    const result = await verifyLead(lead.id, { reason: "intake_complete" });

    // Should find something — Church is a well-known Harvard geneticist
    expect(result.trustScore).toBeGreaterThanOrEqual(0);
    expect(result.verifiedClaims).toBeDefined();
    expect(result.eventCount).toBeGreaterThan(0);

    // Institution should be verified via ROR (Harvard is in ROR)
    if (result.verifiedClaims.institution) {
      expect(result.verifiedClaims.institution.source).toBe("ror");
    }
  }, 60_000);

  // ─── Happy path: sparse profile ────────────────────────────────────

  it("handles a lead with minimal data gracefully", async () => {
    const lead = await createTestLead({
      name: "Jane Doe",
      formData: {
        name: "Jane Doe",
        // No institution, no field, no claimed pubs
      },
    });
    createdLeadIds.push(lead.id);

    const result = await verifyLead(lead.id, { reason: "manual" });

    // Sparse data — score could be anything but should not crash
    expect(result.trustScore).toBeGreaterThanOrEqual(0);
    expect(result.trustScore).toBeLessThanOrEqual(100);
    expect(result.verifiedClaims).toBeDefined();
    expect(result.scoringBreakdown).toBeInstanceOf(Array);
  }, 60_000);

  // ─── Contradiction case ────────────────────────────────────────────

  it("penalises when claimed publications vastly exceed verified count", async () => {
    const lead = await createTestLead({
      name: "Test Contradiction",
      formData: {
        name: "Jennifer Doudna",
        institution: "UC Berkeley",
        publications: 50000, // absurdly high claim
      },
    });
    createdLeadIds.push(lead.id);

    const result = await verifyLead(lead.id, { reason: "manual" });

    // If OpenAlex found her, the contradiction penalty should fire
    if (result.verifiedClaims.researcher_profile?.status === "verified") {
      const contradictionRule = result.scoringBreakdown.find(
        (b) => b.rule === "publication_count_contradiction",
      );
      // Contradiction should be detected (50000 claimed vs ~500 real)
      expect(contradictionRule).toBeDefined();
      expect(contradictionRule!.points).toBe(-30);
    }
  }, 60_000);

  // ─── All-null case ─────────────────────────────────────────────────

  it("scores very low for a completely fake researcher", async () => {
    const lead = await createTestLead({
      name: "Xqz Vbn Wkl",
      formData: {
        name: "Xqz Vbn Wkl",
        institution: "Zqxwvb Tplmkj Rrsndc",
        field: "xqzflpwm",
        publications: 0,
      },
    });
    createdLeadIds.push(lead.id);

    const result = await verifyLead(lead.id, { reason: "manual" });

    // No meaningful sources should match — trust score near 0
    // (ROR fuzzy matching might give a weak hit, so allow up to 5)
    expect(result.trustScore).toBeLessThanOrEqual(5);

    // researcher_profile should be not_found
    expect(result.verifiedClaims.researcher_profile).toBeDefined();
    expect(result.verifiedClaims.researcher_profile.status).toBe("not_found");

    // Events should still be written (not_found events)
    expect(result.eventCount).toBeGreaterThan(0);
  }, 60_000);

  // ─── Skip sources ─────────────────────────────────────────────────

  it("respects the skip option to exclude sources", async () => {
    const lead = await createTestLead({
      name: "Skip Test",
      formData: {
        name: "Andrew Ng",
        institution: "Stanford",
      },
    });
    createdLeadIds.push(lead.id);

    const result = await verifyLead(lead.id, {
      reason: "manual",
      skip: ["orcid", "nsf", "nih", "uspto"],
    });

    // Should still have OpenAlex and ROR results
    expect(result.verifiedClaims).toBeDefined();
    // Should NOT have ORCID claim
    expect(result.verifiedClaims.orcid).toBeUndefined();
    // Should NOT have NSF/NIH/USPTO claims
    expect(result.verifiedClaims.nsf_grants).toBeUndefined();
    expect(result.verifiedClaims.nih_grants).toBeUndefined();
    expect(result.verifiedClaims.patents).toBeUndefined();
  }, 60_000);

  // ─── Idempotency ───────────────────────────────────────────────────

  it("produces the same verifiedClaims on re-run", async () => {
    const lead = await createTestLead({
      name: "Idempotency Test",
      formData: {
        name: "Fei-Fei Li",
        institution: "Stanford",
      },
    });
    createdLeadIds.push(lead.id);

    const first = await verifyLead(lead.id, { reason: "manual" });
    // Brief pause — S2 enforces 1 req/sec; without it the key set can
    // toggle between runs, causing a false-negative failure.
    await new Promise((r) => setTimeout(r, 1500));
    const second = await verifyLead(lead.id, { reason: "reverify" });

    // Trust scores should be the same (same data, same rules)
    expect(second.trustScore).toBe(first.trustScore);

    // Same stable claim keys should be present. Exclude semantic_scholar:
    // S2's 1 req/sec limit can still drop it on the second call even with the
    // sleep above, and that's not an idempotency failure — it's a rate-limit
    // transient. All other sources are stable enough to assert equality.
    const stable = (keys: string[]) =>
      keys.filter((k) => k !== "semantic_scholar").sort();
    expect(stable(Object.keys(second.verifiedClaims))).toEqual(
      stable(Object.keys(first.verifiedClaims)),
    );
  }, 90_000);
});

describe("quickPing", () => {
  it("returns preliminary data for a known researcher", async () => {
    const lead = await createTestLead({
      name: "Quick Ping Test",
      formData: {
        name: "Demis Hassabis",
        institution: "DeepMind",
      },
    });
    createdLeadIds.push(lead.id);

    const result = await quickPing(lead.id);

    // Hassabis should be found in OpenAlex
    if (result.found) {
      expect(result.matchConfidence).toBeGreaterThan(0);
      expect(result.worksCount).toBeGreaterThan(0);
    }
    // null is acceptable if API is slow/down
  }, 30_000);

  it("returns found:false for fake researcher", async () => {
    const lead = await createTestLead({
      name: "Quick Ping Fake",
      formData: {
        name: "Zzzzxxx Qqqqyyy",
      },
    });
    createdLeadIds.push(lead.id);

    const result = await quickPing(lead.id);

    expect(result.found).toBe(false);
    expect(result.matchConfidence).toBeUndefined();
    expect(result.worksCount).toBeUndefined();
  }, 30_000);
});
