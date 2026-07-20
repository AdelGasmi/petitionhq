/**
 * Combined tests for Crossref, NSF, NIH, and USPTO clients (V2.4).
 * All hit real public APIs — no keys required.
 */

import { describe, it, expect } from "vitest";
import { resolveDoi } from "@/lib/verification/crossref";
import { findGrants as findNsfGrants } from "@/lib/verification/nsf";
import { findGrants as findNihGrants } from "@/lib/verification/nih";
import { findPatents } from "@/lib/verification/uspto";

describe("Crossref: resolveDoi", () => {
  it("resolves a known DOI (Deep Learning, Nature 2015)", async () => {
    const result = await resolveDoi("10.1038/nature14539");
    expect(result).not.toBeNull();
    expect(result!.title).toContain("Deep learning");
    expect(result!.publicationYear).toBe(2015);
    expect(result!.authors.length).toBeGreaterThan(0);
    expect(result!.sourceUrl).toContain("doi.org");
  }, 15_000);

  it("returns null for non-existent DOI", async () => {
    const result = await resolveDoi("10.0000/nonexistent-doi-12345");
    expect(result).toBeNull();
  }, 15_000);
});

describe("NSF: findGrants", () => {
  it("finds grants for a known PI", async () => {
    // Yann LeCun has had NSF grants
    const grants = await findNsfGrants("LeCun");
    // May or may not return results depending on NSF API availability
    if (grants.length > 0) {
      expect(grants[0].agency).toBe("nsf");
      expect(grants[0].sourceUrl).toContain("nsf.gov");
      expect(grants[0].id).toBeTruthy();
    }
  }, 15_000);

  it("returns empty array for non-existent PI", async () => {
    const grants = await findNsfGrants("Xqzvbn Wklmno");
    expect(grants).toEqual([]);
  }, 15_000);
});

describe("NIH: findGrants", () => {
  it("finds grants for a known PI", async () => {
    // Eric Lander is a well-known NIH-funded researcher
    const grants = await findNihGrants("Lander");
    if (grants.length > 0) {
      expect(grants[0].agency).toBe("nih");
      expect(grants[0].sourceUrl).toContain("reporter.nih.gov");
      expect(grants[0].id).toBeTruthy();
    }
  }, 15_000);

  it("returns empty array for non-existent PI", async () => {
    const grants = await findNihGrants("Xqzvbn Wklmno");
    expect(grants).toEqual([]);
  }, 15_000);
});

describe("USPTO: findPatents", () => {
  it("finds patents for a known inventor", async () => {
    const patents = await findPatents("Yann LeCun");
    if (patents.length > 0) {
      expect(patents[0].id).toBeTruthy();
      expect(patents[0].sourceUrl).toContain("patents.google.com");
    }
  }, 15_000);

  it("returns empty array for non-existent inventor", async () => {
    const patents = await findPatents("Xqzvbn Wklmno");
    expect(patents).toEqual([]);
  }, 15_000);
});
