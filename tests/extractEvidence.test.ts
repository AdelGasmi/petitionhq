import { describe, it, expect } from "vitest";
import { extractEvidence, makeAtom } from "@/lib/drafting";

const pub = (title: string, year: number, citations: number) => ({
  title,
  venue: "Nature",
  year,
  citations,
});

describe("extractEvidence — content-hash atom IDs", () => {
  it("derives every id from a sha256 content hash", () => {
    const atoms = extractEvidence({
      qualifications: {
        publications: [pub("Deep learning for protein folding", 2021, 412)],
        awards: [{ name: "Sloan Fellowship", year: 2022 }],
        grants: [{ title: "NSF CAREER", agency: "NSF", year: 2023 }],
      },
    });
    expect(atoms.length).toBe(3);
    for (const a of atoms) {
      expect(a.id).toMatch(/^sha256:[0-9a-f]{16}$/);
    }
  });

  it("produces the same id regardless of array position (reorder-invariant)", () => {
    // This is the whole point of the change: an attorney's approval of a claim
    // must survive the applicant reordering or inserting entries during intake.
    const A = pub("Paper A", 2020, 10);
    const B = pub("Paper B", 2021, 20);

    const order1 = extractEvidence({ qualifications: { publications: [A, B] } });
    const order2 = extractEvidence({ qualifications: { publications: [B, A] } });

    const idOf = (atoms: ReturnType<typeof extractEvidence>, title: string) =>
      atoms.find((a) => a.summary === title)!.id;

    expect(idOf(order1, "Paper A")).toBe(idOf(order2, "Paper A"));
    expect(idOf(order1, "Paper B")).toBe(idOf(order2, "Paper B"));
  });

  it("inserting a new entry does not change other atoms' ids", () => {
    const A = pub("Paper A", 2020, 10);
    const B = pub("Paper B", 2021, 20);
    const C = pub("Paper C", 2022, 30);

    const before = extractEvidence({ qualifications: { publications: [A, B] } });
    const after = extractEvidence({
      qualifications: { publications: [C, A, B] },
    });

    const idA = before.find((a) => a.summary === "Paper A")!.id;
    const idAfter = after.find((a) => a.summary === "Paper A")!.id;
    expect(idAfter).toBe(idA);
  });

  it("distinct content yields distinct ids", () => {
    const atoms = extractEvidence({
      qualifications: {
        publications: [pub("Paper A", 2020, 10), pub("Paper B", 2020, 10)],
      },
    });
    expect(atoms[0].id).not.toBe(atoms[1].id);
  });

  it("changing a field changes the id (no stale approvals)", () => {
    const [a1] = extractEvidence({
      qualifications: { publications: [pub("Paper A", 2020, 10)] },
    });
    const [a2] = extractEvidence({
      qualifications: { publications: [pub("Paper A", 2020, 11)] },
    });
    expect(a1.id).not.toBe(a2.id);
  });

  it("makeAtom is the single source of truth for ids", () => {
    const [a] = extractEvidence({
      qualifications: { publications: [pub("Paper A", 2020, 10)] },
    });
    const rebuilt = makeAtom({
      kind: "publication",
      summary: "Paper A",
      detail: "Published in Nature",
      year: 2020,
      metric: "10 citations",
    });
    expect(a.id).toBe(rebuilt.id);
  });
});
