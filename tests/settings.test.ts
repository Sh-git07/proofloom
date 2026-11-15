import { describe, it, expect } from "vitest";
import { canManageSettings } from "../src/lib/permissions";

describe("Phase 6: Governance Settings & Configuration Validation", () => {
  describe("Permission Checks", () => {
    it("allows only admin role to modify settings", () => {
      expect(canManageSettings("admin")).toBe(true);
      expect(canManageSettings("brand_manager")).toBe(false);
      expect(canManageSettings("reviewer")).toBe(false);
      expect(canManageSettings("creator")).toBe(false);
    });
  });

  describe("Scoring Weights Sum Validation", () => {
    function validateWeights(weights: {
      voice: number;
      claims: number;
      terminology: number;
      accessibility: number;
      visual: number;
    }) {
      const total =
        weights.voice +
        weights.claims +
        weights.terminology +
        weights.accessibility +
        weights.visual;

      if (total !== 100) {
        throw new Error(`Scoring weights must sum to exactly 100% (currently ${total}%).`);
      }
      return true;
    }

    it("accepts default scoring weights summing to 100%", () => {
      const defaultWeights = {
        voice: 25,
        claims: 35,
        terminology: 20,
        accessibility: 10,
        visual: 10,
      };

      expect(validateWeights(defaultWeights)).toBe(true);
    });

    it("rejects weights summing to more than 100%", () => {
      const invalidWeights = {
        voice: 30,
        claims: 35,
        terminology: 20,
        accessibility: 10,
        visual: 10,
      };

      expect(() => validateWeights(invalidWeights)).toThrow(
        "Scoring weights must sum to exactly 100% (currently 105%)."
      );
    });

    it("rejects weights summing to less than 100%", () => {
      const invalidWeights = {
        voice: 20,
        claims: 35,
        terminology: 20,
        accessibility: 10,
        visual: 10,
      };

      expect(() => validateWeights(invalidWeights)).toThrow(
        "Scoring weights must sum to exactly 100% (currently 95%)."
      );
    });
  });

  describe("Claim Tolerance & Retention Validation", () => {
    function validateTolerance(tol: number) {
      if (tol < 0 || tol > 50) {
        throw new Error("Claim tolerance percentage must be between 0% and 50%.");
      }
      return true;
    }

    function validateRetention(days: number) {
      if (days < 30) {
        throw new Error("Retention period cannot be less than 30 days.");
      }
      return true;
    }

    it("validates allowable numeric tolerance", () => {
      expect(validateTolerance(5.0)).toBe(true);
      expect(validateTolerance(0)).toBe(true);
      expect(validateTolerance(50)).toBe(true);
      expect(() => validateTolerance(-1)).toThrow();
      expect(() => validateTolerance(51)).toThrow();
    });

    it("validates audit retention duration minimums", () => {
      expect(validateRetention(365)).toBe(true);
      expect(validateRetention(30)).toBe(true);
      expect(() => validateRetention(10)).toThrow();
    });
  });
});
