import { describe, it, expect } from "vitest";
import { extractEvidence, filterFormDataByLedger } from "@/lib/drafting";
import type { ClaimLedger } from "@/lib/claimLedger";

/**
 * GAP-1 regression — the production leak this function exists to close.
 *
 * In prod, a curated dossier whose NARRATIVE correctly cited only the approved
 * Nature paper still printed "Citation record — 199 total citations" and
 * "Publications (2)" on the exhibit table / profile summary, because those read
 * the RAW `qualifications` arrays rather than the atom-filtered stream. The
 * excluded Cell paper (57 cites) leaked back into every aggregate. 142 + 57 =
 * 199 was the smoking gun. filterFormDataByLedger projects formData down to the
 * approved set so NO downstream consumer of formData can re-admit it.
 */

const NATURE_PUB = {
  title: "Genomic foundation models for variant effect prediction",
  venue: "Nature",
  year: 2024,
  citations: 142,
};
const CELL_PUB = {
  title: "E2E Transformer Models in Genomics",
  venue: "Cell",
  year: 2023,
  citations: 57,
};

function baseFormData(): Record<string, unknown> {
  return {
    petitionerInfo: { givenName: "E2E", familyName: "Researcher" },
    endeavor: { endeavorField: "Computational Genomics" },
    qualifications: {
      highestDegree: "phd",
      degreeInstitution: "Stanford University",
      publications: [NATURE_PUB, CELL_PUB],
      awards: [{ name: "Career Achievement Award", year: 2023 }],
      grants: [{ title: "NIH R01 — variant calling", agency: "NIH", year: 2022 }],
      patents: [{ title: "Method for variant calling at scale", year: 2021 }],
    },
  };
}

function citationTotal(fd: Record<string, unknown>): number {
  const q = (fd.qualifications ?? {}) as Record<string, unknown>;
  const pubs = Array.isArray(q.publications)
    ? (q.publications as Array<{ citations?: number }>)
    : [];
  return pubs.reduce((s, p) => s + (typeof p.citations === "number" ? p.citations : 0), 0);
}

/** Approve every live atom EXCEPT the Cell paper (the prod-excluded claim). */
function ledgerExcludingCell(fd: Record<string, unknown>): {
  ledger: ClaimLedger;
  cellId: string;
} {
  const all = extractEvidence(fd);
  const cellId = all.find((a) => a.summary === CELL_PUB.title)!.id;
  const approved = all.map((a) => a.id).filter((id) => id !== cellId);
  return { ledger: { approved, excluded: [cellId] }, cellId };
}

describe("filterFormDataByLedger — GAP-1 exhibit/profile leak fix", () => {
  it("drops the excluded publication; citation total is 142, not 199", () => {
    const fd = baseFormData();
    const { ledger } = ledgerExcludingCell(fd);

    const curated = filterFormDataByLedger(fd, ledger);
    const cq = curated.qualifications as Record<string, unknown>;
    const pubs = cq.publications as Array<{ title: string }>;

    expect(pubs).toHaveLength(1);
    expect(pubs[0].title).toBe(NATURE_PUB.title);
    // THE regression: the 57-cite Cell paper must not survive into aggregates.
    expect(citationTotal(curated)).toBe(142);
  });

  it("keeps the approved award, grant, and patent untouched", () => {
    const fd = baseFormData();
    const { ledger } = ledgerExcludingCell(fd);

    const cq = filterFormDataByLedger(fd, ledger).qualifications as Record<string, unknown>;
    expect((cq.awards as unknown[])).toHaveLength(1);
    expect((cq.grants as unknown[])).toHaveLength(1);
    expect((cq.patents as unknown[])).toHaveLength(1);
  });

  it("passes non-governed fields through untouched (identity for scalars)", () => {
    const fd = baseFormData();
    const { ledger } = ledgerExcludingCell(fd);

    const curated = filterFormDataByLedger(fd, ledger);
    const cq = curated.qualifications as Record<string, unknown>;
    // petitionerInfo / endeavor are not ledger-governed → same reference.
    expect(curated.petitionerInfo).toBe(fd.petitionerInfo);
    expect(curated.endeavor).toBe(fd.endeavor);
    // scalar quals (degree etc.) carry over.
    expect(cq.highestDegree).toBe("phd");
    expect(cq.degreeInstitution).toBe("Stanford University");
  });

  it("null ledger ⇒ formData returned unchanged (un-curated default)", () => {
    const fd = baseFormData();
    expect(filterFormDataByLedger(fd, null)).toBe(fd);
    expect(filterFormDataByLedger(fd, undefined)).toBe(fd);
  });

  it("a ledger lacking an approved array ⇒ unchanged (mirrors applyClaimLedger)", () => {
    const fd = baseFormData();
    // Malformed: no approved[]. Must NOT be treated as "approve nothing".
    expect(filterFormDataByLedger(fd, {} as unknown as ClaimLedger)).toBe(fd);
  });

  it("present ledger with approved: [] ⇒ every governed array emptied (placebo guard)", () => {
    const fd = baseFormData();
    const all = extractEvidence(fd);
    const ledger: ClaimLedger = { approved: [], excluded: all.map((a) => a.id) };

    const cq = filterFormDataByLedger(fd, ledger).qualifications as Record<string, unknown>;
    expect(cq.publications).toEqual([]);
    expect(cq.awards).toEqual([]);
    expect(cq.grants).toEqual([]);
    expect(cq.patents).toEqual([]);
    // scalars still survive — only the atom-bearing arrays are projected.
    expect(cq.highestDegree).toBe("phd");
  });

  it("does not mutate the caller's formData", () => {
    const fd = baseFormData();
    const { ledger } = ledgerExcludingCell(fd);
    const before = JSON.stringify(fd);

    filterFormDataByLedger(fd, ledger);
    expect(JSON.stringify(fd)).toBe(before);
    // original still has BOTH publications.
    expect(((fd.qualifications as Record<string, unknown>).publications as unknown[])).toHaveLength(2);
  });

  it("is idempotent — re-curating an already-curated set is a no-op", () => {
    const fd = baseFormData();
    const { ledger } = ledgerExcludingCell(fd);

    const once = filterFormDataByLedger(fd, ledger);
    const twice = filterFormDataByLedger(once, ledger);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });
});
