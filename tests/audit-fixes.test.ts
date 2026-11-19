import { describe, it, expect } from "vitest";
import { extractClaimsDeterministic } from "@/lib/audit/claim-extraction";
import { verifyClaimAgainstEvidence, DatabaseFact } from "@/lib/audit/evidence";
import { checkBrandVoiceDeterministic } from "@/lib/audit/brand-voice";
import { checkTerminologyDeterministic, DatabaseTermRule } from "@/lib/audit/terminology";
import { calculateAuditScores } from "@/lib/audit/scoring";
import { buildViewerSegments, ViewerFinding } from "@/lib/audit/viewer";
import { AuditFindingRecord } from "@/lib/audit/types";

describe("Six Audit Report Fixes — Full Capability Test", () => {
  const FULL_CAPABILITY_TEXT =
    "Destroy your competition with our revolutionary platform, the world's fastest autonomous employee replacement system that will crush every rival and completely transform how absolutely every team in every industry plans, tracks, assigns and reviews all of their daily work from one single place. Our platform increases productivity by 300%. Trusted by 8,000 businesses. Join the 12,400 businesses that trust us. We are the number one solution in our industry and our customers save 10 hours every week. Task completion time improved by 18% in our internal pilot. Click here.";

  const seededFacts: DatabaseFact[] = [
    {
      id: "fact-pilot-18",
      name: "Internal Productivity Pilot Benchmark",
      value: "18% improvement in task completion time",
      numeric_value: 18,
      unit: "%",
      approval_status: "APPROVED",
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(),
      superseded_by: null,
      metric: "productivity_task_completion",
    },
    {
      id: "fact-cust-12400",
      name: "Verified Customer Milestone",
      value: "12,400 businesses",
      numeric_value: 12400,
      unit: "businesses",
      approval_status: "APPROVED",
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(),
      superseded_by: null,
      metric: "customer_business_count",
    },
    {
      id: "fact-cust-8000-superseded",
      name: "Outdated Customer Benchmark",
      value: "8,000 businesses",
      numeric_value: 8000,
      unit: "businesses",
      approval_status: "EXPIRED",
      expires_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
      superseded_by: "fact-cust-12400",
      metric: "customer_business_count",
    },
  ];

  const seededTermRules: DatabaseTermRule[] = [
    {
      id: "rule-auto-emp",
      disallowed_term: "autonomous employee replacement system",
      approved_term: "AI-powered productivity platform",
      category: "product_positioning",
      severity: "CRITICAL",
      reason: "Platform assists teams; it does not replace employees.",
    },
    {
      id: "rule-fastest",
      disallowed_term: "world's fastest",
      approved_term: "high-performance",
      category: "marketing_hype",
      severity: "CRITICAL",
      reason: "Unsubstantiated absolute claim violates FTC guidelines.",
    },
    {
      id: "rule-rev",
      disallowed_term: "revolutionary",
      approved_term: "purpose-built",
      category: "marketing_hype",
      severity: "MEDIUM",
      reason: "Generic buzzwords violate brand tone.",
    },
    {
      id: "rule-destroy",
      disallowed_term: "destroy",
      approved_term: "surpass",
      category: "brand_voice",
      severity: "HIGH",
      reason: "Violent language violates professional approachable tone.",
    },
    {
      id: "rule-crush",
      disallowed_term: "crush",
      approved_term: "outperform",
      category: "brand_voice",
      severity: "HIGH",
      reason: "Eliminate combative and violent verbs.",
    },
  ];

  // =========================================================================
  // Test 1: No duplicated text in viewer ranges (concatenation === full text)
  // =========================================================================
  it("builds merged, non-overlapping viewer ranges with no duplicated text", () => {
    // Generate all findings across claims, terminology, and voice
    const claims = extractClaimsDeterministic(FULL_CAPABILITY_TEXT);
    const termFindings = checkTerminologyDeterministic(FULL_CAPABILITY_TEXT, seededTermRules, true);
    const voiceFindings = checkBrandVoiceDeterministic(FULL_CAPABILITY_TEXT, seededTermRules);

    const viewerFindings: ViewerFinding[] = [
      ...termFindings.map((f) => ({
        id: f.id,
        category: f.category,
        severity: f.severity,
        excerpt: f.excerpt,
        start_index: f.startIndex,
        end_index: f.endIndex,
        explanation: f.explanation,
        is_resolved: f.isResolved,
      })),
      ...voiceFindings.map((f) => ({
        id: f.id,
        category: f.category,
        severity: f.severity,
        excerpt: f.excerpt,
        start_index: f.startIndex,
        end_index: f.endIndex,
        explanation: f.explanation,
        is_resolved: f.isResolved,
      })),
      ...claims.map((c, idx) => ({
        id: `CLM-${idx}`,
        category: "claims",
        severity: "HIGH",
        excerpt: c.text,
        start_index: c.startIndex,
        end_index: c.endIndex,
        explanation: "Extracted claim",
        is_resolved: false,
      })),
    ];

    const segments = buildViewerSegments(FULL_CAPABILITY_TEXT, viewerFindings);

    // 1. Every character of the submitted text appears exactly once
    const concatenated = segments.map((s) => s.text).join("");
    expect(concatenated).toBe(FULL_CAPABILITY_TEXT);

    // 2. No repeated text fragments
    expect(concatenated).not.toContain("DestroyDestroy");
    expect(concatenated).not.toContain("revolutionaryrevolutionary");
    expect(concatenated).not.toContain("world's fastestworld's fastest");

    // 3. Spans that have findings are sorted with most severe finding first
    for (const seg of segments) {
      if (seg.coveringFindings.length > 1) {
        const severities = seg.coveringFindings.map((f) => f.severity);
        // CRITICAL must precede HIGH, HIGH must precede MEDIUM
        if (severities.includes("CRITICAL") && severities.includes("HIGH")) {
          expect(severities.indexOf("CRITICAL")).toBeLessThan(severities.indexOf("HIGH"));
        }
        if (severities.includes("HIGH") && severities.includes("MEDIUM")) {
          expect(severities.indexOf("HIGH")).toBeLessThan(severities.indexOf("MEDIUM"));
        }
      }
    }
  });

  // =========================================================================
  // Test 2: A single scored finding per distinct excerpt
  // =========================================================================
  it("counts only the single highest-severity finding per distinct excerpt in scoring", () => {
    // Both claims and terminology flag "world's fastest" (CRITICAL in term, HIGH in claim)
    const findings: AuditFindingRecord[] = [
      {
        id: "FND-CLM-FASTEST",
        category: "claims",
        severity: "HIGH", // deduction: 15
        excerpt: "world's fastest",
        startIndex: 62,
        endIndex: 77,
        explanation: "Unsubstantiated superlative claim",
        recommendedAction: "Remove superlative",
        confidence: "high",
        isResolved: false,
      },
      {
        id: "FND-TRM-FASTEST",
        category: "terminology",
        severity: "CRITICAL", // deduction: 25
        excerpt: "world's fastest",
        startIndex: 62,
        endIndex: 77,
        explanation: "Disallowed marketing hyperbole",
        recommendedAction: "Use approved terminology",
        confidence: "high",
        isResolved: false,
      },
    ];

    const scores = calculateAuditScores(findings);

    // Only CRITICAL (-25) is deducted; HIGH (-15) on the same excerpt is not double-deducted
    expect(scores.terminology).toBe(75); // 100 - 25
    expect(scores.claims).toBe(100); // 100 - 0 (claim finding was not double-counted)
  });

  // =========================================================================
  // Test 3: The disclaimer excerpt covers the full sentence (not truncated to 60 chars)
  // =========================================================================
  it("attaches missing-disclaimer finding to the full sentence that contains the performance claim", () => {
    const termFindings = checkTerminologyDeterministic(FULL_CAPABILITY_TEXT, seededTermRules, true);
    const disclaimerFinding = termFindings.find((f) =>
      f.explanation.toLowerCase().includes("disclaimer missing")
    );

    expect(disclaimerFinding).toBeDefined();

    const expectedSentence = "Task completion time improved by 18% in our internal pilot.";

    // 1. Excerpt covers the full sentence
    expect(disclaimerFinding?.excerpt).toBe(expectedSentence);

    // 2. Excerpt is not truncated to 60 characters
    expect(disclaimerFinding?.excerpt.length).toBe(expectedSentence.length);
    expect(disclaimerFinding?.excerpt.length).toBe(59);

    // 3. Exact alignment in full text
    expect(
      FULL_CAPABILITY_TEXT.slice(disclaimerFinding!.startIndex, disclaimerFinding!.endIndex)
    ).toBe(expectedSentence);

    // 4. Shows exact approved disclaimer text as suggested addition / in recommendation
    expect(disclaimerFinding?.recommendedAction).toContain(
      "Results based on an internal pilot; individual results may vary."
    );
    expect(disclaimerFinding?.suggestedReplacement).toContain(
      "Results based on an internal pilot; individual results may vary."
    );
  });

  // =========================================================================
  // Test 4: "number one" is extracted as a comparative claim and is UNSUPPORTED
  // =========================================================================
  it("extracts 'number one' as comparative claim, marks it UNSUPPORTED, and skips duplicate voice finding", () => {
    // 1. Claim extraction engine extracts "number one" as comparative
    const claims = extractClaimsDeterministic(FULL_CAPABILITY_TEXT);
    const numberOneClaim = claims.find((c) => c.text.toLowerCase() === "number one");

    expect(numberOneClaim).toBeDefined();
    expect(numberOneClaim?.claimType).toBe("comparative");

    // 2. Evidence verification engine returns UNSUPPORTED with NO APPROVED EVIDENCE FOUND
    const verification = verifyClaimAgainstEvidence(numberOneClaim!, seededFacts, 5.0);
    expect(verification.status).toBe("UNSUPPORTED");
    expect(verification.explanation).toBe("NO APPROVED EVIDENCE FOUND");

    // 3. Brand voice engine skips the duplicate voice finding for "number one"
    const voiceFindings = checkBrandVoiceDeterministic(FULL_CAPABILITY_TEXT, seededTermRules);
    const voiceNumberOne = voiceFindings.find((f) => f.excerpt.toLowerCase() === "number one");
    expect(voiceNumberOne).toBeUndefined();
  });
});
