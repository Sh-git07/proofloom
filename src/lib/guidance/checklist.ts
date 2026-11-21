import { OrgRole } from "@/lib/permissions";

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  href: string;
  isCompleted: boolean;
}

export interface StoredMetricsData {
  auditsCount: number;
  rewritesAcceptedCount: number;
  submissionsCount: number;
  verifiedClaimsCount: number;
  approvedFactsCount: number;
  sourceDocsCount: number;
  driftInsightsCount: number;
  resolvedFindingsCount: number;
  teamMembersCount?: number;
}

export function computeChecklist(
  role: OrgRole,
  data: StoredMetricsData
): ChecklistItem[] {
  switch (role) {
    case "creator":
      return [
        {
          id: "creator-first-audit",
          label: "Run your first Brand Audit",
          description: "Submit a piece of marketing copy in Content Studio to test automated verification.",
          href: "/studio",
          isCompleted: data.auditsCount > 0,
        },
        {
          id: "creator-accept-rewrite",
          label: "Accept a suggested rewrite",
          description: "Use one-click remediation to align flagged text with brand tone and guidelines.",
          href: "/audits",
          isCompleted: data.rewritesAcceptedCount > 0 || data.resolvedFindingsCount > 0,
        },
        {
          id: "creator-submit-review",
          label: "Submit content for review",
          description: "Handoff an audited, compliant draft to designated reviewers for publication sign-off.",
          href: "/studio",
          isCompleted: data.submissionsCount > 0,
        },
        {
          id: "creator-inspect-provenance",
          label: "Explore Claim Provenance",
          description: "Trace extracted factual statements back to their verified source documentation.",
          href: "/provenance",
          isCompleted: data.verifiedClaimsCount > 0 || data.auditsCount > 0,
        },
      ];

    case "reviewer":
      return [
        {
          id: "reviewer-inspect-queue",
          label: "Inspect the Review Queue",
          description: "Review pending content drafts submitted across departments for brand sign-off.",
          href: "/reviews",
          isCompleted: data.submissionsCount > 0 || data.auditsCount > 0,
        },
        {
          id: "reviewer-check-evidence",
          label: "Verify claim evidence citations",
          description: "Examine side-by-side excerpts and truth records for factual accuracy.",
          href: "/provenance",
          isCompleted: data.verifiedClaimsCount > 0,
        },
        {
          id: "reviewer-record-decision",
          label: "Record an approval or rejection",
          description: "Sign off on publication-ready assets or request itemized corrections.",
          href: "/reviews",
          isCompleted: data.submissionsCount > 0 && data.resolvedFindingsCount > 0,
        },
        {
          id: "reviewer-resolve-finding",
          label: "Resolve or adjudicate an audit finding",
          description: "Review creator appeals in Brand Memory Court or mark remediation complete.",
          href: "/reviews",
          isCompleted: data.resolvedFindingsCount > 0,
        },
      ];

    case "brand_manager":
      return [
        {
          id: "manager-knowledge-vault",
          label: "Review approved brand facts",
          description: "Maintain the single source of truth for benchmark metrics and corporate claims.",
          href: "/knowledge",
          isCompleted: data.approvedFactsCount > 0,
        },
        {
          id: "manager-source-docs",
          label: "Upload or verify a source document",
          description: "Ingest PDF/DOCX documentation to extract candidate facts with provenance.",
          href: "/knowledge",
          isCompleted: data.sourceDocsCount > 0,
        },
        {
          id: "manager-assign-reviewer",
          label: "Distribute review assignments",
          description: "Assign content drafts to qualified reviewers to maintain turnaround velocity.",
          href: "/reviews",
          isCompleted: data.submissionsCount > 0,
        },
        {
          id: "manager-drift-insights",
          label: "Inspect Brand Drift and guideline clarity",
          description: "Analyze recurring policy violations to refine wording and reduce friction.",
          href: "/drift",
          isCompleted: data.driftInsightsCount > 0,
        },
      ];

    case "admin":
      return [
        {
          id: "admin-team-access",
          label: "Review team access and roles",
          description: "Configure role-based access control and assign departmental scopes.",
          href: "/team",
          isCompleted: (data.teamMembersCount ?? 1) > 0,
        },
        {
          id: "admin-ai-settings",
          label: "Verify AI model configuration & health",
          description: "Test hedged connectivity to Gemini primary and fallback models in Settings.",
          href: "/settings",
          isCompleted: true,
        },
        {
          id: "admin-governance-insights",
          label: "Review organization Governance Insights",
          description: "Track audit throughput, pass rates, and compliance velocity metrics.",
          href: "/insights",
          isCompleted: data.auditsCount > 0,
        },
        {
          id: "admin-system-health",
          label: "Inspect audit trail & system integrity",
          description: "Review immutable activity logs and ensure system-wide tamper resistance.",
          href: "/settings",
          isCompleted: data.auditsCount > 0 || data.approvedFactsCount > 0,
        },
      ];

    default:
      return [];
  }
}
