import { AuditDimension, AuditFindingRecord, AuditScores, AuditSeverity } from "./types";

export const DEDUCTION_MAP: Record<AuditSeverity, number> = {
  CRITICAL: 25,
  HIGH: 15,
  MEDIUM: 8,
  LOW: 3,
  INFO: 0,
};

export const DEFAULT_WEIGHTS: Record<AuditDimension, number> = {
  voice: 25,
  claims: 35,
  terminology: 20,
  accessibility: 10,
  visual: 10,
};

export const SCORING_FOOTNOTE =
  "Internal decision-support metric, not a guarantee of compliance or truth.";

/**
 * Calculates category breakdown and overall score based on Section 8.4 specification.
 */
export function calculateAuditScores(
  findings: AuditFindingRecord[],
  checkedDimensions: AuditDimension[] = ["voice", "claims", "terminology", "accessibility"],
  customWeights?: Partial<Record<AuditDimension, number>>
): AuditScores {
  const weights = { ...DEFAULT_WEIGHTS, ...customWeights };

  // Calculate per-dimension scores (starting at 100)
  const dimensionScores: Record<AuditDimension, number> = {
    voice: 100,
    claims: 100,
    terminology: 100,
    accessibility: 100,
    visual: 100,
  };

  for (const finding of findings) {
    if (finding.isResolved) continue; // Resolved findings do not deduct points
    const deduction = DEDUCTION_MAP[finding.severity] ?? 0;
    dimensionScores[finding.category] = Math.max(0, dimensionScores[finding.category] - deduction);
  }

  // Renormalize weights across checked dimensions only
  let totalCheckedWeight = 0;
  for (const dim of checkedDimensions) {
    totalCheckedWeight += weights[dim] ?? 0;
  }

  let weightedSum = 0;
  if (totalCheckedWeight > 0) {
    for (const dim of checkedDimensions) {
      const dimWeight = weights[dim] ?? 0;
      weightedSum += dimensionScores[dim] * (dimWeight / totalCheckedWeight);
    }
  }

  const overall = Math.min(100, Math.max(0, Math.round(weightedSum)));

  return {
    overall,
    voice: dimensionScores.voice,
    claims: dimensionScores.claims,
    terminology: dimensionScores.terminology,
    accessibility: dimensionScores.accessibility,
    visual: checkedDimensions.includes("visual") ? dimensionScores.visual : null,
    checkedDimensions,
  };
}
