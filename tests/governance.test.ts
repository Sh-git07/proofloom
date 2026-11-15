import { describe, it, expect } from "vitest";
import {
  canReviewContent,
  canAssignReviewers,
  canManageMembers,
  canOverrideCritical,
  canDecideChallenges,
  OrgRole,
} from "../src/lib/permissions";

describe("Phase 4 Governance & Sign-Off Verification", () => {
  describe("Review Queue Role Capabilities", () => {
    it("permits only reviewer, brand_manager, and admin to review content", () => {
      expect(canReviewContent("reviewer")).toBe(true);
      expect(canReviewContent("brand_manager")).toBe(true);
      expect(canReviewContent("admin")).toBe(true);
      expect(canReviewContent("creator")).toBe(false);
    });

    it("permits only brand_manager and admin to assign reviewers", () => {
      expect(canAssignReviewers("admin")).toBe(true);
      expect(canAssignReviewers("brand_manager")).toBe(true);
      expect(canAssignReviewers("reviewer")).toBe(false);
      expect(canAssignReviewers("creator")).toBe(false);
    });

    it("permits only reviewer, brand_manager, and admin to decide Brand Memory Court challenges", () => {
      expect(canDecideChallenges("reviewer")).toBe(true);
      expect(canDecideChallenges("brand_manager")).toBe(true);
      expect(canDecideChallenges("admin")).toBe(true);
      expect(canDecideChallenges("creator")).toBe(false);
    });

    it("restricts critical overrides strictly to admin with valid rationale", () => {
      expect(canOverrideCritical("admin", "Legal approved exception memo #1234").allowed).toBe(true);
      expect(canOverrideCritical("admin", "Too short").allowed).toBe(false);
      expect(canOverrideCritical("brand_manager", "Legal approved exception memo #1234").allowed).toBe(false);
      expect(canOverrideCritical("reviewer", "Legal approved exception memo #1234").allowed).toBe(false);
      expect(canOverrideCritical("creator", "Legal approved exception memo #1234").allowed).toBe(false);
    });

    it("restricts team management strictly to admin", () => {
      expect(canManageMembers("admin")).toBe(true);
      expect(canManageMembers("brand_manager")).toBe(false);
      expect(canManageMembers("reviewer")).toBe(false);
      expect(canManageMembers("creator")).toBe(false);
    });
  });

  describe("Critical Finding Override Gate Logic (PostgreSQL Function Simulation)", () => {
    function simulateRecordApprovalDecision({
      userRole,
      decision,
      reason,
      unresolvedCriticalCount,
      isOverride,
      overrideReason,
    }: {
      userRole: OrgRole;
      decision: "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
      reason: string;
      unresolvedCriticalCount: number;
      isOverride?: boolean;
      overrideReason?: string;
    }) {
      if (!canReviewContent(userRole)) {
        throw new Error("Unauthorized to review content");
      }

      if (!reason || reason.trim().length < 10) {
        throw new Error("A reason of at least 10 characters is required");
      }

      if (decision === "APPROVED" && unresolvedCriticalCount > 0) {
        if (!isOverride) {
          throw new Error("Cannot approve content with unresolved CRITICAL findings without an administrative override.");
        }
        if (userRole !== "admin") {
          throw new Error("Only an administrator can override critical findings.");
        }
        if (!overrideReason || overrideReason.trim().length < 15) {
          throw new Error("Critical override requires a justified rationale of at least 15 characters.");
        }
      }

      return {
        success: true,
        status: decision,
        override_applied: Boolean(isOverride && unresolvedCriticalCount > 0),
      };
    }

    it("allows reviewer to approve clean content with no critical findings", () => {
      const res = simulateRecordApprovalDecision({
        userRole: "reviewer",
        decision: "APPROVED",
        reason: "All guidelines verified and factual statements checked against vault.",
        unresolvedCriticalCount: 0,
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("APPROVED");
      expect(res.override_applied).toBe(false);
    });

    it("blocks reviewer from approving content with unresolved critical findings", () => {
      expect(() =>
        simulateRecordApprovalDecision({
          userRole: "reviewer",
          decision: "APPROVED",
          reason: "Attempting approval anyway.",
          unresolvedCriticalCount: 2,
        })
      ).toThrow("Cannot approve content with unresolved CRITICAL findings without an administrative override.");
    });

    it("blocks brand manager from overriding critical findings (must be admin)", () => {
      expect(() =>
        simulateRecordApprovalDecision({
          userRole: "brand_manager",
          decision: "APPROVED",
          reason: "Ready for launch.",
          unresolvedCriticalCount: 1,
          isOverride: true,
          overrideReason: "Overriding as brand manager with sufficient characters.",
        })
      ).toThrow("Only an administrator can override critical findings.");
    });

    it("blocks admin from overriding if justification is under 15 characters", () => {
      expect(() =>
        simulateRecordApprovalDecision({
          userRole: "admin",
          decision: "APPROVED",
          reason: "Approved by leadership.",
          unresolvedCriticalCount: 1,
          isOverride: true,
          overrideReason: "Too short",
        })
      ).toThrow("Critical override requires a justified rationale of at least 15 characters.");
    });

    it("succeeds when admin provides valid override rationale >= 15 characters", () => {
      const res = simulateRecordApprovalDecision({
        userRole: "admin",
        decision: "APPROVED",
        reason: "Overriding due to verified offline legal clearance.",
        unresolvedCriticalCount: 1,
        isOverride: true,
        overrideReason: "Legal counsel authorized exception under signed NDA memo 2026-B.",
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("APPROVED");
      expect(res.override_applied).toBe(true);
    });

    it("allows reviewer to request revisions or reject even when critical findings exist", () => {
      const rejectRes = simulateRecordApprovalDecision({
        userRole: "reviewer",
        decision: "REJECTED",
        reason: "Contains contradicted claims; please rewrite before resubmission.",
        unresolvedCriticalCount: 3,
      });
      expect(rejectRes.success).toBe(true);
      expect(rejectRes.status).toBe("REJECTED");

      const reviseRes = simulateRecordApprovalDecision({
        userRole: "reviewer",
        decision: "REVISION_REQUESTED",
        reason: "Please resolve the unverified statistics on slide 4.",
        unresolvedCriticalCount: 1,
      });
      expect(reviseRes.success).toBe(true);
      expect(reviseRes.status).toBe("REVISION_REQUESTED");
    });
  });
});
