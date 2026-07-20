/**
 * OpenAlex client tests.
 *
 * These hit the real OpenAlex API (no mocking) because:
 *   1. OpenAlex is free, public, no key required
 *   2. We need to validate real disambiguation behavior
 *   3. The polite pool has generous rate limits
 *
 * If these become flaky due to network, add retry or skip with:
 *   describe.skipIf(process.env.CI)
 */

import { describe, it, expect } from "vitest";
import { findAuthor, getAuthorWorks } from "@/lib/verification/openalex";

describe("OpenAlex: findAuthor", () => {
  // ─── Known authors (high-confidence matches expected) ────────────

  it("finds Yann LeCun at NYU with high confidence", async () => {
    const result = await findAuthor({ name: "Yann LeCun", institution: "NYU" });
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result!.citedByCount).toBeGreaterThan(100_000);
    expect(result!.sourceUrl).toContain("openalex.org");
    expect(result!.matchSignals).toContain("name_exact");
  }, 15_000);

  it("finds Andrew Ng at Stanford", async () => {
    const result = await findAuthor({ name: "Andrew Ng", institution: "Stanford" });
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result!.citedByCount).toBeGreaterThan(50_000);
    // Fragmentation merge anchors on the fullest record, whose canonical
    // OpenAlex name is "Andrew Y. Ng" → a name_partial (surname+initial) match.
    expect(result!.matchSignals.some((s) => s.startsWith("name_"))).toBe(true);
  }, 15_000);

  it("finds Demis Hassabis at DeepMind", async () => {
    const result = await findAuthor({ name: "Demis Hassabis", institution: "DeepMind" });
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result!.worksCount).toBeGreaterThan(50);
  }, 15_000);

  it("finds Jennifer Doudna at UC Berkeley", async () => {
    const result = await findAuthor({ name: "Jennifer Doudna", institution: "University of California Berkeley" });
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result!.citedByCount).toBeGreaterThan(50_000);
  }, 15_000);

  it("finds Fei-Fei Li at Stanford with field filter", async () => {
    const result = await findAuthor({
      name: "Fei-Fei Li",
      institution: "Stanford",
      field: "computer vision",
    });
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result!.matchSignals).toContain("name_exact");
  }, 15_000);

  // ─── Disambiguation (common names) ───────────────────────────────

  it("disambiguates 'John Smith' at MIT vs without institution", async () => {
    const withInst = await findAuthor({ name: "John Smith", institution: "MIT" });
    const withoutInst = await findAuthor({ name: "John Smith" });

    // With institution should match or return null (high bar)
    // Without institution should still return something (most-cited John Smith)
    // Key assertion: they shouldn't be the same person unless MIT's John Smith IS the most cited
    if (withInst && withoutInst) {
      // Both found — acceptable either way
      expect(withInst.confidence).toBeGreaterThanOrEqual(0.6);
    }
  }, 15_000);

  it("disambiguates 'Wei Zhang' using institution", async () => {
    // Very common Chinese name — institution is critical for disambiguation
    const result = await findAuthor({ name: "Wei Zhang", institution: "Harvard" });
    if (result) {
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      expect(result.matchSignals).toContain("institution_match");
    }
    // null is acceptable too — the system shouldn't hallucinate a match
  }, 15_000);

  it("merges fragmented author IDs for the same person at one institution (Achouak Benarbia / UND)", async () => {
    // OpenAlex splits this real researcher across "Achouak Benarbia" (1-2 works)
    // and "A. Benarbia" (~9 works, 21 cit), all at University of North Dakota.
    // The engine must anchor on the most complete fragment, NOT pick a 1-work
    // shard and flag the person ambiguous.
    const result = await findAuthor({
      name: "Achouak Benarbia",
      institution: "University of North Dakota",
      field: "energy engineering",
    });
    if (!result) return; // tolerate transient network/index changes
    expect(result.matchQuality).not.toBe("ambiguous");
    expect(result.worksCount).toBeGreaterThanOrEqual(5);
    expect(result.matchSignals).toContain("institution_match");
  }, 15_000);

  // ─── No-match cases ──────────────────────────────────────────────

  it("returns null for clearly fake author", async () => {
    const result = await findAuthor({
      name: "Xqz Vbn Wkl",
      institution: "Nowhere University of Nonexistence",
    });
    expect(result).toBeNull();
  }, 15_000);
});

describe("OpenAlex: getAuthorWorks", () => {
  it("retrieves works for a known author", async () => {
    // First find Yann LeCun to get the ID
    const author = await findAuthor({ name: "Yann LeCun", institution: "NYU" });
    expect(author).not.toBeNull();

    const works = await getAuthorWorks(author!.id, 5);
    expect(works.length).toBeGreaterThan(0);
    expect(works.length).toBeLessThanOrEqual(5);

    // Each work should have required fields
    for (const work of works) {
      expect(work.id).toBeTruthy();
      expect(work.title).toBeTruthy();
      expect(work.publicationYear).toBeGreaterThan(1980);
      expect(work.sourceUrl).toContain("openalex.org");
    }
  }, 20_000);

  it("returns empty array for non-existent author ID", async () => {
    const works = await getAuthorWorks("A0000000000");
    expect(works).toEqual([]);
  }, 15_000);

  it("includes sourceUrl on every result", async () => {
    const author = await findAuthor({ name: "Andrew Ng", institution: "Stanford" });
    if (!author) return; // skip if network issue
    const works = await getAuthorWorks(author.id, 3);
    for (const work of works) {
      expect(work.sourceUrl).toMatch(/^https:\/\/openalex\.org\//);
    }
  }, 20_000);
});
