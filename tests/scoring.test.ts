import { describe, it, expect } from "vitest";
import { calculateAuditScores } from "@/lib/audit/scoring";
import { AuditFindingRecord } from "@/lib/audit/types";

describe("Transparent Scoring Engine", () => {
  it("computes 100/100 score when zero findings exist", () => {
    const scores = calculateAuditScores([]);

    expect(scores.overall).toBe(100);
    expect(scores.voice).toBe(100);
    expect(scores.claims).toBe(100);
    expect(scores.terminology).toBe(100);
    expect(scores.accessibility).toBe(100);
    expect(scores.visual).toBeNull(); // Not checked
  });

  it("applies CRITICAL (-25) and HIGH (-15) deductions accurately", () => {
    const mockFindings: AuditFindingRecord[] = [
      {
        id: "FIND-001",
        category: "claims",
        severity: "CRITICAL",
        excerpt: "300%",
        startIndex: 0,
        endIndex: 4,
        explanation: "Contradicts approved pilot benchmark",
        recommendedAction: "Fix figure",
        confidence: "high",
        isResolved: false,
      },
      {
        id: "FIND-002",
        category: "voice",
        severity: "HIGH",
        excerpt: "destroy",
        startIndex: 10,
        endIndex: 17,
        explanation: "Aggressive tone",
        recommendedAction: "Soften phrasing",
        confidence: "high",
        isResolved: false,
      },
    ];

    const scores = calculateAuditScores(mockFindings);

    expect(scores.claims).toBe(75); // 100 - 25
    expect(scores.voice).toBe(85); // 100 - 15
    expect(scores.terminology).toBe(100);
    expect(scores.accessibility).toBe(100);
    expect(scores.overall).toBeLessThan(100);
  });

  it("excludes NOT CHECKED visual dimension from total weight calculation", () => {
    const scores = calculateAuditScores([], ["voice", "claims", "terminology", "accessibility"]);

    expect(scores.visual).toBeNull();
    expect(scores.overall).toBe(100);
  });

  it("enforces floor at 0 for heavy deductions", () => {
    const manyCriticals: AuditFindingRecord[] = Array.from({ length: 6 }, (_, i) => ({
      id: `FIND-${i}`,
      category: "claims",
      severity: "CRITICAL",
      excerpt: `critical-claim-${i}`,
      startIndex: i * 10,
      endIndex: i * 10 + 5,
      explanation: "failure",
      recommendedAction: "action",
      confidence: "high",
      isResolved: false,
    }));

    const scores = calculateAuditScores(manyCriticals);
    expect(scores.claims).toBe(0); // 100 - 150 -> 0
  });
});
