import { describe, it, expect } from "vitest";
import { extractClaimsDeterministic } from "@/lib/audit/claim-extraction";

describe("Claim Extraction Engine", () => {
  it("extracts percentage claims with exact substring offsets", () => {
    const text = "Our platform increases productivity by 300%.";
    const claims = extractClaimsDeterministic(text);

    expect(claims.length).toBeGreaterThan(0);
    const claim = claims.find((c) => c.text === "300%");
    expect(claim).toBeDefined();
    expect(claim?.numericValue).toBe(300);
    expect(claim?.unit).toBe("%");
    expect(claim?.metric).toBe("productivity_task_completion");

    // Verify exact substring character offset
    expect(text.slice(claim!.startIndex, claim!.endIndex)).toBe("300%");
  });

  it("extracts business count claims", () => {
    const text = "Trusted by 8,000 businesses across the globe.";
    const claims = extractClaimsDeterministic(text);

    expect(claims.length).toBeGreaterThan(0);
    const countClaim = claims[0];
    expect(countClaim.numericValue).toBe(8000);
    expect(countClaim.unit).toBe("businesses");
    expect(text.slice(countClaim.startIndex, countClaim.endIndex)).toBe(countClaim.text);
  });

  it("extracts multipliers and superlative claims", () => {
    const text = "Experience 3x acceleration with the #1 platform.";
    const claims = extractClaimsDeterministic(text);

    expect(claims.some((c) => c.text === "3x")).toBe(true);
    expect(claims.some((c) => c.text === "#1")).toBe(true);
  });
});
