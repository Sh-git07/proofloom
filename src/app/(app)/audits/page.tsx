import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import Link from "next/link";
import { AuditHistoryView, AuditRecord } from "@/components/audits/AuditHistoryView";

export default async function AuditsPage() {
  const context = await getCurrentUserContext();
  const supabase = await createClient();
  const orgId = context?.organisation.id;

  // Fetch audits and critical findings in parallel
  const [auditsRes, findingsRes] = await Promise.all([
    supabase
      .from("audits")
      .select(`
        id,
        overall_score,
        status,
        mode,
        created_at,
        content_items(id, title, content_type, platform, department)
      `)
      .eq("organisation_id", orgId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase
      .from("audit_findings")
      .select("audit_id, severity, is_resolved")
      .eq("organisation_id", orgId)
      .eq("severity", "CRITICAL")
      .eq("is_resolved", false),
  ]);

  const auditsRaw = auditsRes.data;
  const findingsRaw = findingsRes.data;

  const criticalMap = new Map<string, number>();
  (findingsRaw || []).forEach((f) => {
    criticalMap.set(f.audit_id, (criticalMap.get(f.audit_id) || 0) + 1);
  });

  const audits: AuditRecord[] = (auditsRaw || []).map((a) => {
    const item = a.content_items as unknown as {
      id: string;
      title: string;
      content_type: string;
      platform: string;
      department: string;
    } | null;

    return {
      id: a.id,
      overall_score: a.overall_score,
      status: a.status,
      mode: a.mode,
      created_at: a.created_at,
      content_item: item,
      critical_count: criticalMap.get(a.id) || 0,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#253C2B] pb-4">
        <div>
          <span className="font-mono text-xs font-bold text-[#16834A] uppercase tracking-wider">
            03 &mdash; AUDIT HISTORY
          </span>
          <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
            VERIFICATION AUDIT LOGS
          </h1>
          <p className="text-xs sm:text-sm text-[#637367]">
            Historical archive of all automated and human-reviewed brand checks across your organization.
          </p>
        </div>

        <Link
          href="/studio"
          className="brutal-btn brutal-btn-primary px-4 py-2 text-xs font-mono font-bold self-start sm:self-auto"
        >
          + NEW AUDIT
        </Link>
      </div>

      <AuditHistoryView audits={audits} />
    </div>
  );
}
