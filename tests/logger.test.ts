import { describe, it, expect } from "vitest";
import { scrub } from "../lib/logger";

describe("logger.scrub", () => {
  // ─── Field-based redaction ──────────────────────────────────────
  it("redacts email fields preserving domain", () => {
    const result = scrub({ email: "alice@example.com" });
    expect(result.email).toBe("***@example.com");
  });

  it("redacts phone fields preserving last 4 digits", () => {
    const result = scrub({ phone: "+1-555-867-5309" });
    expect(result.phone).toBe("***5309");
  });

  it("redacts name fields to first initial", () => {
    const result = scrub({ name: "Alice Johnson" });
    expect(result.name).toBe("A***");
  });

  it("redacts SSN / passport / A-number fields completely", () => {
    const result = scrub({
      ssn: "123-45-6789",
      passportNumber: "AB1234567",
      aNumber: "A-098-765-432",
    });
    expect(result.ssn).toBe("***");
    expect(result.passportNumber).toBe("***");
    expect(result.aNumber).toBe("***");
  });

  it("handles nested objects", () => {
    const result = scrub({
      user: { email: "bob@test.com", name: "Bob" },
      meta: { count: 5 },
    });
    expect(result.user.email).toBe("***@test.com");
    expect(result.user.name).toBe("B***");
    expect(result.meta.count).toBe(5);
  });

  it("handles arrays", () => {
    const result = scrub([{ email: "a@b.com" }, { email: "c@d.com" }]);
    expect(result[0].email).toBe("***@b.com");
    expect(result[1].email).toBe("***@d.com");
  });

  it("handles circular references", () => {
    const obj: Record<string, unknown> = { x: 1 };
    obj.self = obj;
    const result = scrub(obj);
    expect(result.x).toBe(1);
    expect(result.self).toBe("[Circular]");
  });

  it("passes through primitives", () => {
    expect(scrub(42)).toBe(42);
    expect(scrub(true)).toBe(true);
    expect(scrub(null)).toBe(null);
    expect(scrub(undefined)).toBe(undefined);
  });

  it("scrubs Error messages", () => {
    const err = new Error("Failed for user alice@example.com");
    const result = scrub(err);
    expect(result.message).toBe("Failed for user ***@example.com");
    expect(result).toBeInstanceOf(Error);
  });

  // ─── Inline string redaction ────────────────────────────────────
  it("redacts emails in free text", () => {
    const result = scrub("Contact alice@example.com for info");
    expect(result).toBe("Contact ***@example.com for info");
  });

  it("redacts SSN patterns in strings", () => {
    const result = scrub("SSN is 123-45-6789 on file");
    expect(result).toBe("SSN is ***-**-**** on file");
  });

  it("redacts US phone patterns in strings", () => {
    const result = scrub("Call (555) 867-5309 now");
    expect(result).toContain("***5309");
  });

  // ─── Case sensitivity ──────────────────────────────────────────
  it("redacts regardless of field name case", () => {
    const result = scrub({ Email: "test@test.com", NAME: "Charlie" });
    expect(result.Email).toBe("***@test.com");
    expect(result.NAME).toBe("C***");
  });

  // ─── Non-sensitive fields pass through ──────────────────────────
  it("does not redact non-sensitive fields", () => {
    const result = scrub({ tier: "tier1", score: 85, field: "ML" });
    expect(result).toEqual({ tier: "tier1", score: 85, field: "ML" });
  });

  it("handles Date objects", () => {
    const d = new Date("2026-01-01");
    const result = scrub({ createdAt: d });
    expect(result.createdAt).toBe(d);
  });
});
