import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
export default async function DriftPage() {
  const context = await getCurrentUserContext();
  const supabase = await createClient();

  const { data: insights } = await supabase
    .from("drift_insights")
    .select("*")
    .eq("organisation_id", context?.organisation.id);

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-[#253C2B] pb-4">
        <span className="font-mono text-xs font-bold text-[#D94C4C] uppercase tracking-wider">
          07 &mdash; BRAND DRIFT RADAR
        </span>
        <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
          SYSTEMIC BRAND DRIFT DETECTED
        </h1>
        <p className="text-xs sm:text-sm text-[#637367]">
          Automated pattern detection across historical audits identifying systemic voice deviations and reused expired metrics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {insights?.map((insight) => (
          <div key={insight.id} className="brutal-card p-5 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-extrabold px-2 py-0.5 bg-[#D94C4C] text-white">
                {insight.insight_type.replace(/_/g, " ").toUpperCase()}
              </span>
              <span className="font-mono text-xs font-bold text-[#17251C]">
                {insight.frequency}x OCCURRENCES
              </span>
            </div>

            <h3 className="font-bold text-sm text-[#17251C]">
              {insight.title}
            </h3>

            <p className="text-xs text-[#637367] leading-relaxed">
              {insight.summary}
            </p>

            <div className="p-3 bg-[#F4F1E8] brutal-border text-xs space-y-1">
              <span className="font-mono font-bold text-[10px] text-[#16834A] block uppercase">
                RECOMMENDATION:
              </span>
              <p className="text-[#17251C] font-medium text-xs">
                {insight.recommendation}
              </p>
            </div>

            <div className="pt-2 border-t border-[#DDEBDD] flex items-center justify-between font-mono text-[10px] text-[#637367]">
              <span>Departments: {Array.isArray(insight.affected_departments) ? insight.affected_departments.join(", ") : "All"}</span>
              {insight.is_seeded && (
                <span className="text-[#D94C4C] font-bold">SEEDED DEMO INSIGHT</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
