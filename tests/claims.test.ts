import { describe, it, expect } from "vitest";
import {
  extractClaimsDeterministic,
  claimsExtractionResponseSchema,
  parseAndValidateClaims,
} from "@/lib/audit/claim-extraction";

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

  describe("Claim Extraction Schema & Normalisation (Bug 1)", () => {
    const content = "Our team delivers 300% faster processing and serves 8,000 businesses.";

    it("parses a bare JSON array of claims", () => {
      const bareArray = [
        { claim_text: "300% faster", claim_type: "numerical", confidence: "high" },
        { claim_text: "8,000 businesses", claim_type: "factual", confidence: "medium" },
      ];

      const parsed = claimsExtractionResponseSchema.parse(bareArray);
      expect(parsed).toHaveProperty("claims");
      expect(Array.isArray(parsed.claims)).toBe(true);
      expect(parsed.claims.length).toBe(2);
      expect(parsed.claims[0].claim_text).toBe("300% faster");
      expect(parsed.claims[0].claim_type).toBe("numerical");
    });

    it("parses an object with claims array { claims: [...] }", () => {
      const wrappedObject = {
        claims: [
          { claim_text: "300% faster", claim_type: "numerical", confidence: "high" },
        ],
      };

      const parsed = claimsExtractionResponseSchema.parse(wrappedObject);
      expect(parsed).toHaveProperty("claims");
      expect(Array.isArray(parsed.claims)).toBe(true);
      expect(parsed.claims.length).toBe(1);
      expect(parsed.claims[0].claim_text).toBe("300% faster");
    });

    it("normalises both shapes to one internal shape and validates literal substrings", () => {
      // Shape 1: bare array with one valid substring and one hallucinated non-substring
      const bareInput = [
        { claim_text: "300% faster", claim_type: "numerical" },
        { claim_text: "hallucinated claim not in text", claim_type: "factual" },
      ];

      const validated1 = parseAndValidateClaims(bareInput, content);
      expect(validated1.length).toBe(1);
      expect(validated1[0].claim_text).toBe("300% faster");
      expect(content.slice(validated1[0].startIndex, validated1[0].endIndex)).toBe("300% faster");

      // Shape 2: wrapped object
      const objectInput = {
        claims: [
          { claim_text: "8,000 businesses", claim_type: "factual" },
          { claim_text: "another fake claim", claim_type: "opinion" },
        ],
      };

      const validated2 = parseAndValidateClaims(objectInput, content);
      expect(validated2.length).toBe(1);
      expect(validated2[0].claim_text).toBe("8,000 businesses");
      expect(content.slice(validated2[0].startIndex, validated2[0].endIndex)).toBe("8,000 businesses");
    });
  });
});
