import { describe, it, expect } from "vitest";
import { resolveTemperature, DRAFTING_TEMP_MAX, DRAFTING_TEMP_DEFAULT } from "@/lib/lmstudio";

describe("resolveTemperature — drafting tier ceiling", () => {
  it("clamps a high client temperature (stale 0.7) to the ceiling", () => {
    expect(resolveTemperature("drafting", 0.7)).toBe(DRAFTING_TEMP_MAX);
    expect(resolveTemperature("drafting", 1)).toBe(DRAFTING_TEMP_MAX);
  });

  it("passes through a low drafting temperature unchanged", () => {
    expect(resolveTemperature("drafting", 0.4)).toBe(0.4);
    expect(resolveTemperature("drafting", 0.2)).toBe(0.2);
  });

  it("defaults un-specified / NaN drafting calls to the drafting default", () => {
    expect(resolveTemperature("drafting", undefined)).toBe(DRAFTING_TEMP_DEFAULT);
    expect(resolveTemperature("drafting", NaN)).toBe(DRAFTING_TEMP_DEFAULT);
  });

  it("leaves the fast tier untouched (callers pin their own low temps)", () => {
    expect(resolveTemperature("fast", 0)).toBe(0);
    expect(resolveTemperature("fast", 0.2)).toBe(0.2);
    expect(resolveTemperature("fast", 0.7)).toBe(0.7);
    expect(resolveTemperature("fast", undefined)).toBe(0.7);
  });
});
