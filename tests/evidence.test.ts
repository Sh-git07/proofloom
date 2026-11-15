import { describe, it, expect } from "vitest";
import { verifyClaimAgainstEvidence, DatabaseFact } from "@/lib/audit/evidence";
import { RawExtractedClaim } from "@/lib/audit/claim-extraction";

describe("Evidence Comparison & Decision Table Engine", () => {
  const mockFacts: DatabaseFact[] = [
    {
      id: "fact-pilot",
      name: "Internal Productivity Pilot Report v2",
      value: "18% improvement in task completion time",
      numeric_value: 18,
      unit: "%",
      approval_status: "APPROVED",
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(),
      superseded_by: null,
      metric: "productivity_task_completion",
    },
    {
      id: "fact-customers-current",
      name: "Verified Customer Base 2026",
      value: "12,400 businesses",
      numeric_value: 12400,
      unit: "businesses",
      approval_status: "APPROVED",
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120).toISOString(),
      superseded_by: null,
    },
    {
      id: "fact-customers-superseded",
      name: "Customer Base 2024 (Superseded)",
      value: "8,000 businesses",
      numeric_value: 8000,
      unit: "businesses",
      approval_status: "EXPIRED",
      expires_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
      superseded_by: "fact-customers-current",
    },
  ];

  it("Scenario A: Resolves 300% vs 18% pilot benchmark to CONTRADICTED", () => {
    const claim: RawExtractedClaim = {
      text: "300%",
      startIndex: 10,
      endIndex: 14,
      claimType: "numerical",
      numericValue: 300,
      unit: "%",
      metric: "productivity_task_completion",
    };

    const result = verifyClaimAgainstEvidence(claim, mockFacts, 5.0);

    expect(result.status).toBe("CONTRADICTED");
    expect(result.matchedFact?.id).toBe("fact-pilot");
    expect(result.variancePercent).toBeGreaterThan(5.0);
    expect(result.explanation).toContain("significantly contradicts approved benchmark");
  });

  it("Scenario C: Resolves 8,000 businesses to OUTDATED pointing to 12,400", () => {
    const claim: RawExtractedClaim = {
      text: "8,000 businesses",
      startIndex: 11,
      endIndex: 27,
      claimType: "numerical",
      numericValue: 8000,
      unit: "businesses",
      metric: "customer_business_count",
    };

    const result = verifyClaimAgainstEvidence(claim, mockFacts, 5.0);

    expect(result.status).toBe("OUTDATED");
    expect(result.matchedFact?.id).toBe("fact-customers-superseded");
    expect(result.currentFact?.id).toBe("fact-customers-current");
    expect(result.explanation).toContain("Current approved active benchmark is 12,400 businesses");
  });

  it("Verifies approved claim within 5% tolerance", () => {
    const claim: RawExtractedClaim = {
      text: "18% in internal pilot",
      startIndex: 0,
      endIndex: 22,
      claimType: "numerical",
      numericValue: 18,
      unit: "%",
      metric: "productivity_task_completion",
    };

    const result = verifyClaimAgainstEvidence(claim, mockFacts, 5.0);

    expect(result.status).toBe("VERIFIED");
    expect(result.matchedFact?.id).toBe("fact-pilot");
    expect(result.explanation).toContain("Empirically verified against authoritative benchmark");
  });

  it("Marks claim as UNSUPPORTED with exact spec string when no candidate exists", () => {
    const claim: RawExtractedClaim = {
      text: "99.999% uptime in interstellar satellites",
      startIndex: 0,
      endIndex: 40,
      claimType: "numerical",
      numericValue: 99.999,
      unit: "%",
      metric: "satellite_telemetry",
    };

    const result = verifyClaimAgainstEvidence(claim, mockFacts, 5.0);

    expect(result.status).toBe("UNSUPPORTED");
    expect(result.explanation).toBe("NO APPROVED EVIDENCE FOUND");
  });
});
