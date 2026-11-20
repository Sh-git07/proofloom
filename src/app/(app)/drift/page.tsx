import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { canManageKnowledge } from "@/lib/permissions";
import { BrandDriftWorkbench, DriftInsightItem, ClaritySuggestionItem } from "@/components/drift/BrandDriftWorkbench";

export default async function DriftPage() {
  const context = await getCurrentUserContext();
  const supabase = await createClient();
  const orgId = context?.organisation.id;

  // 1-3. Fetch drift insights, total audits count, and clarity suggestions in parallel
  const [{ data: rawInsights }, { count: auditsCount }, { data: rawSuggestions }] = await Promise.all([
    supabase
      .from("drift_insights")
      .select("*")
      .eq("organisation_id", orgId)
      .order("frequency", { ascending: false }),
    supabase
      .from("audits")
      .select("*", { count: "exact", head: true })
      .eq("organisation_id", orgId),
    supabase
      .from("clarity_suggestions")
      .select("*")
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false }),
  ]);

  const insights: DriftInsightItem[] = (rawInsights || []).map((d) => ({
    id: d.id,
    title: d.title,
    summary: d.summary,
    insight_type: d.insight_type,
    frequency: d.frequency || 1,
    affected_departments: d.affected_departments || [],
    recommendation: d.recommendation,
    is_seeded: d.is_seeded || false,
    created_at: d.created_at,
  }));

  const claritySuggestions: ClaritySuggestionItem[] = (rawSuggestions || []).map((s) => ({
    id: s.id,
    rule_label: s.rule_label,
    findings_count: s.findings_count,
    dismissed_count: s.dismissed_count,
    challenged_count: s.challenged_count,
    reversed_count: s.reversed_count,
    suggestion_text: s.suggestion_text,
    status: s.status,
    created_at: s.created_at,
    rejection_reason: s.rejection_reason,
  }));

  const canManage = context ? canManageKnowledge(context.role) : false;

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-[#253C2B] pb-4">
        <span className="font-mono text-xs font-bold text-[#D94C4C] uppercase tracking-wider">
          07 &mdash; BRAND DRIFT RADAR
        </span>
        <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
          SYSTEMIC BRAND INTEGRITY RADAR
        </h1>
        <p className="text-xs sm:text-sm text-[#637367]">
          Automated pattern detection across historical audits identifying systemic voice deviations, repeatedly reused expired metrics, and missing legal disclaimers.
        </p>
      </div>

      <BrandDriftWorkbench
        initialInsights={insights}
        totalAuditsCount={auditsCount || 0}
        claritySuggestions={claritySuggestions}
        canManage={canManage}
      />
    </div>
  );
}
