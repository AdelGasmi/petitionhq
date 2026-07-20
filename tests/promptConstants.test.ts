import { describe, it, expect } from "vitest";
import { bannedWordsBlock, CRITIQUE_SYSTEM, critiqueUser, attorneyRulesAssessmentBlock } from "@/lib/prompts/constants";

describe("bannedWordsBlock", () => {
  it("wraps the canonical banned list in the negative_constraints tag", () => {
    const block = bannedWordsBlock();
    expect(block.startsWith("<negative_constraints>")).toBe(true);
    expect(block.trimEnd().endsWith("</negative_constraints>")).toBe(true);
    for (const phrase of ["testament to", "paradigm shift", "delve into", "navigate the complexities", "groundbreaking"]) {
      expect(block).toContain(phrase);
    }
  });

  it("appends extra content inside the block, before the closing tag", () => {
    const block = bannedWordsBlock("\n- Section-specific rule here");
    expect(block).toContain("Section-specific rule here");
    const extraIdx = block.indexOf("Section-specific rule here");
    const closeIdx = block.indexOf("</negative_constraints>");
    expect(extraIdx).toBeLessThan(closeIdx);
  });
});

describe("critique prompt", () => {
  it("CRITIQUE_SYSTEM states the JSON schema and the readyToSend threshold", () => {
    expect(CRITIQUE_SYSTEM).toContain("aiSlopFreeness");
    expect(CRITIQUE_SYSTEM).toContain("readyToSend = true only if overallScore >= 85 AND aiSlopFreeness >= 80");
  });

  it("critiqueUser embeds the letter and the required topics", () => {
    const user = critiqueUser("THE LETTER BODY", ["Topic A", "Topic B"]);
    expect(user).toContain("THE LETTER BODY");
    expect(user).toContain("Topic A");
    expect(user).toContain("Topic B");
    expect(user).toContain("<letter>");
  });
});

describe("attorneyRulesAssessmentBlock", () => {
  it("returns an empty string when the firm has no rules (no behavior change)", () => {
    expect(attorneyRulesAssessmentBlock("")).toBe("");
    expect(attorneyRulesAssessmentBlock("   ")).toBe("");
    expect(attorneyRulesAssessmentBlock(null)).toBe("");
    expect(attorneyRulesAssessmentBlock(undefined)).toBe("");
  });

  it("wraps the firm rules and instructs the grader not to penalize adherence", () => {
    const block = attorneyRulesAssessmentBlock("Always use extreme active voice. Cite Dhanasar in every section.");
    expect(block).toContain("<firm_rules>");
    expect(block).toContain("Always use extreme active voice.");
    expect(block).toContain("</firm_rules>");
    expect(block.toLowerCase()).toContain("not a defect");
    expect(block).toMatch(/do not lower the score/i);
  });
});
