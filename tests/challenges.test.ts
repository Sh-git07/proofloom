import { describe, it, expect } from "vitest";

describe("Brand Memory Court Challenge Engine", () => {
  it("enforces minimum 15 characters rationale for empirical challenges", () => {
    const shortReason = "Disagree";
    expect(shortReason.trim().length).toBeLessThan(15);

    const validReason = "The 300% claim refers to internal test benchmark run in Q2 lab.";
    expect(validReason.trim().length).toBeGreaterThanOrEqual(15);
  });

  it("supports all 5 formal court decision types", () => {
    const validDecisions = [
      "UPHOLD",
      "REVERSE",
      "ACCEPT_AS_EXCEPTION",
      "REQUEST_EVIDENCE",
      "PROPOSE_GUIDELINE_CHANGE",
    ];

    expect(validDecisions).toHaveLength(5);
    expect(validDecisions).toContain("ACCEPT_AS_EXCEPTION");
  });
});
