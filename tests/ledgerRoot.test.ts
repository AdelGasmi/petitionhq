import { describe, it, expect } from "vitest";
import { computeLedgerRoot } from "@/lib/claimLedger";

// sha256("") — NIST known-answer; the root of an empty approve set.
const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("computeLedgerRoot", () => {
  it("is order-independent (approve set, not list)", () => {
    expect(computeLedgerRoot(["sha256:bbbb", "sha256:aaaa"])).toBe(
      computeLedgerRoot(["sha256:aaaa", "sha256:bbbb"]),
    );
  });

  it("is deterministic across calls", () => {
    const set = ["sha256:1111", "sha256:2222", "sha256:3333"];
    expect(computeLedgerRoot(set)).toBe(computeLedgerRoot(set));
  });

  it("empty approve set ⇒ sha256 of the empty string", () => {
    expect(computeLedgerRoot([])).toBe(EMPTY_SHA256);
  });

  it("distinct sets ⇒ distinct roots", () => {
    expect(computeLedgerRoot(["sha256:aaaa"])).not.toBe(
      computeLedgerRoot(["sha256:bbbb"]),
    );
  });

  it("a strict superset yields a different root than its subset", () => {
    expect(computeLedgerRoot(["sha256:aaaa"])).not.toBe(
      computeLedgerRoot(["sha256:aaaa", "sha256:bbbb"]),
    );
  });

  it("returns a 64-char lowercase hex digest", () => {
    expect(computeLedgerRoot(["sha256:aaaa", "sha256:bbbb"])).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });

  it("does not mutate the caller's array", () => {
    const input = ["sha256:cccc", "sha256:aaaa", "sha256:bbbb"];
    const snapshot = [...input];
    computeLedgerRoot(input);
    expect(input).toEqual(snapshot);
  });
});
