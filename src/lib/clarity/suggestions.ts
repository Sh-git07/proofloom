/**
 * Guideline clarity suggestion engine — rule-based, no AI.
 *
 * For each brand_guideline and terminology_rule in an org, counts over the
 * last 90 days:
 *   - findings:   audit_findings linked to the rule (by guideline_reference match)
 *   - dismissed:  findings marked is_resolved = true without a challenge
 *   - challenged: finding_challenges submitted against those findings
 *   - reversed:   challenge_decisions with decision REVERSE or ACCEPT_AS_EXCEPTION
 *
 * Threshold: findings >= 3 AND (dismissed + challenged) >= 2
 */
import { SupabaseClient } from "@supabase/supabase-js";

export interface ClaritySuggestion {
  organisation_id: string;
  guideline_id: string | null;
  terminology_rule_id: string | null;
  rule_label: string;
  findings_count: number;
  dismissed_count: number;
  challenged_count: number;
  reversed_count: number;
  suggestion_text: string;
  status: "OPEN";
  window_start: string;
}

const WINDOW_DAYS = 90;
const MIN_FINDINGS = 3;
const MIN_FRICTION = 2; // dismissals + challenges

function windowStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - WINDOW_DAYS);
  return d.toISOString();
}

/**
 * Compute clarity suggestions for the organisation.
 * Returns suggestions that meet the threshold, deduped against existing OPEN ones.
 */
export async function computeClaritySuggestions(
  supabase: SupabaseClient,
  orgId: string
): Promise<ClaritySuggestion[]> {
  const since = windowStart();
  const suggestions: ClaritySuggestion[] = [];

  // ---- Terminology rules ----
  const { data: termRules } = await supabase
    .from("terminology_rules")
    .select("id, disallowed_term, approved_term")
    .eq("organisation_id", orgId);

  for (const rule of termRules || []) {
    const label = `${rule.disallowed_term} → ${rule.approved_term}`;

    // Findings referencing this rule (by guideline_reference containing the disallowed term)
    const { data: findings } = await supabase
      .from("audit_findings")
      .select("id, is_resolved")
      .eq("organisation_id", orgId)
      .eq("category", "terminology")
      .ilike("guideline_reference", `%${rule.disallowed_term}%`)
      .gte("created_at" as any, since);

    const findingIds = (findings || []).map((f) => f.id as string);
    const findingsCount = findingIds.length;
    if (findingsCount < MIN_FINDINGS) continue;

    const dismissedCount = (findings || []).filter((f) => f.is_resolved).length;

    let challengedCount = 0;
    let reversedCount = 0;
    if (findingIds.length > 0) {
      const { data: challenges } = await supabase
        .from("finding_challenges")
        .select("id, status, challenge_decisions(decision)")
        .in("finding_id", findingIds);

      challengedCount = (challenges || []).length;
      reversedCount = (challenges || []).filter((c) => {
        const dec = (c.challenge_decisions as any)?.[0]?.decision;
        return dec === "REVERSE" || dec === "ACCEPT_AS_EXCEPTION";
      }).length;
    }

    if (dismissedCount + challengedCount < MIN_FRICTION) continue;

    suggestions.push({
      organisation_id: orgId,
      guideline_id: null,
      terminology_rule_id: rule.id,
      rule_label: label,
      findings_count: findingsCount,
      dismissed_count: dismissedCount,
      challenged_count: challengedCount,
      reversed_count: reversedCount,
      suggestion_text:
        `Terminology rule "${label}" was flagged ${findingsCount} time${findingsCount !== 1 ? "s" : ""} ` +
        `and challenged or dismissed ${dismissedCount + challengedCount} time${dismissedCount + challengedCount !== 1 ? "s" : ""} ` +
        `in the last ${WINDOW_DAYS} days. Consider clarifying its wording or adding a usage example.`,
      status: "OPEN",
      window_start: since,
    });
  }

  // ---- Brand guidelines ----
  const { data: guidelines } = await supabase
    .from("brand_guidelines")
    .select("id, title")
    .eq("organisation_id", orgId)
    .eq("status", "published");

  for (const guideline of guidelines || []) {
    const { data: findings } = await supabase
      .from("audit_findings")
      .select("id, is_resolved")
      .eq("organisation_id", orgId)
      .ilike("guideline_reference", `%${guideline.title}%`)
      .gte("created_at" as any, since);

    const findingIds = (findings || []).map((f) => f.id as string);
    const findingsCount = findingIds.length;
    if (findingsCount < MIN_FINDINGS) continue;

    const dismissedCount = (findings || []).filter((f) => f.is_resolved).length;

    let challengedCount = 0;
    let reversedCount = 0;
    if (findingIds.length > 0) {
      const { data: challenges } = await supabase
        .from("finding_challenges")
        .select("id, challenge_decisions(decision)")
        .in("finding_id", findingIds);

      challengedCount = (challenges || []).length;
      reversedCount = (challenges || []).filter((c) => {
        const dec = (c.challenge_decisions as any)?.[0]?.decision;
        return dec === "REVERSE" || dec === "ACCEPT_AS_EXCEPTION";
      }).length;
    }

    if (dismissedCount + challengedCount < MIN_FRICTION) continue;

    suggestions.push({
      organisation_id: orgId,
      guideline_id: guideline.id,
      terminology_rule_id: null,
      rule_label: guideline.title,
      findings_count: findingsCount,
      dismissed_count: dismissedCount,
      challenged_count: challengedCount,
      reversed_count: reversedCount,
      suggestion_text:
        `Guideline "${guideline.title}" was flagged ${findingsCount} time${findingsCount !== 1 ? "s" : ""} ` +
        `and challenged or dismissed ${dismissedCount + challengedCount} time${dismissedCount + challengedCount !== 1 ? "s" : ""} ` +
        `in the last ${WINDOW_DAYS} days. Consider clarifying its wording or adding an example.`,
      status: "OPEN",
      window_start: since,
    });
  }

  return suggestions;
}

/**
 * Persist suggestions, skipping ones that already exist (upsert with DO NOTHING).
 */
export async function saveClaritySuggestions(
  supabase: SupabaseClient,
  suggestions: ClaritySuggestion[]
): Promise<number> {
  if (suggestions.length === 0) return 0;
  const { error } = await supabase.from("clarity_suggestions").upsert(suggestions, {
    onConflict: "organisation_id,guideline_id,terminology_rule_id,window_start",
    ignoreDuplicates: true,
  });
  if (error) console.error("[clarity] upsert error:", error.message);
  return suggestions.length;
}
