import { AuditFindingRecord } from "./types";

export interface DatabaseTermRule {
  id: string;
  disallowed_term: string;
  approved_term: string;
  category: string;
  reason?: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export const REQUIRED_PERFORMANCE_DISCLAIMER =
  "Results based on an internal pilot; individual results may vary.";

/**
 * Checks terminology rules and required brand disclaimers.
 */
export function checkTerminologyDeterministic(
  content: string,
  termRules: DatabaseTermRule[],
  hasPerformanceClaims: boolean,
  startFindingIndex: number = 1
): AuditFindingRecord[] {
  const findings: AuditFindingRecord[] = [];
  let counter = startFindingIndex;

  // 1. Terminology replacements
  for (const rule of termRules) {
    const escaped = rule.disallowed_term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(content)) !== null) {
      const excerpt = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + excerpt.length;

      const severity =
        rule.severity ||
        (rule.disallowed_term.toLowerCase().includes("autonomous employee replacement") ||
        rule.disallowed_term.toLowerCase().includes("world's fastest") ||
        rule.disallowed_term.toLowerCase().includes("novacreative")
          ? "CRITICAL"
          : "MEDIUM");

      const explanation =
        rule.reason ||
        (rule as any).context ||
        `Disallowed terminology '${excerpt}'. Authorized standard is '${rule.approved_term}'.`;

      findings.push({
        id: `FIND-${String(counter++).padStart(3, "0")}`,
        category: "terminology",
        severity,
        excerpt,
        startIndex,
        endIndex,
        explanation,
        guidelineReference: "Corporate Terminology Registry",
        recommendedAction: `Replace with approved terminology: "${rule.approved_term}".`,
        suggestedReplacement: rule.approved_term,
        confidence: "high",
        isResolved: false,
      });
    }
  }

  // 2. Required Disclaimer Check for performance / pilot claims
  if (hasPerformanceClaims) {
    const normalizedContent = content.toLowerCase().replace(/\s+/g, " ");
    const normalizedDisclaimer = REQUIRED_PERFORMANCE_DISCLAIMER.toLowerCase().replace(/\s+/g, " ");

    const hasDisclaimer =
      normalizedContent.includes(normalizedDisclaimer) ||
      (normalizedContent.includes("internal pilot") && normalizedContent.includes("results may vary"));

    if (!hasDisclaimer) {
      findings.push({
        id: `FIND-${String(counter++).padStart(3, "0")}`,
        category: "terminology",
        severity: "HIGH",
        excerpt: content.slice(0, Math.min(60, content.length)),
        startIndex: 0,
        endIndex: Math.min(60, content.length),
        explanation: `Mandatory legal disclaimer missing for performance metric claim: "${REQUIRED_PERFORMANCE_DISCLAIMER}"`,
        guidelineReference: "Compliance & Mandatory Disclaimers §4.1",
        recommendedAction: `Append the required disclaimer: "${REQUIRED_PERFORMANCE_DISCLAIMER}"`,
        suggestedReplacement: `${content}\n\n*${REQUIRED_PERFORMANCE_DISCLAIMER}*`,
        confidence: "high",
        isResolved: false,
      });
    }
  }

  return findings;
}
