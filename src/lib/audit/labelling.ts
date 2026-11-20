export type AIStageOutcome =
  | "AI: used (primary model)"
  | "AI: used (fallback model)"
  | `AI: failed, rules only (${string})`
  | "AI: failed, rules only"
  | "AI: not used";

/**
 * Derives the honest report header and ENGINE MODE from the recorded audit stage outcomes.
 * - "LIVE AI (GEMINI)" if every AI stage that ran succeeded.
 * - "LIVE AI (GEMINI): partial, <stage> used rules only" if some failed.
 * - "RULES ONLY" if none succeeded or mode is demo.
 */
export function deriveEngineModeLabel(
  mode: "live_ai" | "demo" | string,
  stages: Array<{ stage_number: number; detail?: string | null }>
): string {
  if (mode !== "live_ai") {
    return "RULES ONLY";
  }

  // Stages that can run AI: Stage 2 (Claim Extraction) and Stage 4 (Brand Voice)
  const stage2 = stages.find((s) => s.stage_number === 2);
  const stage4 = stages.find((s) => s.stage_number === 4);

  const s2Success = Boolean(stage2?.detail && stage2.detail.includes("AI: used"));
  const s4Success = Boolean(stage4?.detail && stage4.detail.includes("AI: used"));

  const s2Failed = Boolean(stage2?.detail && stage2.detail.includes("AI: failed"));
  const s4Failed = Boolean(stage4?.detail && stage4.detail.includes("AI: failed"));

  // If every AI stage succeeded
  if (s2Success && s4Success) {
    return "LIVE AI (GEMINI)";
  }

  // If neither succeeded (none succeeded)
  if (!s2Success && !s4Success) {
    return "RULES ONLY";
  }

  // Partial outcome: identify which stage failed
  const failedNames: string[] = [];
  if (s4Failed || (!s4Success && s2Success)) {
    failedNames.push("voice analysis");
  }
  if (s2Failed || (!s2Success && s4Success)) {
    failedNames.push("claim extraction");
  }

  if (failedNames.length > 0) {
    return `LIVE AI (GEMINI): partial, ${failedNames.join(" & ")} used rules only`;
  }

  return "LIVE AI (GEMINI)";
}

/**
 * Extracts the real outcome prefix from an audit_stage detail field.
 */
export function extractStageOutcome(detail?: string | null): string {
  if (!detail) return "AI: not used";
  if (detail.includes("AI: used (fallback model)")) return "AI: used (fallback model)";
  if (detail.includes("AI: used (primary model)")) return "AI: used (primary model)";
  if (detail.includes("AI: used")) return "AI: used";
  if (detail.includes("AI: failed, rules only")) {
    const match = detail.match(/AI: failed, rules only(\s*\([^)]*\))?/);
    return match ? match[0] : "AI: failed, rules only";
  }
  if (detail.includes("AI: not used")) return "AI: not used";
  return "AI: not used";
}

/**
 * Computes the count of findings created by a specific stage.
 * Specifically, the voice stage counts all voice findings (both AI and rule findings).
 */
export function calculateStageFindingsCount(
  stageNumber: number,
  findings: Array<{ category: string }>
): number {
  switch (stageNumber) {
    case 1:
      return 0;
    case 2:
      return 0; // Claims are stored in extracted_claims table; findings created in Stage 3
    case 3:
      return findings.filter(
        (f) => f.category === "claims" || f.category === "claim_reliability"
      ).length;
    case 4:
      // Voice stage shows all its findings (AI + rule findings)
      return findings.filter((f) => f.category === "voice").length;
    case 5:
      return findings.filter((f) => f.category === "terminology").length;
    case 6:
      return findings.filter((f) => f.category === "accessibility").length;
    case 7:
      return findings.length;
    default:
      return 0;
  }
}
