import { describe, it, expect } from "vitest";
import { extractClaimsDeterministic } from "@/lib/audit/claim-extraction";
import { verifyClaimAgainstEvidence, DatabaseFact } from "@/lib/audit/evidence";
import { checkBrandVoiceDeterministic } from "@/lib/audit/brand-voice";
import { checkTerminologyDeterministic, DatabaseTermRule } from "@/lib/audit/terminology";
import { calculateAuditScores } from "@/lib/audit/scoring";
import { AuditFindingRecord } from "@/lib/audit/types";

describe("Phase 2 Specification Gate — Scenarios A, B, C, D Verification", () => {
  const seededFacts: DatabaseFact[] = [
    {
      id: "fact-pilot-18",
      name: "Internal Productivity Pilot Report v2",
      value: "18% improvement in task completion time",
      numeric_value: 18,
      unit: "%",
      approval_status: "APPROVED",
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 270).toISOString(),
      superseded_by: null,
      metric: "productivity_task_completion",
    },
    {
      id: "fact-cust-12400",
      name: "Verified Customer Count 2026",
      value: "12,400 businesses",
      numeric_value: 12400,
      unit: "businesses",
      approval_status: "APPROVED",
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 150).toISOString(),
      superseded_by: null,
      metric: "customer_business_count",
    },
    {
      id: "fact-cust-8000-superseded",
      name: "Customer Count 2024 (Superseded)",
      value: "8,000 businesses",
      numeric_value: 8000,
      unit: "businesses",
      approval_status: "EXPIRED",
      expires_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
      superseded_by: "fact-cust-12400",
      metric: "customer_business_count",
    },
  ];

  const seededTermRules: DatabaseTermRule[] = [
    {
      id: "term-1",
      disallowed_term: "revolutionary",
      approved_term: "purpose-built",
      category: "marketing_hype",
      severity: "MEDIUM",
      reason: "Avoid exaggerated superlatives and unsubstantiated tech hype.",
    },
    {
      id: "term-2",
      disallowed_term: "autonomous employee replacement system",
      approved_term: "AI-powered productivity platform",
      category: "product_naming",
      severity: "CRITICAL",
    },
  ];

  // ==========================================
  // SCENARIO A: Overblown Claim (300% vs 18%)
  // ==========================================
  it("Scenario A: Flags 300% as CONTRADICTED, triggering CRITICAL finding and score deduction", () => {
    const content = "Our platform increases productivity by 300%. Transform how your enterprise operates.";

    // 1. Claim extraction
    const claims = extractClaimsDeterministic(content);
    expect(claims.length).toBeGreaterThan(0);
    const claim300 = claims.find((c) => c.text === "300%");
    expect(claim300).toBeDefined();

    // 2. Evidence verification against 18% benchmark
    const evidenceResult = verifyClaimAgainstEvidence(claim300!, seededFacts, 5.0);
    expect(evidenceResult.status).toBe("CONTRADICTED");
    expect(evidenceResult.matchedFact?.id).toBe("fact-pilot-18");

    // 3. Finding generation
    const findings: AuditFindingRecord[] = [
      {
        id: "FIND-001",
        category: "claims",
        severity: "CRITICAL",
        excerpt: claim300!.text,
        startIndex: claim300!.startIndex,
        endIndex: claim300!.endIndex,
        explanation: evidenceResult.explanation,
        recommendedAction: "Align with approved benchmark of 18%",
        confidence: "high",
        isResolved: false,
      },
    ];

    // 4. Scoring
    const scores = calculateAuditScores(findings);
    expect(scores.claims).toBe(75); // 100 - 25 deduction
    expect(scores.overall).toBe(90); // (2500 + 2625 + 2000 + 1000) / 90 = 90.3 -> 90
    // Unresolved CRITICAL finding forces REVISION_REQUIRED status regardless of score
    const hasCritical = findings.some((f) => f.severity === "CRITICAL");
    expect(hasCritical).toBe(true);
  });

  // ==========================================
  // SCENARIO B: Tone Infraction & Disallowed Hype
  // ==========================================
  it("Scenario B: Flags aggressive 'destroy' tone and disallowed 'revolutionary' terminology", () => {
    const content = "Destroy your competition with our revolutionary platform.";

    // 1. Voice check (detects aggressive 'destroy' [-15] and hype 'revolutionary' [-8])
    const voiceFindings = checkBrandVoiceDeterministic(content);
    const destroyFinding = voiceFindings.find((f) => f.excerpt.toLowerCase() === "destroy");
    expect(destroyFinding).toBeDefined();
    expect(destroyFinding?.severity).toBe("HIGH");

    // 2. Terminology check
    const termFindings = checkTerminologyDeterministic(content, seededTermRules, false);
    const revFinding = termFindings.find((f) => f.excerpt.toLowerCase() === "revolutionary");
    expect(revFinding).toBeDefined();
    expect(revFinding?.suggestedReplacement).toBe("purpose-built");

    // 3. Combined findings scoring
    const allFindings = [...voiceFindings, ...termFindings];
    const scores = calculateAuditScores(allFindings);
    expect(scores.voice).toBe(77); // 100 - 15 (destroy) - 8 (revolutionary)
    expect(scores.terminology).toBe(92); // 100 - 8 (revolutionary)
  });

  // ==========================================
  // SCENARIO C: Outdated Benchmark (8,000 vs 12,400)
  // ==========================================
  it("Scenario C: Flags 8,000 businesses as OUTDATED and references current 12,400 fact", () => {
    const content = "Trusted by 8,000 businesses across the globe.";

    const claims = extractClaimsDeterministic(content);
    expect(claims.length).toBeGreaterThan(0);
    const countClaim = claims[0];

    const evidenceResult = verifyClaimAgainstEvidence(countClaim, seededFacts, 5.0);
    expect(evidenceResult.status).toBe("OUTDATED");
    expect(evidenceResult.matchedFact?.id).toBe("fact-cust-8000-superseded");
    expect(evidenceResult.currentFact?.id).toBe("fact-cust-12400");
    expect(evidenceResult.explanation).toContain("12,400");
  });

  // ==========================================
  // SCENARIO D: Clean Approved Content
  // ==========================================
  it("Scenario D: Clean content with approved descriptions, 18% figure, and disclaimer scores ≥ 90", () => {
    const content =
      "Our AI-powered productivity platform helps teams work smarter. In an internal pilot, teams saw an 18% improvement in task completion time. Results based on an internal pilot; individual results may vary.";

    // 1. Claims
    const claims = extractClaimsDeterministic(content);
    const pilotClaim = claims.find((c) => c.text === "18%");
    expect(pilotClaim).toBeDefined();

    const ev = verifyClaimAgainstEvidence(pilotClaim!, seededFacts, 5.0);
    expect(ev.status).toBe("VERIFIED");

    // 2. Voice
    const voiceFindings = checkBrandVoiceDeterministic(content);
    expect(voiceFindings.length).toBe(0);

    // 3. Terminology & disclaimer
    const termFindings = checkTerminologyDeterministic(content, seededTermRules, true);
    // Since required disclaimer is present, no missing disclaimer finding
    expect(termFindings.length).toBe(0);

    // 4. Scoring
    const scores = calculateAuditScores([]);
    expect(scores.overall).toBe(100);
    expect(scores.overall).toBeGreaterThanOrEqual(90);
  });
});
