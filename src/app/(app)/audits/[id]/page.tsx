import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

interface AuditReportProps {
  params: Promise<{ id: string }>;
}

export default async function AuditReportPage({ params }: AuditReportProps) {
  const { id } = await params;
  const context = await getCurrentUserContext();
  const supabase = await createClient();

  const { data: audit } = await supabase
    .from("audits")
    .select(`
      id,
      overall_score,
      status,
      mode,
      scores,
      checked_dimensions,
      created_at,
      content_versions(body, version_no),
      content_items(id, title, content_type, platform, department, status)
    `)
    .eq("id", id)
    .eq("organisation_id", context?.organisation.id)
    .single();

  if (!audit) {
    notFound();
  }

  const { data: stages } = await supabase
    .from("audit_stages")
    .select("*")
    .eq("audit_id", id)
    .order("stage_number", { ascending: true });

  const { data: findings } = await supabase
    .from("audit_findings")
    .select("*")
    .eq("audit_id", id)
    .order("severity", { ascending: true });

  const item = audit.content_items as unknown as {
    id: string;
    title: string;
    content_type: string;
    platform: string;
    department: string;
    status: string;
  } | null;

  const version = audit.content_versions as unknown as {
    body: string;
    version_no: number;
  } | null;

  return (
    <div className="space-y-6">
      {/* Back button & Title */}
      <div className="flex items-center space-x-3 border-b-2 border-[#253C2B] pb-4">
        <Link
          href="/audits"
          className="p-1.5 brutal-border bg-white hover:bg-[#F4F1E8]"
        >
          <ArrowLeft className="w-4 h-4 text-[#17251C]" />
        </Link>
        <div>
          <span className="font-mono text-xs font-bold text-[#16834A] uppercase tracking-wider">
            AUDIT REPORT &bull; #{audit.id.slice(0, 8)}
          </span>
          <h1 className="font-mono font-extrabold text-2xl text-[#17251C] mt-0.5">
            {item?.title || "Audit Report"}
          </h1>
        </div>
      </div>

      {/* Score Header Panel */}
      <div className="brutal-card p-6 bg-white flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <span className="font-mono text-xs font-bold text-[#637367] uppercase block">
            OVERALL INTEGRITY SCORE
          </span>
          <div className="flex items-baseline space-x-2 mt-1">
            <span
              className={`font-mono font-extrabold text-5xl ${
                (audit.overall_score || 0) >= 80
                  ? "text-[#16834A]"
                  : (audit.overall_score || 0) >= 60
                  ? "text-[#E6A23C]"
                  : "text-[#D94C4C]"
              }`}
            >
              {audit.overall_score || 0}
            </span>
            <span className="font-mono text-lg text-[#637367]">/100</span>
          </div>
          <span className="text-xs font-mono text-[#637367] mt-1 block">
            Status: {audit.status} &bull; Mode: {audit.mode.toUpperCase()}
          </span>
        </div>

        {/* Verification Stages status chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
          {stages?.map((s) => (
            <div key={s.id} className="p-2 brutal-border bg-[#F4F1E8] text-[10px] font-mono">
              <span className="text-[#637367] block">{s.stage_key}</span>
              <span className="font-bold text-[#16834A] block mt-0.5">{s.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Submitted Content Display */}
      <div className="brutal-card p-6 bg-white">
        <h3 className="font-mono font-bold text-sm text-[#17251C] uppercase mb-2 border-b border-[#253C2B] pb-1">
          SUBMITTED CONTENT (VERSION {version?.version_no || 1})
        </h3>
        <p className="font-mono text-sm text-[#17251C] bg-[#F4F1E8] p-4 brutal-border">
          {version?.body}
        </p>
      </div>

      {/* Findings List */}
      <div className="space-y-4">
        <h3 className="font-mono font-bold text-sm text-[#17251C] uppercase">
          AUDIT FINDINGS ({findings?.length || 0})
        </h3>

        {findings && findings.length > 0 ? (
          <div className="space-y-3">
            {findings.map((f) => (
              <div key={f.id} className="brutal-card p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`font-mono text-[10px] font-extrabold px-2 py-0.5 text-white ${
                        f.severity === "CRITICAL"
                          ? "bg-[#D94C4C]"
                          : f.severity === "HIGH"
                          ? "bg-[#E6A23C]"
                          : "bg-[#16834A]"
                      }`}
                    >
                      {f.severity}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#17251C]">
                      {f.finding_code}: {f.category.toUpperCase()}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-[#637367]">
                    {f.verification_status || "FLAGGED"}
                  </span>
                </div>

                <p className="font-mono text-xs font-bold text-[#D94C4C] bg-[#F4F1E8] p-2 brutal-border mb-2">
                  &ldquo;{f.excerpt}&rdquo;
                </p>

                <p className="text-xs text-[#17251C] mb-2 font-medium">
                  {f.explanation}
                </p>

                {f.suggested_replacement && (
                  <div className="p-2 bg-[#DDEBDD] brutal-border text-xs font-mono">
                    <span className="font-bold text-[#16834A] block mb-0.5">
                      SUGGESTED REPLACEMENT:
                    </span>
                    <span className="text-[#17251C]">{f.suggested_replacement}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="brutal-card p-6 bg-white text-center">
            <CheckCircle2 className="w-8 h-8 text-[#16834A] mx-auto mb-2" />
            <p className="font-mono text-xs font-bold text-[#16834A]">
              NO VIOLATIONS DETECTED &bull; CLEAN AUDIT
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
