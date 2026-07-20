import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { sha256Hex } from "@/lib/sha256";

const nodeSha = (s: string) =>
  createHash("sha256").update(s, "utf8").digest("hex");

describe("sha256Hex", () => {
  // FIPS 180-4 / NIST known-answer test vectors.
  it("hashes the empty string", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it('hashes "abc"', () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("hashes a 448-bit (two-block) message", () => {
    expect(
      sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
    ).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });

  it("is deterministic across calls", () => {
    expect(sha256Hex("petitionhq")).toBe(sha256Hex("petitionhq"));
  });

  // Cross-check the vendored sync implementation against Node's crypto for a
  // spread of inputs — this is what guarantees the browser path (which can't
  // use node:crypto) produces identical digests. Covers UTF-8 multi-byte,
  // exact-block-boundary lengths (55/56/63/64), and long multi-block input.
  it("matches node:crypto across varied inputs", () => {
    const cases = [
      "",
      "a",
      "abc",
      "café",
      "naïve façade — Müller, 北京, 🚀",
      "x".repeat(55),
      "x".repeat(56),
      "x".repeat(63),
      "x".repeat(64),
      "x".repeat(65),
      "x".repeat(1000),
      "publication|Deep learning for X|Published in Nature|2023|412 citations",
    ];
    for (const c of cases) {
      expect(sha256Hex(c)).toBe(nodeSha(c));
    }
  });

  it("produces a 64-char lowercase hex string", () => {
    expect(sha256Hex("anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});
