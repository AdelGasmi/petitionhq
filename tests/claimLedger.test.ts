import { describe, it, expect } from "vitest";
import {
  applyClaimLedger,
  asClaimLedger,
  type ClaimLedger,
} from "@/lib/claimLedger";
import type { EvidenceAtom } from "@/lib/drafting";

const atom = (id: string): EvidenceAtom => ({
  id,
  kind: "publication",
  summary: `summary-${id}`,
});

const atoms: EvidenceAtom[] = [
  atom("sha256:aaaa0000aaaa0000"),
  atom("sha256:bbbb1111bbbb1111"),
  atom("sha256:cccc2222cccc2222"),
];

const ids = (xs: EvidenceAtom[]) => xs.map((a) => a.id);

describe("applyClaimLedger", () => {
  it("null ledger ⇒ all atoms (un-curated default)", () => {
    expect(ids(applyClaimLedger(atoms, null))).toEqual(ids(atoms));
  });

  it("undefined ledger ⇒ all atoms", () => {
    expect(ids(applyClaimLedger(atoms, undefined))).toEqual(ids(atoms));
  });

  it("keeps only approved atom IDs", () => {
    const ledger: ClaimLedger = {
      approved: [atoms[0].id, atoms[2].id],
      excluded: [atoms[1].id],
    };
    expect(ids(applyClaimLedger(atoms, ledger))).toEqual([
      atoms[0].id,
      atoms[2].id,
    ]);
  });

  // THE regression: a present ledger with an empty approve-set MUST yield zero
  // atoms. If this ever returns all atoms, the gate has become a placebo.
  it("exclude-all (approved: []) ⇒ zero atoms", () => {
    const ledger: ClaimLedger = { approved: [], excluded: ids(atoms) };
    expect(applyClaimLedger(atoms, ledger)).toEqual([]);
  });

  it("ignores approved IDs that match no atom", () => {
    const ledger: ClaimLedger = {
      approved: ["sha256:ffffffffffffffff", atoms[1].id],
      excluded: [],
    };
    expect(ids(applyClaimLedger(atoms, ledger))).toEqual([atoms[1].id]);
  });

  it("approving every atom ⇒ all atoms (order preserved)", () => {
    const ledger: ClaimLedger = { approved: ids(atoms), excluded: [] };
    expect(ids(applyClaimLedger(atoms, ledger))).toEqual(ids(atoms));
  });
});

describe("asClaimLedger", () => {
  it("returns null for null / undefined / non-object", () => {
    expect(asClaimLedger(null)).toBeNull();
    expect(asClaimLedger(undefined)).toBeNull();
    expect(asClaimLedger(42)).toBeNull();
    expect(asClaimLedger("x")).toBeNull();
  });

  it("returns null when approved is not an array", () => {
    expect(asClaimLedger({ excluded: [] })).toBeNull();
    expect(asClaimLedger({ approved: "nope" })).toBeNull();
  });

  it("narrows a valid ledger and defaults excluded to []", () => {
    const out = asClaimLedger({ approved: ["a", "b"] });
    expect(out).toEqual({
      approved: ["a", "b"],
      excluded: [],
      attestedBy: undefined,
      attestedAt: undefined,
      ledgerRoot: undefined,
    });
  });

  it("filters non-string entries out of approved/excluded", () => {
    const out = asClaimLedger({ approved: ["a", 1, null, "b"], excluded: [2, "c"] });
    expect(out?.approved).toEqual(["a", "b"]);
    expect(out?.excluded).toEqual(["c"]);
  });

  it("preserves attestation fields when present", () => {
    const out = asClaimLedger({
      approved: ["a"],
      excluded: [],
      attestedBy: "user_123",
      attestedAt: "2026-05-29T00:00:00.000Z",
      ledgerRoot: "deadbeef",
    });
    expect(out?.attestedBy).toBe("user_123");
    expect(out?.attestedAt).toBe("2026-05-29T00:00:00.000Z");
    expect(out?.ledgerRoot).toBe("deadbeef");
  });

  // Round-trip: a malformed stored ledger ⇒ null ⇒ applyClaimLedger lets all
  // atoms through (fail-open is correct ONLY for absent/garbage ledgers).
  it("malformed ledger round-trips to all-atoms via applyClaimLedger", () => {
    const ledger = asClaimLedger({ junk: true });
    expect(ids(applyClaimLedger(atoms, ledger))).toEqual(ids(atoms));
  });
});
