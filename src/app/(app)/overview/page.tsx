import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import Link from "next/link";
import {
  MetricPanel,
} from "@/components/ui/metric-panel";
import { SectionLabel } from "@/components/ui/section-label";
import { StatusLED } from "@/components/ui/status-led";
import { IdTag } from "@/components/ui/id-tag";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  FileText,
  Database,
} from "lucide-react";

export default async function OverviewPage() {
  const context = await getCurrentUserContext();
  const orgId = context?.organisation.id;
  const supabase = await createClient();

  // 1. Fetch Audits
  const { data: audits } = await supabase
    .from("audits")
    .select(`
      id,
      overall_score,
      status,
      mode,
      created_at,
      content_items(title, content_type, department)
    `)
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false });

  const totalAudits = audits?.length || 0;
  const avgScore =
    totalAudits > 0
      ? Math.round(
          audits!.reduce((acc, curr) => acc + (curr.overall_score || 0), 0) /
            totalAudits
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
    .select("id, action, target_type, target_id, details, created_at")
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false })
    .limit(7);

  // 7. Fetch Drift Insights
  const { data: driftAlerts } = await supabase
    .from("drift_insights")
    .select("id, title, summary, insight_type, frequency, is_seeded")
    .eq("organisation_id", orgId)
    .limit(3);

  // 8. Fetch Knowledge Source Health
  const { data: approvedFacts } = await supabase
    .from("approved_facts")
    .select("id, name, value, approval_status, expires_at")
    .eq("organisation_id", orgId);

  const activeFactsCount =
    approvedFacts?.filter((f) => f.approval_status === "APPROVED").length || 0;
  const expiredFactsCount =
    approvedFacts?.filter((f) => f.approval_status === "EXPIRED").length || 0;

  return (
    <div className="space-y-6">
      {/* 1. Engineering Header Console */}
      <div className="brutal-panel bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <SectionLabel number="01" title="SYSTEM OVERVIEW" />
            {context?.isDemoMode && (
              <span className="font-mono text-[9px] font-extrabold px-1.5 py-0.2 bg-[#B7F28B] text-[#17251C] brutal-border">
                DEMO ENVIRONMENT
              </span>
            )}
          </div>
          <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
            BRAND INTEGRITY / SYSTEM OVERVIEW
          </h1>
          <p className="text-xs sm:text-sm text-[#637367] mt-0.5 font-medium">
            Monitoring every message published in your organisation&apos;s name.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link href="/studio">
            <Button variant="lime" size="md" className="flex items-center space-x-1.5">
              <span>RUN BRAND AUDIT</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. 6x KPI Telemetry Grid (Engineering Control Panels) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricPanel
          label="INTEGRITY INDEX"
          value={avgScore}
          unit="/100"
          subtext="Target ≥ 85.0"
          status={avgScore >= 80 ? "success" : avgScore >= 60 ? "warning" : "critical"}
          badge="HEALTH"
        />

        <MetricPanel
          label="AUDITS COMPLETED"
          value={totalAudits}
          subtext="Last 90 days active"
          status="normal"
          badge="LOG"
        />

        <MetricPanel
          label="PENDING REVIEW"
          value={pendingReviewCount || 0}
          subtext="Requires sign-off"
          status={pendingReviewCount ? "warning" : "normal"}
          badge="QUEUE"
        />

        <MetricPanel
          label="CRITICAL FINDINGS"
          value={criticalFindingsCount || 0}
          subtext="Blocking publication"
          status={criticalFindingsCount ? "critical" : "success"}
          badge="RISK"
        />

        <MetricPanel
          label="VERIFIED CLAIMS"
          value={verifiedClaimsCount || 0}
          subtext="100% Provenance traced"
          status="success"
          badge="TRUTH"
        />

        <MetricPanel
          label="ISSUES RESOLVED"
          value={resolvedIssuesCount || 0}
          subtext="Intent preserved"
          status="normal"
          badge="REWRITE"
        />
      </div>

      {/* 3. Main Operational Telemetry Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column (2-spans): Real-Time Audit Log Table */}
        <div className="xl:col-span-2 space-y-6">
          <div className="brutal-panel bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#16834A]" />
                <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
                  RECENT VERIFICATION AUDITS
                </h3>
                <span className="font-mono text-[10px] text-[#637367]">
                  ({totalAudits} records logged)
                </span>
              </div>
              <Link
                href="/audits"
                className="font-mono text-xs font-bold text-[#16834A] hover:underline"
              >
                FULL ARCHIVE &rarr;
              </Link>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>AUDIT ID</TableHead>
                  <TableHead>TITLE</TableHead>
                  <TableHead>DEPT</TableHead>
                  <TableHead>SCORE</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead className="text-right">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audits?.slice(0, 6).map((audit) => {
                  const item = audit.content_items as unknown as {
                    title: string;
                    content_type: string;
                    department: string;
                  } | null;

                  return (
                    <TableRow key={audit.id}>
                      <TableCell>
                        <IdTag id={audit.id.slice(0, 8)} prefix="#" />
                      </TableCell>
                      <TableCell className="font-bold text-[#17251C]">
                        {item?.title || "Draft Submission"}
                      </TableCell>
                      <TableCell className="text-[#637367]">
                        {item?.department || "General"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-extrabold ${
                            (audit.overall_score || 0) >= 80
                              ? "text-[#16834A]"
                              : (audit.overall_score || 0) >= 60
                              ? "text-[#E6A23C]"
                              : "text-[#D94C4C]"
                          }`}
                        >
                          {audit.overall_score || 0}/100
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="px-1.5 py-0.5 text-[10px] font-extrabold brutal-border bg-[#F4F1E8]">
                          {audit.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/audits/${audit.id}`}
                          className="font-mono text-xs font-bold text-[#16834A] hover:underline"
                        >
                          REPORT &rarr;
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Knowledge-Source Health Module */}
          <div className="brutal-panel bg-white p-5 space-y-3">
            <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-3">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-[#16834A]" />
                <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
                  KNOWLEDGE SOURCE & BENCHMARK INTEGRITY
                </h3>
              </div>
              <Link
                href="/knowledge"
                className="font-mono text-xs font-bold text-[#16834A] hover:underline"
              >
                MANAGE VAULT &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-3 bg-[#DDEBDD] brutal-border">
                <span className="text-[#16834A] font-bold block text-[10px] uppercase">
                  ACTIVE APPROVED FACTS
                </span>
                <span className="font-extrabold text-2xl text-[#16834A]">
                  {activeFactsCount}
                </span>
                <span className="block text-[10px] text-[#637367] mt-1">
                  100% Authoritative
                </span>
              </div>

              <div className="p-3 bg-[#F4F1E8] brutal-border">
                <span className="text-[#D94C4C] font-bold block text-[10px] uppercase">
                  SUPERSEDED / EXPIRED
                </span>
                <span className="font-extrabold text-2xl text-[#D94C4C]">
                  {expiredFactsCount}
                </span>
                <span className="block text-[10px] text-[#637367] mt-1">
                  Quarantine active
                </span>
              </div>

              <div className="p-3 bg-[#F4F1E8] brutal-border">
                <span className="text-[#637367] font-bold block text-[10px] uppercase">
                  AUDIT TOLERANCE
                </span>
                <span className="font-extrabold text-2xl text-[#17251C]">
                  5.0%
                </span>
                <span className="block text-[10px] text-[#637367] mt-1">
                  Strict variance gate
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Drift Radar & Immutable Activity Terminal */}
        <div className="space-y-6">
          {/* Brand Drift Alerts */}
          <div className="brutal-panel bg-white p-5 space-y-3">
            <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-[#D94C4C]" />
                <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
                  SYSTEMIC DRIFT RADAR
                </h3>
              </div>
              <Link
                href="/drift"
                className="font-mono text-xs font-bold text-[#16834A] hover:underline"
              >
                RADAR &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {driftAlerts?.map((alert) => (
                <div key={alert.id} className="p-3 brutal-border bg-[#F4F1E8] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] font-extrabold px-1.5 py-0.2 bg-[#D94C4C] text-white rounded-[1px]">
                      {alert.insight_type.replace(/_/g, " ").toUpperCase()}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-[#17251C]">
                      {alert.frequency}x DETECTED
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-[#17251C] leading-tight">
                    {alert.title}
                  </h4>
                  <p className="text-[11px] text-[#637367] leading-normal line-clamp-2">
                    {alert.summary}
                  </p>
                  {alert.is_seeded && (
                    <div className="pt-1 text-[9px] font-mono text-[#16834A] font-bold">
                      &bull; SEEDED DEMO INSIGHT
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Immutable Activity Terminal */}
          <div className="brutal-panel bg-white p-5 space-y-3">
            <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-[#16834A]" />
                <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
                  IMMUTABLE AUDIT LOG
                </h3>
              </div>
              <StatusLED status="live" size="sm" />
            </div>

            <div className="space-y-2 font-mono text-xs">
              {activityLogs?.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between py-1.5 border-b border-[#253C2B]/15 last:border-none text-[11px]"
                >
                  <div className="pr-2">
                    <span className="font-bold text-[#17251C] block">
                      {log.action.replace(/_/g, " ").toUpperCase()}
                    </span>
                    <span className="text-[10px] text-[#637367]">
                      Target: {log.target_type}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#637367] shrink-0 font-bold">
                    {new Date(log.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Engineering Footnote */}
      <div className="text-center pt-2">
        <p className="font-mono text-[10px] text-[#637367] tracking-wider uppercase">
          Internal decision-support metric &bull; Not a guarantee of compliance or truth &bull; PROOFLOOM v1.0
        </p>
      </div>
    </div>
  );
}
