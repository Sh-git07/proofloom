import { describe, it, expect } from "vitest";

describe("Phase 5: Intelligence (Brand Drift & Governance Analytics)", () => {
  describe("Brand Drift Pattern Clustering Heuristics", () => {
    interface FindingRecord {
      id: string;
      excerpt: string;
      category: string;
      department: string;
    }

    function clusterDriftPatterns(findings: FindingRecord[], threshold = 2) {
      const groups = new Map<string, { count: number; departments: Set<string>; category: string }>();

      findings.forEach((f) => {
        const key = f.excerpt.trim().toLowerCase();
        if (!groups.has(key)) {
          groups.set(key, { count: 0, departments: new Set(), category: f.category });
        }
        const g = groups.get(key)!;
        g.count += 1;
        g.departments.add(f.department);
      });

      return Array.from(groups.entries())
        .filter(([, g]) => g.count >= threshold)
        .map(([excerpt, g]) => ({
          excerpt,
          frequency: g.count,
          affectedDepartments: Array.from(g.departments),
          insightType:
            g.category === "claim_reliability"
              ? "expired_stat_reuse"
              : g.category === "voice"
              ? "voice_deviation"
              : "repeated_violation",
        }));
    }

    it("detects systemic drift when the same finding excerpt repeats across multiple audits", () => {
      const mockFindings: FindingRecord[] = [
        { id: "1", excerpt: "Over 8,000 businesses trust us", category: "claim_reliability", department: "Product Marketing" },
        { id: "2", excerpt: "destroy the competition", category: "voice", department: "Growth" },
        { id: "3", excerpt: "Over 8,000 businesses trust us", category: "claim_reliability", department: "Growth" },
        { id: "4", excerpt: "Over 8,000 businesses trust us", category: "claim_reliability", department: "Demand Gen" },
        { id: "5", excerpt: "destroy the competition", category: "voice", department: "Sales" },
        { id: "6", excerpt: "unique one-off statement", category: "voice", department: "PR" },
      ];

      const clusters = clusterDriftPatterns(mockFindings, 2);

      expect(clusters.length).toBe(2);

      const statCluster = clusters.find((c) => c.excerpt.includes("8,000"));
      expect(statCluster).toBeDefined();
      expect(statCluster?.frequency).toBe(3);
      expect(statCluster?.affectedDepartments).toContain("Product Marketing");
      expect(statCluster?.affectedDepartments).toContain("Growth");
      expect(statCluster?.affectedDepartments).toContain("Demand Gen");
      expect(statCluster?.insightType).toBe("expired_stat_reuse");

      const voiceCluster = clusters.find((c) => c.excerpt.includes("destroy"));
      expect(voiceCluster).toBeDefined();
      expect(voiceCluster?.frequency).toBe(2);
      expect(voiceCluster?.insightType).toBe("voice_deviation");
    });

    it("ignores isolated single findings that do not meet systemic drift threshold", () => {
      const mockFindings: FindingRecord[] = [
        { id: "1", excerpt: "isolated sentence 1", category: "voice", department: "Legal" },
        { id: "2", excerpt: "isolated sentence 2", category: "voice", department: "Legal" },
      ];

      const clusters = clusterDriftPatterns(mockFindings, 2);
      expect(clusters.length).toBe(0);
    });
  });

  describe("Governance Analytics Aggregation", () => {
    function calculateDepartmentIntegrity(
      audits: Array<{ department: string; score: number }>
    ) {
      const map = new Map<string, { total: number; count: number }>();

      audits.forEach((a) => {
        if (!map.has(a.department)) {
          map.set(a.department, { total: 0, count: 0 });
        }
        const entry = map.get(a.department)!;
        entry.total += a.score;
        entry.count += 1;
      });

      return Array.from(map.entries()).map(([dept, val]) => ({
        department: dept,
        averageScore: Math.round(val.total / val.count),
        auditCount: val.count,
      }));
    }

    it("correctly computes department compliance averages and audit counts", () => {
      const mockAudits = [
        { department: "Product Marketing", score: 80 },
        { department: "Product Marketing", score: 90 },
        { department: "Growth", score: 60 },
        { department: "Growth", score: 70 },
        { department: "Legal", score: 95 },
      ];

      const result = calculateDepartmentIntegrity(mockAudits);

      const mktg = result.find((r) => r.department === "Product Marketing");
      expect(mktg?.averageScore).toBe(85);
      expect(mktg?.auditCount).toBe(2);

      const growth = result.find((r) => r.department === "Growth");
      expect(growth?.averageScore).toBe(65);
      expect(growth?.auditCount).toBe(2);

      const legal = result.find((r) => r.department === "Legal");
      expect(legal?.averageScore).toBe(95);
      expect(legal?.auditCount).toBe(1);
    });
  });

  describe("Governance Report Generator", () => {
    function generateReportSummary({
      orgName,
      averageScore,
      totalAudits,
    }: {
      orgName: string;
      averageScore: number;
      totalAudits: number;
    }) {
      return `# PROOFLOOM Brand Integrity & Governance Report
**Organisation:** ${orgName}
- **Overall Brand Integrity Index:** ${averageScore}/100
- **Total Audits Executed:** ${totalAudits}
`;
    }

    it("formats executive markdown report with exact required sections", () => {
      const report = generateReportSummary({
        orgName: "Nova Creative",
        averageScore: 84,
        totalAudits: 12,
      });

      expect(report).toContain("PROOFLOOM Brand Integrity & Governance Report");
      expect(report).toContain("**Organisation:** Nova Creative");
      expect(report).toContain("84/100");
      expect(report).toContain("12");
    });
  });
});
