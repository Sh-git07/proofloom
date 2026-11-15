import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import Link from "next/link";
import {
  AlertTriangle,
  Activity,
} from "lucide-react";

export default async function OverviewPage() {
  const context = await getCurrentUserContext();
  const orgId = context?.organisation.id;

  const supabase = await createClient();

  // 1. Fetch Audits Completed & Average Score
  const { data: audits } = await supabase
    .from("audits")
    .select("id, overall_score, status, created_at, content_items(title, content_type, department)")
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false });

  const totalAudits = audits?.length || 0;
  const avgScore = totalAudits > 0
    ? Math.round(
        audits!.reduce((acc, curr) => acc + (curr.overall_score || 0), 0) / totalAudits
      )
    : 100;

  // 2. Fetch Pending Review items
  const { count: pendingReviewCount } = await supabase
    .from("content_items")
    .select("*", { count: "exact", head: true })
    .eq("organisation_id", orgId)
    .in("status", ["READY_FOR_REVIEW", "IN_REVIEW"]);

  // 3. Fetch Critical Findings count
  const { count: criticalFindingsCount } = await supabase
    .from("audit_findings")
    .select("*", { count: "exact", head: true })
    .eq("organisation_id", orgId)
    .eq("severity", "CRITICAL")
    .eq("is_resolved", false);

  // 4. Fetch Verified Claims count
  const { count: verifiedClaimsCount } = await supabase
    .from("extracted_claims")
    .select("*", { count: "exact", head: true })
    .eq("organisation_id", orgId)
    .eq("verification_status", "VERIFIED");

  // 5. Fetch Issues Resolved
  const { count: resolvedIssuesCount } = await supabase
    .from("audit_findings")
    .select("*", { count: "exact", head: true })
    .eq("organisation_id", orgId)
    .eq("is_resolved", true);

  // 6. Fetch Recent Activity Logs
  const { data: activityLogs } = await supabase
    .from("activity_logs")
    .select("id, action, target_type, details, created_at")
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false })
    .limit(6);

  // 7. Fetch Drift Insights
  const { data: driftAlerts } = await supabase
    .from("drift_insights")
    .select("id, title, summary, insight_type, frequency, is_seeded")
    .eq("organisation_id", orgId)
    .limit(3);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#253C2B] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-mono text-xs font-bold text-[#16834A] uppercase tracking-wider">
              01 &mdash; SYSTEM OVERVIEW
            </span>
            {context?.isDemoMode && (
              <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 bg-[#B7F28B] text-[#17251C] brutal-border">
                DEMO DATA
              </span>
            )}
          </div>
          <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
            BRAND INTEGRITY / SYSTEM OVERVIEW
          </h1>
          <p className="text-xs sm:text-sm text-[#637367]">
            Monitoring every message published in your organisation&apos;s name.
          </p>
        </div>

        <Link
          href="/studio"
          className="brutal-btn brutal-btn-lime px-4 py-2 text-xs font-mono font-bold self-start sm:self-auto flex items-center space-x-1.5"
        >
          <span>RUN BRAND AUDIT &rarr;</span>
        </Link>
      </div>

      {/* Primary KPI Panels */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1 */}
        <div className="brutal-card p-3 bg-white">
          <span className="block font-mono text-[10px] font-bold text-[#637367] uppercase">
            INTEGRITY INDEX
          </span>
          <div className="flex items-baseline space-x-1 mt-1">
            <span className="font-mono font-extrabold text-2xl text-[#16834A]">
              {avgScore}
            </span>
            <span className="font-mono text-xs text-[#637367]">/100</span>
          </div>
          <span className="text-[10px] text-[#16834A] font-mono mt-1 block">
            Target &ge; 85.0
          </span>
        </div>

        {/* Metric 2 */}
        <div className="brutal-card p-3 bg-white">
          <span className="block font-mono text-[10px] font-bold text-[#637367] uppercase">
            AUDITS COMPLETED
          </span>
          <span className="font-mono font-extrabold text-2xl text-[#17251C] mt-1 block">
            {totalAudits}
          </span>
          <span className="text-[10px] text-[#637367] font-mono mt-1 block">
            Last 90 days
          </span>
        </div>

        {/* Metric 3 */}
        <div className="brutal-card p-3 bg-white">
          <span className="block font-mono text-[10px] font-bold text-[#637367] uppercase">
            PENDING REVIEW
          </span>
          <span className="font-mono font-extrabold text-2xl text-[#E6A23C] mt-1 block">
            {pendingReviewCount || 0}
          </span>
          <span className="text-[10px] text-[#E6A23C] font-mono mt-1 block">
            Requires signoff
          </span>
        </div>

        {/* Metric 4 */}
        <div className="brutal-card p-3 bg-white">
          <span className="block font-mono text-[10px] font-bold text-[#637367] uppercase">
            CRITICAL FINDINGS
          </span>
          <span className="font-mono font-extrabold text-2xl text-[#D94C4C] mt-1 block">
            {criticalFindingsCount || 0}
          </span>
          <span className="text-[10px] text-[#D94C4C] font-mono mt-1 block">
            Unresolved
          </span>
        </div>

        {/* Metric 5 */}
        <div className="brutal-card p-3 bg-white">
          <span className="block font-mono text-[10px] font-bold text-[#637367] uppercase">
            VERIFIED CLAIMS
          </span>
          <span className="font-mono font-extrabold text-2xl text-[#16834A] mt-1 block">
            {verifiedClaimsCount || 0}
          </span>
          <span className="text-[10px] text-[#16834A] font-mono mt-1 block">
            100% Provenance
          </span>
        </div>

        {/* Metric 6 */}
        <div className="brutal-card p-3 bg-white">
          <span className="block font-mono text-[10px] font-bold text-[#637367] uppercase">
            ISSUES RESOLVED
          </span>
          <span className="font-mono font-extrabold text-2xl text-[#17251C] mt-1 block">
            {resolvedIssuesCount || 0}
          </span>
          <span className="text-[10px] text-[#637367] font-mono mt-1 block">
            Intent preserved
          </span>
        </div>
      </div>

      {/* Main Grid: Recent Audits & Drift Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Recent Audits Table */}
        <div className="lg:col-span-2 brutal-card bg-white p-5">
          <div className="flex items-center justify-between mb-4 border-b-2 border-[#253C2B] pb-2">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-[#17251C] uppercase tracking-wider">
                RECENT AUDITS
              </span>
              <span className="text-[10px] font-mono text-[#637367]">
                ({totalAudits} total)
              </span>
            </div>
            <Link
              href="/audits"
              className="text-xs font-mono font-bold text-[#16834A] hover:underline"
            >
              VIEW ALL AUDITS &rarr;
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b-2 border-[#253C2B] bg-[#F4F1E8] text-[#637367]">
                  <th className="py-2 px-3">TITLE</th>
                  <th className="py-2 px-3">DEPT</th>
                  <th className="py-2 px-3">SCORE</th>
                  <th className="py-2 px-3">STATUS</th>
                  <th className="py-2 px-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y border-b-2 border-[#253C2B]">
                {audits?.slice(0, 5).map((audit) => {
                  const item = audit.content_items as unknown as {
                    title: string;
                    content_type: string;
                    department: string;
                  } | null;

                  return (
                    <tr key={audit.id} className="hover:bg-[#F4F1E8] transition-colors">
                      <td className="py-2.5 px-3 font-bold text-[#17251C]">
                        {item?.title || "Untitled Draft"}
                      </td>
                      <td className="py-2.5 px-3 text-[#637367]">
                        {item?.department || "General"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`font-bold ${
                            (audit.overall_score || 0) >= 80
                              ? "text-[#16834A]"
                              : (audit.overall_score || 0) >= 60
                              ? "text-[#E6A23C]"
                              : "text-[#D94C4C]"
                          }`}
                        >
                          {audit.overall_score || 0}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 text-[10px] font-bold brutal-border bg-[#F4F1E8]">
                          {audit.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          href={`/audits/${audit.id}`}
                          className="text-[#16834A] font-bold hover:underline"
                        >
                          REPORT &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Brand Drift Alerts & Activity */}
        <div className="space-y-6">
          {/* Drift Alerts Card */}
          <div className="brutal-card bg-white p-5">
            <div className="flex items-center justify-between mb-3 border-b-2 border-[#253C2B] pb-2">
              <span className="font-mono text-xs font-bold text-[#17251C] uppercase tracking-wider flex items-center space-x-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#D94C4C]" />
                <span>DRIFT RADAR ALERTS</span>
              </span>
              <Link
                href="/drift"
                className="text-xs font-mono font-bold text-[#16834A] hover:underline"
              >
                RADAR &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {driftAlerts?.map((alert) => (
                <div key={alert.id} className="p-2.5 brutal-border bg-[#F4F1E8]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] font-bold text-[#D94C4C] uppercase">
                      {alert.insight_type.replace(/_/g, " ")} ({alert.frequency}x)
                    </span>
                    {alert.is_seeded && (
                      <span className="font-mono text-[9px] text-[#637367]">
                        SEEDED DEMO INSIGHT
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs font-bold text-[#17251C] mb-1">
                    {alert.title}
                  </h4>
                  <p className="text-[11px] text-[#637367] leading-tight line-clamp-2">
                    {alert.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Logs */}
          <div className="brutal-card bg-white p-5">
            <div className="flex items-center justify-between mb-3 border-b-2 border-[#253C2B] pb-2">
              <span className="font-mono text-xs font-bold text-[#17251C] uppercase tracking-wider flex items-center space-x-1.5">
                <Activity className="w-3.5 h-3.5 text-[#16834A]" />
                <span>IMMUTABLE AUDIT LOG</span>
              </span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              {activityLogs?.map((log) => (
                <div key={log.id} className="flex items-start justify-between py-1 border-b border-[#DDEBDD] last:border-none">
                  <div>
                    <span className="font-bold text-[#17251C] block text-[11px]">
                      {log.action.replace(/_/g, " ").toUpperCase()}
                    </span>
                    <span className="text-[10px] text-[#637367]">
                      {log.target_type}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#637367]">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footnote */}
      <p className="font-mono text-[10px] text-[#637367] text-center pt-2">
        Internal decision-support metric, not a guarantee of compliance or truth.
      </p>
    </div>
  );
}
