import { describe, it, expect } from "vitest";
import {
  canManageSettings,
  canManageMembers,
  canManageKnowledge,
  canSubmitContent,
  canAssignReviewers,
  canReviewContent,
  canDecideChallenges,
  canOverrideCritical,
  canViewAllAudits,
  canChallengeFinding,
  canAcceptRewrite,
} from "../src/lib/permissions";

describe("PROOFLOOM Permission Matrix", () => {
  describe("Manage members/roles/settings", () => {
    it("allows only admin", () => {
      expect(canManageSettings("admin")).toBe(true);
      expect(canManageSettings("brand_manager")).toBe(false);
      expect(canManageSettings("creator")).toBe(false);
      expect(canManageSettings("reviewer")).toBe(false);

      expect(canManageMembers("admin")).toBe(true);
      expect(canManageMembers("brand_manager")).toBe(false);
      expect(canManageMembers("creator")).toBe(false);
      expect(canManageMembers("reviewer")).toBe(false);
    });
  });

  describe("Manage guidelines, facts, terminology, assets, documents", () => {
    it("allows admin and brand_manager only", () => {
      expect(canManageKnowledge("admin")).toBe(true);
      expect(canManageKnowledge("brand_manager")).toBe(true);
      expect(canManageKnowledge("creator")).toBe(false);
      expect(canManageKnowledge("reviewer")).toBe(false);
    });
  });

  describe("Submit content, run audits, accept rewrites, challenge findings", () => {
    it("allows admin, brand_manager, and creator", () => {
      expect(canSubmitContent("admin")).toBe(true);
      expect(canSubmitContent("brand_manager")).toBe(true);
      expect(canSubmitContent("creator")).toBe(true);
      expect(canSubmitContent("reviewer")).toBe(false);

      expect(canChallengeFinding("creator")).toBe(true);
      expect(canAcceptRewrite("creator")).toBe(true);
    });
  });

  describe("Assign reviewers", () => {
    it("allows admin and brand_manager", () => {
      expect(canAssignReviewers("admin")).toBe(true);
      expect(canAssignReviewers("brand_manager")).toBe(true);
      expect(canAssignReviewers("creator")).toBe(false);
      expect(canAssignReviewers("reviewer")).toBe(false);
    });
  });

  describe("Review content and decide challenges (Brand Memory Court)", () => {
    it("allows admin, brand_manager, and reviewer", () => {
      expect(canReviewContent("admin")).toBe(true);
      expect(canReviewContent("brand_manager")).toBe(true);
      expect(canReviewContent("reviewer")).toBe(true);
      expect(canReviewContent("creator")).toBe(false);

      expect(canDecideChallenges("admin")).toBe(true);
      expect(canDecideChallenges("brand_manager")).toBe(true);
      expect(canDecideChallenges("reviewer")).toBe(true);
      expect(canDecideChallenges("creator")).toBe(false);
    });
  });

  describe("Override critical-finding restriction", () => {
    it("strictly requires admin role and >= 15 char justification", () => {
      // Non-admins fail regardless of reason
      expect(canOverrideCritical("brand_manager", "Valid reason of sufficient length").allowed).toBe(false);
      expect(canOverrideCritical("reviewer", "Valid reason of sufficient length").allowed).toBe(false);
      expect(canOverrideCritical("creator", "Valid reason of sufficient length").allowed).toBe(false);

      // Admin with short or empty reason fails
      expect(canOverrideCritical("admin", "").allowed).toBe(false);
      expect(canOverrideCritical("admin", "Too short").allowed).toBe(false);
      expect(canOverrideCritical("admin", "12345678901234").allowed).toBe(false);

      // Admin with >= 15 char reason succeeds
      const result = canOverrideCritical("admin", "Approved by executive legal counsel for exception");
      expect(result.allowed).toBe(true);
    });
  });

  describe("View all audits / analytics", () => {
    it("allows admin and brand_manager across all items", () => {
      expect(canViewAllAudits("admin")).toBe(true);
      expect(canViewAllAudits("brand_manager")).toBe(true);
      expect(canViewAllAudits("creator")).toBe(false);
      expect(canViewAllAudits("reviewer")).toBe(false);
    });
  });
});
