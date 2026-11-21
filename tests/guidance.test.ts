import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeChecklist, StoredMetricsData } from "@/lib/guidance/checklist";
import { HELP_ARTICLES, searchHelpArticles } from "@/lib/guidance/help-articles";
import { updateOnboardingAction } from "@/app/actions/onboarding";

// Mock Supabase server client for unit testing onboarding isolation
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Built-in User Guidance Tests (Part B)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Security: User cannot change another user's onboarding", () => {
    it("strictly isolates onboarding updates to the authenticated user ID", async () => {
      const { createClient } = await import("@/lib/supabase/server");

      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: { onboarding: { welcome_dismissed: false } },
        error: null,
      });
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation((col, val) => {
          return Promise.resolve({ data: null, error: null });
        }),
      });

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-alice-123", email: "alice@example.com" } },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
          update: mockUpdate,
        }),
      };

      (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);

      // Attempt to update onboarding
      const result = await updateOnboardingAction({ welcome_dismissed: true });

      expect(result.success).toBe(true);
      expect(result.onboarding?.welcome_dismissed).toBe(true);

      // Verify that update was executed on 'profiles' table
      expect(mockSupabase.from).toHaveBeenCalledWith("profiles");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          onboarding: expect.objectContaining({ welcome_dismissed: true }),
        })
      );

      // Verify strict eq check used the authenticated user id "user-alice-123"
      const updateResult = mockUpdate.mock.results[0].value;
      expect(updateResult.eq).toHaveBeenCalledWith("id", "user-alice-123");
    });

    it("rejects onboarding updates when unauthenticated", async () => {
      const { createClient } = await import("@/lib/supabase/server");

      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: new Error("Unauthorized"),
          }),
        },
      };

      (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(mockSupabase);

      const result = await updateOnboardingAction({ welcome_dismissed: true });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Authentication required/i);
    });
  });

  describe("2. Checklist completion logic computed from real stored data", () => {
    it("computes Creator checklist milestones based on activity counts", () => {
      const emptyData: StoredMetricsData = {
        auditsCount: 0,
        rewritesAcceptedCount: 0,
        submissionsCount: 0,
        verifiedClaimsCount: 0,
        approvedFactsCount: 0,
        sourceDocsCount: 0,
        driftInsightsCount: 0,
        resolvedFindingsCount: 0,
      };

      const emptyItems = computeChecklist("creator", emptyData);
      expect(emptyItems.length).toBe(4);
      expect(emptyItems.every((item) => item.isCompleted === false)).toBe(true);

      const activeData: StoredMetricsData = {
        auditsCount: 3,
        rewritesAcceptedCount: 1,
        submissionsCount: 2,
        verifiedClaimsCount: 5,
        approvedFactsCount: 10,
        sourceDocsCount: 2,
        driftInsightsCount: 1,
        resolvedFindingsCount: 1,
      };

      const completedItems = computeChecklist("creator", activeData);
      expect(completedItems.every((item) => item.isCompleted === true)).toBe(true);
    });

    it("computes Reviewer checklist milestones correctly", () => {
      const partialData: StoredMetricsData = {
        auditsCount: 2,
        rewritesAcceptedCount: 0,
        submissionsCount: 1,
        verifiedClaimsCount: 4,
        approvedFactsCount: 5,
        sourceDocsCount: 1,
        driftInsightsCount: 0,
        resolvedFindingsCount: 0,
      };

      const reviewerItems = computeChecklist("reviewer", partialData);
      const queueItem = reviewerItems.find((i) => i.id === "reviewer-inspect-queue");
      const evidenceItem = reviewerItems.find((i) => i.id === "reviewer-check-evidence");
      const decisionItem = reviewerItems.find((i) => i.id === "reviewer-record-decision");

      expect(queueItem?.isCompleted).toBe(true);
      expect(evidenceItem?.isCompleted).toBe(true);
      expect(decisionItem?.isCompleted).toBe(false); // No resolved findings yet
    });

    it("computes Brand Manager checklist milestones correctly", () => {
      const managerData: StoredMetricsData = {
        auditsCount: 1,
        rewritesAcceptedCount: 0,
        submissionsCount: 1,
        verifiedClaimsCount: 2,
        approvedFactsCount: 6,
        sourceDocsCount: 1,
        driftInsightsCount: 2,
        resolvedFindingsCount: 0,
      };

      const managerItems = computeChecklist("brand_manager", managerData);
      expect(managerItems.length).toBe(4);
      expect(managerItems.find((i) => i.id === "manager-knowledge-vault")?.isCompleted).toBe(true);
      expect(managerItems.find((i) => i.id === "manager-source-docs")?.isCompleted).toBe(true);
      expect(managerItems.find((i) => i.id === "manager-drift-insights")?.isCompleted).toBe(true);
    });
  });

  describe("3. Help Centre client search and category filtering", () => {
    it("returns all catalogued articles when query is empty", () => {
      const results = searchHelpArticles("");
      expect(results.length).toBe(HELP_ARTICLES.length);
    });

    it("filters articles by text query across title, summary, tags, and content", () => {
      const scoreResults = searchHelpArticles("integrity score");
      expect(scoreResults.length).toBeGreaterThan(0);
      expect(scoreResults.some((a) => a.hash === "integrity-score")).toBe(true);

      const criticalResults = searchHelpArticles("critical");
      expect(criticalResults.length).toBeGreaterThan(0);
      expect(criticalResults.some((a) => a.hash === "critical-finding-block" || a.hash === "severity-levels")).toBe(true);

      const hedgeResults = searchHelpArticles("hedged");
      expect(hedgeResults.length).toBeGreaterThan(0);
      expect(hedgeResults.some((a) => a.hash === "audit-engine-modes")).toBe(true);
    });

    it("filters articles by category", () => {
      const roleGuides = searchHelpArticles("", "Role Guides");
      expect(roleGuides.length).toBeGreaterThan(0);
      expect(roleGuides.every((a) => a.category === "Role Guides")).toBe(true);

      const systemArticles = searchHelpArticles("", "System & AI");
      expect(systemArticles.length).toBeGreaterThan(0);
      expect(systemArticles.every((a) => a.category === "System & AI")).toBe(true);
    });
  });
});
