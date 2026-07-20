import { describe, it, expect } from "vitest";
import { checkSvCache, setSvCache, type SvCache } from "@/lib/sessionRevocation";

describe("TRU-6: session revocation cache (fail-closed helpers)", () => {
  it("cache miss returns null", () => {
    const cache: SvCache = new Map();
    expect(checkSvCache("u1", 3, cache)).toBeNull();
  });

  it("cache hit within TTL: jwtSv < storedV → revoked", () => {
    const cache: SvCache = new Map();
    const now = Date.now();
    setSvCache("u1", 5, cache, now);
    expect(checkSvCache("u1", 3, cache, now + 1_000)).toBe(true);
  });

  it("cache hit within TTL: jwtSv >= storedV → not revoked", () => {
    const cache: SvCache = new Map();
    const now = Date.now();
    setSvCache("u1", 5, cache, now);
    expect(checkSvCache("u1", 5, cache, now + 1_000)).toBe(false);
    expect(checkSvCache("u1", 6, cache, now + 1_000)).toBe(false);
  });

  it("cache miss after TTL expiry (30s)", () => {
    const cache: SvCache = new Map();
    const now = Date.now();
    setSvCache("u1", 5, cache, now);
    // 31 seconds later — cache should be stale
    expect(checkSvCache("u1", 3, cache, now + 31_000)).toBeNull();
  });

  it("different userIds are independent", () => {
    const cache: SvCache = new Map();
    const now = Date.now();
    setSvCache("u1", 5, cache, now);
    setSvCache("u2", 2, cache, now);
    expect(checkSvCache("u1", 4, cache, now)).toBe(true);  // 4 < 5 → revoked
    expect(checkSvCache("u2", 4, cache, now)).toBe(false); // 4 >= 2 → valid
    expect(checkSvCache("u3", 1, cache, now)).toBeNull();  // u3 never set
  });

  /**
   * TRU-6 acceptance criterion: the FAIL-CLOSED behavior is implemented in
   * middleware.ts isSessionRevoked() catch block (return true). The helpers
   * here support the cache layer; the fail-closed contract is documented in
   * lib/sessionRevocation.ts and enforced in the middleware catch block.
   */
  it("setSvCache overwrites a stale entry", () => {
    const cache: SvCache = new Map();
    const t0 = Date.now();
    setSvCache("u1", 5, cache, t0);
    // Fresh write (would happen after Redis recovers)
    setSvCache("u1", 7, cache, t0 + 60_000);
    expect(checkSvCache("u1", 5, cache, t0 + 60_001)).toBe(true);  // 5 < 7 → revoked
    expect(checkSvCache("u1", 7, cache, t0 + 60_001)).toBe(false); // 7 >= 7 → valid
  });
});
