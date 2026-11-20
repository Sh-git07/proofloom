/**
 * Tests for Evidence from Uploaded Source Documents.
 * Covers: pending doc → not evidence; approved doc → VERIFIED with excerpt;
 *         expired doc → OUTDATED; extractor → ≥3 candidates from pilot report.
 */
import { describe, it, expect } from "vitest";
import {
  verifyClaimAgainstEvidence,
  type DatabaseFact,
} from "@/lib/audit/evidence";
import { extractCandidates } from "@/lib/documents/extractor";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeFact(overrides: Partial<DatabaseFact> & Pick<DatabaseFact, "id" | "name" | "value" | "numeric_value">): DatabaseFact {
  return {
    unit: "%",
    approval_status: "APPROVED",
    expires_at: null,
    superseded_by: null,
    source_citation: null,
    ...overrides,
  };
}

const CLAIM_92 = {
  text: "92% of customers rated the product satisfactory",
  startIndex: 0,
  endIndex: 48,
  claimType: "numerical" as const,
  numericValue: 92,
  unit: "%",
  metric: "customer_satisfaction",
};

// ---------------------------------------------------------------------------
// 1. Pending document fact is NEVER used as evidence
// ---------------------------------------------------------------------------
describe("Pending document — fact not used as evidence", () => {
  it("returns UNSUPPORTED when source_document_status is PENDING_APPROVAL", () => {
    const fact = makeFact({
      id: "fact-1",
      name: "Customer satisfaction percentage",
      value: "92%",
      numeric_value: 92,
      source_document_id: "doc-1",
      source_document_status: "PENDING_APPROVAL",
    });
    const result = verifyClaimAgainstEvidence(CLAIM_92, [fact]);
    expect(result.status).toBe("UNSUPPORTED");
  });

  it("returns UNSUPPORTED when source_document_status is REJECTED", () => {
    const fact = makeFact({
      id: "fact-2",
      name: "Customer satisfaction percentage",
      value: "92%",
      numeric_value: 92,
      source_document_id: "doc-2",
      source_document_status: "REJECTED",
    });
    const result = verifyClaimAgainstEvidence(CLAIM_92, [fact]);
    expect(result.status).toBe("UNSUPPORTED");
  });
});

// ---------------------------------------------------------------------------
// 2. Approved document fact → VERIFIED, matchedFact carries excerpt
// ---------------------------------------------------------------------------
describe("Approved document — fact is VERIFIED with excerpt", () => {
  it("returns VERIFIED and matchedFact.source_excerpt contains the pilot sentence", () => {
    const excerpt = "In the 2026 customer survey, 92% of customers rated the product satisfactory.";
    const fact = makeFact({
      id: "fact-3",
      name: "Customer satisfaction percentage",
      value: "92%",
      numeric_value: 92,
      source_document_id: "doc-3",
      source_document_status: "APPROVED",
      source_document_version: "3",
      source_excerpt: excerpt,
      source_page: 1,
    });
    const result = verifyClaimAgainstEvidence(CLAIM_92, [fact]);
    expect(result.status).toBe("VERIFIED");
    expect(result.matchedFact).toBeDefined();
    expect(result.matchedFact!.source_excerpt).toBe(excerpt);
  });
});

// ---------------------------------------------------------------------------
// 3. Expired document → OUTDATED
// ---------------------------------------------------------------------------
describe("Expired document — gives OUTDATED", () => {
  it("returns OUTDATED when source_document_expiry is in the past", () => {
    const fact = makeFact({
      id: "fact-4",
      name: "Customer satisfaction percentage",
      value: "92%",
      numeric_value: 92,
      source_document_id: "doc-4",
      source_document_status: "APPROVED",
      source_document_expiry: "2020-01-01T00:00:00Z", // clearly expired
    });
    const result = verifyClaimAgainstEvidence(CLAIM_92, [fact]);
    expect(result.status).toBe("OUTDATED");
  });

  it("returns OUTDATED when fact itself has expired approval_status", () => {
    const fact = makeFact({
      id: "fact-5",
      name: "Customer satisfaction percentage",
      value: "92%",
      numeric_value: 92,
      approval_status: "EXPIRED",
    });
    const result = verifyClaimAgainstEvidence(CLAIM_92, [fact]);
    expect(result.status).toBe("OUTDATED");
  });
});

// ---------------------------------------------------------------------------
// 4. Extractor: pilot report produces ≥ 3 candidates including 92% one
// ---------------------------------------------------------------------------
describe("extractCandidates — pilot report text", () => {
  const reportPath = join(process.cwd(), "test-assets", "pilot-report-v3.txt");

  it("produces at least 3 candidates from the pilot report", () => {
    const text = readFileSync(reportPath, "utf8");
    const candidates = extractCandidates(text, 1);
    expect(candidates.length).toBeGreaterThanOrEqual(3);
  });

  it("includes a candidate for the 92% customer satisfaction sentence", () => {
    const text = readFileSync(reportPath, "utf8");
    const candidates = extractCandidates(text, 1);
    const c = candidates.find((c) => c.numericValue === 92 && c.unit === "%");
    expect(c).toBeDefined();
    expect(c!.excerpt).toContain("92%");
  });

  it("includes a candidate for onboarding time (2 days)", () => {
    const text = readFileSync(reportPath, "utf8");
    const candidates = extractCandidates(text, 1);
    const c = candidates.find(
      (c) => c.numericValue === 2 && c.unit?.toLowerCase().startsWith("day")
    );
    expect(c).toBeDefined();
  });

  it("includes a candidate with numeric_value for the 87% retention sentence", () => {
    const text = readFileSync(reportPath, "utf8");
    const candidates = extractCandidates(text, 1);
    const c = candidates.find((c) => c.numericValue === 87);
    expect(c).toBeDefined();
  });
});
