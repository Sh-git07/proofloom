import { describe, it, expect } from "vitest";
import {
  checkTerminologyDeterministic,
  DatabaseTermRule,
  REQUIRED_PERFORMANCE_DISCLAIMER,
} from "@/lib/audit/terminology";

describe("Terminology & Disclaimer Engine", () => {
  const mockRules: DatabaseTermRule[] = [
    {
      id: "term-1",
      disallowed_term: "revolutionary",
      approved_term: "purpose-built",
      category: "marketing_hype",
      severity: "MEDIUM",
    },
    {
      id: "term-2",
      disallowed_term: "autonomous employee replacement system",
      approved_term: "AI-powered productivity platform",
      category: "product_naming",
      severity: "CRITICAL",
    },
  ];

  it("detects disallowed terminology and maps to approved standard", () => {
    const content = "Try our revolutionary platform today.";
    const findings = checkTerminologyDeterministic(content, mockRules, false);

    expect(findings.length).toBe(1);
    expect(findings[0].excerpt).toBe("revolutionary");
    expect(findings[0].suggestedReplacement).toBe("purpose-built");
    expect(findings[0].severity).toBe("MEDIUM");
  });

  it("flags missing mandatory legal disclaimer when performance claims exist", () => {
    const content = "Our platform increases productivity by 18% in recent benchmarks.";
    const findings = checkTerminologyDeterministic(content, mockRules, true);

    const disclaimerFinding = findings.find((f) =>
      f.explanation.includes("Mandatory legal disclaimer missing")
    );
    expect(disclaimerFinding).toBeDefined();
    expect(disclaimerFinding?.severity).toBe("HIGH");
    expect(disclaimerFinding?.recommendedAction).toContain(REQUIRED_PERFORMANCE_DISCLAIMER);
  });

  it("passes without disclaimer finding if disclaimer is present", () => {
    const content = `Our platform increases productivity by 18% in recent benchmarks. Results based on an internal pilot; individual results may vary.`;
    const findings = checkTerminologyDeterministic(content, mockRules, true);

    const disclaimerFinding = findings.find((f) =>
      f.explanation.includes("Mandatory legal disclaimer missing")
    );
    expect(disclaimerFinding).toBeUndefined();
  });
});
