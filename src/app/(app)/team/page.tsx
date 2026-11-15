import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { TeamWorkbench, TeamMember } from "@/components/team/TeamWorkbench";
import { OrgRoleType } from "@/app/actions/governance";

export default async function TeamPage() {
  const context = await getCurrentUserContext();
  const supabase = await createClient();

  const { data: membersRaw } = await supabase
    .from("organisation_members")
    .select(`
      id,
      user_id,
      role,
      created_at,
      profiles(email, full_name, department)
    `)
    .eq("organisation_id", context?.organisation.id)
    .order("created_at", { ascending: true });

  const members: TeamMember[] = (membersRaw || []).map((m) => {
    const p = m.profiles as unknown as {
      email: string;
      full_name: string;
      department: string;
    } | null;

    return {
      id: m.id,
      user_id: m.user_id,
      role: m.role as OrgRoleType,
      created_at: m.created_at,
      email: p?.email || "unknown@domain.com",
      full_name: p?.full_name || "Team Member",
      department: p?.department || "General",
    };
  });

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-[#253C2B] pb-4">
        <span className="font-mono text-xs font-bold text-[#16834A] uppercase tracking-wider">
          09 &mdash; TEAM & ACCESS
        </span>
        <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
          GOVERNANCE TEAM & ROLES
        </h1>
        <p className="text-xs sm:text-sm text-[#637367]">
          Active team roster, role capabilities, and access permissions for {context?.organisation.name}.
        </p>
      </div>

      <TeamWorkbench
        members={members}
        currentUserRole={context?.role || "viewer"}
        currentUserId={context?.user.id || ""}
      />
    </div>
  );
}
