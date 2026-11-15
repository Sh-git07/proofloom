import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import Link from "next/link";

export default async function AuditsPage() {
  const context = await getCurrentUserContext();
  const supabase = await createClient();

  const { data: audits } = await supabase
    .from("audits")
    .select(`
      id,
      overall_score,
      status,
      mode,
      created_at,
      content_items(id, title, content_type, platform, department)
    `)
    .eq("organisation_id", context?.organisation.id)
    .order("created_at", { ascending: false });

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
            Historical archive of all automated and human-reviewed brand checks.
          </p>
        </div>

        <Link
          href="/studio"
          className="brutal-btn brutal-btn-primary px-4 py-2 text-xs font-mono font-bold"
        >
          + NEW AUDIT
        </Link>
      </div>

      <div className="brutal-card bg-white p-5 overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b-2 border-[#253C2B] bg-[#F4F1E8] text-[#637367]">
              <th className="py-2.5 px-3">AUDIT ID</th>
              <th className="py-2.5 px-3">TITLE</th>
              <th className="py-2.5 px-3">DEPT</th>
              <th className="py-2.5 px-3">TYPE</th>
              <th className="py-2.5 px-3">SCORE</th>
              <th className="py-2.5 px-3">STATUS</th>
              <th className="py-2.5 px-3">DATE</th>
              <th className="py-2.5 px-3 text-right">DETAILS</th>
            </tr>
          </thead>
          <tbody className="divide-y border-b-2 border-[#253C2B]">
            {audits?.map((audit) => {
              const item = audit.content_items as unknown as {
                id: string;
                title: string;
                content_type: string;
                platform: string;
                department: string;
              } | null;

              return (
                <tr key={audit.id} className="hover:bg-[#F4F1E8] transition-colors">
                  <td className="py-3 px-3 font-bold text-[#637367]">
                    #{audit.id.slice(0, 8)}
                  </td>
                  <td className="py-3 px-3 font-bold text-[#17251C]">
                    {item?.title || "Draft"}
                  </td>
                  <td className="py-3 px-3 text-[#637367]">
                    {item?.department || "General"}
                  </td>
                  <td className="py-3 px-3 text-[#637367]">
                    {item?.content_type || "Post"}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`font-bold ${
                        (audit.overall_score || 0) >= 80
                          ? "text-[#16834A]"
                          : (audit.overall_score || 0) >= 60
                          ? "text-[#E6A23C]"
                          : "text-[#D94C4C]"
                      }`}
                    >
                      {audit.overall_score || 0}/100
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 text-[10px] font-bold brutal-border bg-[#F4F1E8]">
                      {audit.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#637367]">
                    {new Date(audit.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-3 text-right">
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
  );
}
