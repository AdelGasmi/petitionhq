import { describe, it, expect } from "vitest";
import { canAccessCase, canManageCase } from "../lib/auth";
import type { SessionPayload } from "../lib/auth";

const mkSession = (overrides: Partial<SessionPayload>): SessionPayload => ({
  userId: "u1", email: "x@x.com", name: "X", role: "applicant", ...overrides,
});

describe("canAccessCase (content access — zero-trust admin)", () => {
  it("admin CANNOT access case content", () => {
    const s = mkSession({ role: "admin" });
    expect(canAccessCase(s, { id: "c1", ownerId: "other", attorneyId: "other" })).toBe(false);
    expect(canAccessCase(s, { id: "c2" })).toBe(false);
  });

  it("attorney can access own attorney cases only", () => {
    const s = mkSession({ role: "attorney", userId: "atty1" });
    expect(canAccessCase(s, { attorneyId: "atty1" })).toBe(true);
    expect(canAccessCase(s, { attorneyId: "atty2" })).toBe(false);
    expect(canAccessCase(s, { ownerId: "atty1", attorneyId: undefined })).toBe(false);
  });

  it("applicant can access own cases only", () => {
    const s = mkSession({ role: "applicant", userId: "app1" });
    expect(canAccessCase(s, { ownerId: "app1" })).toBe(true);
    expect(canAccessCase(s, { ownerId: "app2" })).toBe(false);
    expect(canAccessCase(s, { ownerId: "app2", attorneyId: "app1" })).toBe(false);
  });

  it("guest session is scoped to one case", () => {
    const s = mkSession({ role: "applicant", guestCaseId: "c-guest" });
    expect(canAccessCase(s, { id: "c-guest" })).toBe(true);
    expect(canAccessCase(s, { id: "c-other" })).toBe(false);
    // Even if owner matches, guest is still scoped by guestCaseId
    expect(canAccessCase(s, { id: "c-other", ownerId: "u1" })).toBe(false);
  });
});

describe("canManageCase (metadata/management — admin allowed)", () => {
  it("admin CAN manage any case", () => {
    const s = mkSession({ role: "admin" });
    expect(canManageCase(s, { id: "c1", ownerId: "other", attorneyId: "other" })).toBe(true);
    expect(canManageCase(s, { id: "c2" })).toBe(true);
  });

  it("attorney can manage own cases only", () => {
    const s = mkSession({ role: "attorney", userId: "atty1" });
    expect(canManageCase(s, { attorneyId: "atty1" })).toBe(true);
    expect(canManageCase(s, { attorneyId: "atty2" })).toBe(false);
  });

  it("applicant can manage own cases only", () => {
    const s = mkSession({ role: "applicant", userId: "app1" });
    expect(canManageCase(s, { ownerId: "app1" })).toBe(true);
    expect(canManageCase(s, { ownerId: "app2" })).toBe(false);
  });

  it("guest session is scoped to one case", () => {
    const s = mkSession({ role: "applicant", guestCaseId: "c-guest" });
    expect(canManageCase(s, { id: "c-guest" })).toBe(true);
    expect(canManageCase(s, { id: "c-other" })).toBe(false);
  });

  it("admin manage + access divergence is the security boundary", () => {
    const admin = mkSession({ role: "admin" });
    const caseObj = { id: "c1", ownerId: "u2", attorneyId: "atty1" };
    // Admin can manage (assign attorneys, payment, status) but NOT read content
    expect(canManageCase(admin, caseObj)).toBe(true);
    expect(canAccessCase(admin, caseObj)).toBe(false);
  });
});
