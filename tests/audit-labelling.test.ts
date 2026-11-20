import { describe, it, expect } from "vitest";
import {
  deriveEngineModeLabel,
  extractStageOutcome,
  calculateStageFindingsCount,
} from "@/lib/audit/labelling";

describe("Audit Labelling and Stage Outcomes", () => {
  // 1. Successful AI calls label the stage "AI: used"
  it("extracts AI: used from successful stage details", () => {
    const primaryOutcome = extractStageOutcome(
      "AI: used (primary model) • Completed with 3 claims"
    );
    expect(primaryOutcome).toBe("AI: used (primary model)");
    expect(primaryOutcome.includes("AI: used")).toBe(true);

    const fallbackOutcome = extractStageOutcome(
      "AI: used (fallback model) • Completed with 2 findings"
    );
    expect(fallbackOutcome).toBe("AI: used (fallback model)");
    expect(fallbackOutcome.includes("AI: used")).toBe(true);
  });

  // 2. Failed AI calls label the stage "AI: failed, rules only"
  it("extracts AI: failed, rules only from failed stage details", () => {
    const failedOutcome = extractStageOutcome(
      "AI: failed, rules only (Gemini timeout 15000ms exceeded) • Completed with 1 findings"
    );
    expect(failedOutcome).toContain("AI: failed, rules only");
    expect(failedOutcome).toContain("Gemini timeout 15000ms exceeded");

    const genericFailed = extractStageOutcome(
      "AI: failed, rules only • Completed with 0 claims"
    );
    expect(genericFailed).toBe("AI: failed, rules only");
  });

  // 3. Uncalled stages label "AI: not used"
  it("extracts AI: not used for deterministic stages", () => {
    const notUsedOutcome = extractStageOutcome(
      "AI: not used • Content ingested successfully"
    );
    expect(notUsedOutcome).toBe("AI: not used");

    const nullOutcome = extractStageOutcome(null);
    expect(nullOutcome).toBe("AI: not used");
  });

  // 4. Header & Engine Mode derivation
  describe("deriveEngineModeLabel", () => {
    it("returns RULES ONLY when mode is demo", () => {
      const stages = [
        { stage_number: 2, detail: "AI: used (primary model)" },
        { stage_number: 4, detail: "AI: used (primary model)" },
      ];
      expect(deriveEngineModeLabel("demo", stages)).toBe("RULES ONLY");
    });

    it("returns LIVE AI (GEMINI) when every AI stage succeeded", () => {
      const stages = [
        { stage_number: 2, detail: "AI: used (primary model) • Completed with 2 claims" },
        { stage_number: 4, detail: "AI: used (fallback model) • Completed with 2 findings" },
      ];
      expect(deriveEngineModeLabel("live_ai", stages)).toBe("LIVE AI (GEMINI)");
    });

    it("returns partial label naming voice analysis when voice AI failed", () => {
      const stages = [
        { stage_number: 2, detail: "AI: used (primary model) • Completed with 2 claims" },
        { stage_number: 4, detail: "AI: failed, rules only (HTTP 503) • Completed with 1 findings" },
      ];
      const label = deriveEngineModeLabel("live_ai", stages);
      expect(label).toBe("LIVE AI (GEMINI): partial, voice analysis used rules only");
      // Never say voice analysis unavailable when voice findings came from AI
      expect(label).not.toContain("claim extraction");
    });

    it("returns partial label naming claim extraction when claim AI failed", () => {
      const stages = [
        { stage_number: 2, detail: "AI: failed, rules only (timeout) • Completed with 2 claims" },
        { stage_number: 4, detail: "AI: used (primary model) • Completed with 2 findings" },
      ];
      const label = deriveEngineModeLabel("live_ai", stages);
      expect(label).toBe("LIVE AI (GEMINI): partial, claim extraction used rules only");
      // Crucial requirement: Never say "voice analysis unavailable" when voice findings came from the AI
      expect(label).not.toContain("voice analysis unavailable");
    });

    it("returns RULES ONLY when all AI stages failed", () => {
      const stages = [
        { stage_number: 2, detail: "AI: failed, rules only (HTTP 503)" },
        { stage_number: 4, detail: "AI: failed, rules only (timeout)" },
      ];
      expect(deriveEngineModeLabel("live_ai", stages)).toBe("RULES ONLY");
    });
  });

  // 5. Stage findings count calculation
  describe("calculateStageFindingsCount", () => {
    const mockFindings = [
      { category: "voice", confidence_note: "AI" },
      { category: "voice", confidence_note: "Rule" },
      { category: "claims", confidence_note: "Rule" },
      { category: "claim_reliability", confidence_note: "Rule" },
      { category: "terminology", confidence_note: "Rule" },
      { category: "accessibility", confidence_note: "Rule" },
      { category: "accessibility", confidence_note: "Rule" },
    ];

    it("counts all voice findings (both AI and rule findings) for Stage 4", () => {
      const voiceCount = calculateStageFindingsCount(4, mockFindings);
      expect(voiceCount).toBe(2);
    });

    it("counts claim reliability findings for Stage 3", () => {
      const claimCount = calculateStageFindingsCount(3, mockFindings);
      expect(claimCount).toBe(2);
    });

    it("counts terminology findings for Stage 5", () => {
      const termCount = calculateStageFindingsCount(5, mockFindings);
      expect(termCount).toBe(1);
    });

    it("counts accessibility findings for Stage 6", () => {
      const a11yCount = calculateStageFindingsCount(6, mockFindings);
      expect(a11yCount).toBe(2);
    });

    it("returns 0 for Stage 1 and Stage 2", () => {
      expect(calculateStageFindingsCount(1, mockFindings)).toBe(0);
      expect(calculateStageFindingsCount(2, mockFindings)).toBe(0);
    });
  });

  // 6. Source tagging ("Rule" vs "AI")
  describe("Finding source tagging", () => {
    it("identifies Rule source correctly", () => {
      const f = { confidence_note: "Rule", id: "FND-001" };
      const source = f.confidence_note === "AI" || f.id.includes("AI") ? "AI" : "Rule";
      expect(source).toBe("Rule");
    });

    it("identifies AI source correctly", () => {
      const f = { confidence_note: "AI", id: "FIND-AI-001" };
      const source = f.confidence_note === "AI" || f.id.includes("AI") ? "AI" : "Rule";
      expect(source).toBe("AI");
    });
  });
});
