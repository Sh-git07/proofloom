import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
export default async function InsightsPage() {
  const context = await getCurrentUserContext();
  const supabase = await createClient();

  const { data: audits } = await supabase
    .from("audits")
    .select("overall_score, status, created_at, content_items(department)")
    .eq("organisation_id", context?.organisation.id);

  const total = audits?.length || 0;
  const avg = total > 0
    ? Math.round(audits!.reduce((acc, c) => acc + (c.overall_score || 0), 0) / total)
    : 100;

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-[#253C2B] pb-4">
        <span className="font-mono text-xs font-bold text-[#16834A] uppercase tracking-wider">
          08 &mdash; GOVERNANCE INSIGHTS
        </span>
        <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
          ORGANISATIONAL INTEGRITY METRICS
        </h1>
        <p className="text-xs sm:text-sm text-[#637367]">
          Aggregated analytics, department integrity scores, and verification velocity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="brutal-card p-4 bg-white">
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase">TOTAL AUDITS</span>
          <span className="font-mono font-extrabold text-3xl text-[#17251C] mt-1 block">{total}</span>
        </div>
        <div className="brutal-card p-4 bg-white">
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase">AVERAGE INTEGRITY</span>
          <span className="font-mono font-extrabold text-3xl text-[#16834A] mt-1 block">{avg}%</span>
        </div>
        <div className="brutal-card p-4 bg-white">
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase">APPROVAL RATE</span>
          <span className="font-mono font-extrabold text-3xl text-[#17251C] mt-1 block">84%</span>
        </div>
        <div className="brutal-card p-4 bg-white">
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase">AVG SIGN-OFF TIME</span>
          <span className="font-mono font-extrabold text-3xl text-[#17251C] mt-1 block">4.2h</span>
        </div>
      </div>
    </div>
  );
}
