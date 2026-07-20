import { describe, it, expect } from "vitest";
import { isAtomKindVerified } from "@/lib/claimBadge";

describe("isAtomKindVerified (Fork-C display badge)", () => {
  it("publication ⇒ true when any mapped source is verified", () => {
    expect(
      isAtomKindVerified("publication", {
        semantic_scholar: { status: "verified" },
      }),
    ).toBe(true);
  });

  it("grant ⇒ true when nsf_grants is verified", () => {
    expect(
      isAtomKindVerified("grant", { nsf_grants: { status: "verified" } }),
    ).toBe(true);
  });

  it("patent ⇒ true when patents is verified", () => {
    expect(
      isAtomKindVerified("patent", { patents: { status: "verified" } }),
    ).toBe(true);
  });

  it("role ⇒ true when peerReview is verified", () => {
    expect(
      isAtomKindVerified("role", { peerReview: { status: "verified" } }),
    ).toBe(true);
  });

  it("media ⇒ always false (no source maps to it), even with verified claims", () => {
    expect(
      isAtomKindVerified("media", {
        publications: { status: "verified" },
        semantic_scholar: { status: "verified" },
      }),
    ).toBe(false);
  });

  it("project ⇒ always false (self-reported)", () => {
    expect(
      isAtomKindVerified("project", { awards: { status: "verified" } }),
    ).toBe(false);
  });

  it("null verifiedClaims ⇒ false", () => {
    expect(isAtomKindVerified("publication", null)).toBe(false);
  });

  it("undefined verifiedClaims ⇒ false", () => {
    expect(isAtomKindVerified("publication", undefined)).toBe(false);
  });

  it("mapped key present but status not 'verified' ⇒ false", () => {
    expect(
      isAtomKindVerified("publication", {
        semantic_scholar: { status: "pending" },
        researcher_profile: { status: "failed" },
      }),
    ).toBe(false);
  });

  it("does not cross kinds: grant's verified source does not verify a publication", () => {
    expect(
      isAtomKindVerified("publication", { nsf_grants: { status: "verified" } }),
    ).toBe(false);
  });

  it("award ⇒ true when awards is verified", () => {
    expect(
      isAtomKindVerified("award", { awards: { status: "verified" } }),
    ).toBe(true);
  });

  it("talk ⇒ true when invitedTalks is verified", () => {
    expect(
      isAtomKindVerified("talk", { invitedTalks: { status: "verified" } }),
    ).toBe(true);
  });
});
