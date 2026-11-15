import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { CheckSquare, ShieldCheck } from "lucide-react";

export default async function ReviewsPage() {
  const context = await getCurrentUserContext();
  const supabase = await createClient();

  const { data: queueItems } = await supabase
    .from("content_items")
    .select(`
      id,
      title,
      content_type,
      department,
      status,
      created_at,
      profiles(full_name)
    `)
    .eq("organisation_id", context?.organisation.id)
    .in("status", ["READY_FOR_REVIEW", "IN_REVIEW", "REVISION_REQUIRED", "APPROVED", "REJECTED"])
    .order("created_at", { ascending: false });

  const { data: challenges } = await supabase
    .from("finding_challenges")
    .select(`
      id,
      reason,
      context,
      status,
      created_at,
      audit_findings(excerpt, severity, finding_code)
    `)
    .eq("organisation_id", context?.organisation.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-[#253C2B] pb-4">
        <span className="font-mono text-xs font-bold text-[#16834A] uppercase tracking-wider">
          06 &mdash; REVIEW QUEUE & BRAND MEMORY COURT
        </span>
        <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
          HUMAN GOVERNANCE & SIGN-OFF
        </h1>
        <p className="text-xs sm:text-sm text-[#637367]">
          Authorized sign-off queue and Brand Memory Court for resolving contested findings.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals Queue */}
        <div className="brutal-card p-5 bg-white space-y-4">
          <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-2">
            <span className="font-mono text-xs font-bold text-[#17251C] uppercase flex items-center space-x-1.5">
              <CheckSquare className="w-4 h-4 text-[#16834A]" />
              <span>CONTENT REVIEW QUEUE ({queueItems?.length || 0})</span>
            </span>
          </div>

          <div className="space-y-3">
            {queueItems?.map((item) => {
              const creator = item.profiles as unknown as { full_name: string } | null;

              return (
                <div key={item.id} className="p-3 brutal-border bg-[#F4F1E8] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[#17251C]">
                      {item.title}
                    </span>
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-white brutal-border">
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-[#637367]">
                    <span>Creator: {creator?.full_name || "Author"} &bull; {item.department}</span>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Brand Memory Court Challenges */}
        <div className="brutal-card p-5 bg-white space-y-4">
          <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-2">
            <span className="font-mono text-xs font-bold text-[#17251C] uppercase flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-[#16834A]" />
              <span>BRAND MEMORY COURT CHALLENGES ({challenges?.length || 0})</span>
            </span>
          </div>

          <div className="space-y-3">
            {challenges?.map((c) => {
              const finding = c.audit_findings as unknown as {
                excerpt: string;
                severity: string;
                finding_code: string;
              } | null;

              return (
                <div key={c.id} className="p-3 brutal-border bg-[#F4F1E8] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#D94C4C]">
                      {finding?.finding_code}: &ldquo;{finding?.excerpt}&rdquo;
                    </span>
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-[#B7F28B] brutal-border">
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#17251C] font-medium">
                    Reason: {c.reason}
                  </p>
                  <p className="text-[11px] text-[#637367]">
                    Context: {c.context}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
