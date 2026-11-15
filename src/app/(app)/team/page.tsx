import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { UserPlus } from "lucide-react";

export default async function TeamPage() {
  const context = await getCurrentUserContext();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("organisation_members")
    .select(`
      id,
      role,
      created_at,
      profiles(email, full_name, department)
    `)
    .eq("organisation_id", context?.organisation.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#253C2B] pb-4">
        <div>
          <span className="font-mono text-xs font-bold text-[#16834A] uppercase tracking-wider">
            09 &mdash; TEAM & ACCESS
          </span>
          <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
            GOVERNANCE TEAM & ROLES
          </h1>
          <p className="text-xs sm:text-sm text-[#637367]">
            Active members, role capabilities, and access permissions for {context?.organisation.name}.
          </p>
        </div>

        {context?.role === "admin" && (
          <button className="brutal-btn brutal-btn-primary px-4 py-2 text-xs font-mono font-bold flex items-center space-x-1.5">
            <UserPlus className="w-3.5 h-3.5" />
            <span>INVITE MEMBER</span>
          </button>
        )}
      </div>

      <div className="brutal-card bg-white p-5 overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b-2 border-[#253C2B] bg-[#F4F1E8] text-[#637367]">
              <th className="py-2.5 px-3">MEMBER</th>
              <th className="py-2.5 px-3">DEPARTMENT</th>
              <th className="py-2.5 px-3">ROLE</th>
              <th className="py-2.5 px-3">CAPABILITIES</th>
            </tr>
          </thead>
          <tbody className="divide-y border-b-2 border-[#253C2B]">
            {members?.map((m) => {
              const p = m.profiles as unknown as {
                email: string;
                full_name: string;
                department: string;
              } | null;

              return (
                <tr key={m.id} className="hover:bg-[#F4F1E8]">
                  <td className="py-3 px-3">
                    <span className="font-bold text-[#17251C] block">{p?.full_name}</span>
                    <span className="text-[10px] text-[#637367]">{p?.email}</span>
                  </td>
                  <td className="py-3 px-3 text-[#637367]">
                    {p?.department || "General"}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 text-[10px] font-bold brutal-border bg-[#B7F28B] text-[#17251C] uppercase">
                      {m.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[11px] text-[#637367]">
                    {m.role === "admin"
                      ? "Full administrative control, settings & critical overrides"
                      : m.role === "brand_manager"
                      ? "Knowledge vault, guidelines, facts & reviewer assignment"
                      : m.role === "creator"
                      ? "Submit content, execute audits & accept rewrites"
                      : "Review queue sign-off & challenge decisions"}
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
