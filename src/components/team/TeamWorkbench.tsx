"use client";

import * as React from "react";
import { UserPlus, Shield, Check, X, RefreshCw } from "lucide-react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { addTeamMemberAction, updateMemberRoleAction, OrgRoleType } from "@/app/actions/governance";

export interface TeamMember {
  id: string; // membership id
  user_id: string;
  role: OrgRoleType;
  created_at: string;
  email: string;
  full_name: string;
  department: string;
}

export function TeamWorkbench({
  members: initialMembers,
  currentUserRole,
  currentUserId,
}: {
  members: TeamMember[];
  currentUserRole: string;
  currentUserId: string;
}) {
  const [members, setMembers] = React.useState<TeamMember[]>(initialMembers);
  const [isInviteOpen, setIsInviteOpen] = React.useState(false);

  // Invite Form state
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteName, setInviteName] = React.useState("");
  const [inviteDept, setInviteDept] = React.useState("Marketing");
  const [inviteRole, setInviteRole] = React.useState<OrgRoleType>("creator");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Updating role state
  const [updatingMemberId, setUpdatingMemberId] = React.useState<string | null>(null);

  const isAdmin = currentUserRole === "admin";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const res = await addTeamMemberAction({
      email: inviteEmail.trim(),
      fullName: inviteName.trim(),
      department: inviteDept.trim(),
      role: inviteRole,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setFeedback({ type: "error", message: res.error || "Failed to invite member" });
      return;
    }

    setFeedback({ type: "success", message: "Team member added successfully!" });
    setInviteEmail("");
    setInviteName("");
    setTimeout(() => {
      setIsInviteOpen(false);
      setFeedback(null);
      window.location.reload();
    }, 1200);
  };

  const handleRoleChange = async (memberId: string, newRole: OrgRoleType) => {
    setUpdatingMemberId(memberId);
    const res = await updateMemberRoleAction({
      membershipId: memberId,
      newRole,
    });
    setUpdatingMemberId(null);

    if (res.success) {
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
    } else {
      alert(res.error || "Failed to update role");
    }
  };

  return (
    <div className="space-y-6">
      {/* Invite Member Action Bar */}
      {isAdmin && (
        <div className="flex justify-end">
          <button
            onClick={() => setIsInviteOpen(true)}
            className="brutal-btn brutal-btn-primary px-4 py-2 text-xs font-mono font-bold flex items-center space-x-2"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>INVITE TEAM MEMBER</span>
          </button>
        </div>
      )}

      {/* Team Roster Card */}
      <div className="brutal-card bg-white p-5 overflow-x-auto space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-3">
          <span className="font-mono text-xs font-bold text-[#17251C] uppercase">
            ACTIVE ORGANISATION ROSTER ({members.length})
          </span>
          <span className="font-mono text-[10px] text-[#637367]">
            Governed by PostgreSQL Row Level Security
          </span>
        </div>

        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b-2 border-[#253C2B] bg-[#F4F1E8] text-[#637367]">
              <th className="py-2.5 px-3">MEMBER</th>
              <th className="py-2.5 px-3">DEPARTMENT</th>
              <th className="py-2.5 px-3">ROLE</th>
              <th className="py-2.5 px-3">CAPABILITIES</th>
              <th className="py-2.5 px-3">JOINED</th>
              {isAdmin && <th className="py-2.5 px-3 text-right">MANAGE ROLE</th>}
            </tr>
          </thead>
          <tbody className="divide-y border-b-2 border-[#253C2B]">
            {members.map((m) => {
              const isCurrentUser = m.user_id === currentUserId;

              return (
                <tr key={m.id} className="hover:bg-[#F4F1E8] transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 bg-[#DDEBDD] brutal-border flex items-center justify-center font-bold text-[#16834A] text-xs">
                        {m.full_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-[#17251C] block">
                          {m.full_name} {isCurrentUser && "(You)"}
                        </span>
                        <span className="text-[10px] text-[#637367]">{m.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-[#637367]">
                    {m.department || "General"}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold brutal-border uppercase ${
                        m.role === "admin"
                          ? "bg-[#17251C] text-white"
                          : m.role === "brand_manager"
                          ? "bg-[#16834A] text-[#B7F28B]"
                          : m.role === "reviewer"
                          ? "bg-[#B7F28B] text-[#17251C]"
                          : "bg-white text-[#17251C]"
                      }`}
                    >
                      {m.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[11px] text-[#637367] max-w-xs">
                    {m.role === "admin"
                      ? "Full governance control, critical override authority, org settings"
                      : m.role === "brand_manager"
                      ? "Knowledge vault curation, guideline edits, reviewer assignments"
                      : m.role === "reviewer"
                      ? "Review queue sign-off, Brand Memory Court challenge adjudication"
                      : "Submit drafts, trigger audits, adopt intent-preserving rewrites"}
                  </td>
                  <td className="py-3 px-3 text-[#637367] text-[11px]">
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                  {isAdmin && (
                    <td className="py-3 px-3 text-right">
                      {isCurrentUser ? (
                        <span className="text-[10px] text-[#637367] font-bold">CURRENT</span>
                      ) : (
                        <select
                          value={m.role}
                          disabled={updatingMemberId === m.id}
                          onChange={(e) => handleRoleChange(m.id, e.target.value as OrgRoleType)}
                          className="bg-[#F4F1E8] brutal-border px-2 py-1 text-xs font-mono text-[#17251C] focus:outline-none"
                        >
                          <option value="creator">Creator</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="brand_manager">Brand Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Permissions Matrix Reference */}
      <div className="brutal-card bg-white p-5 space-y-4">
        <div className="border-b-2 border-[#253C2B] pb-2">
          <span className="font-mono text-xs font-bold text-[#17251C] uppercase flex items-center space-x-2">
            <Shield className="w-4 h-4 text-[#16834A]" />
            <span>ROLE CAPABILITY & PERMISSION BOUNDARIES</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
          <div className="p-3 bg-[#F4F1E8] brutal-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#17251C] uppercase">CREATOR</span>
              <span className="text-[10px] bg-white px-1.5 py-0.5 brutal-border">TIER 1</span>
            </div>
            <ul className="text-[11px] text-[#637367] space-y-1 list-disc list-inside">
              <li>Upload & create content drafts</li>
              <li>Execute 7-stage automated audit</li>
              <li>View provenance chains & rewrites</li>
              <li>Adopt rewrites to create Version N+1</li>
              <li>Contest findings in Brand Court</li>
            </ul>
          </div>

          <div className="p-3 bg-[#F4F1E8] brutal-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#17251C] uppercase">REVIEWER</span>
              <span className="text-[10px] bg-[#B7F28B] px-1.5 py-0.5 brutal-border">TIER 2</span>
            </div>
            <ul className="text-[11px] text-[#637367] space-y-1 list-disc list-inside">
              <li>All Creator capabilities</li>
              <li>Access Review Queue workbench</li>
              <li>Approve / Reject content submissions</li>
              <li>Blocked from approving critical flaws</li>
              <li>Adjudicate Brand Court challenges</li>
            </ul>
          </div>

          <div className="p-3 bg-[#F4F1E8] brutal-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#17251C] uppercase">BRAND MANAGER</span>
              <span className="text-[10px] bg-[#16834A] text-white px-1.5 py-0.5 brutal-border">TIER 3</span>
            </div>
            <ul className="text-[11px] text-[#637367] space-y-1 list-disc list-inside">
              <li>All Reviewer capabilities</li>
              <li>Brand Knowledge Vault full CRUD</li>
              <li>Create/retire facts & guidelines</li>
              <li>Assign reviewers to content items</li>
              <li>Export audit governance reports</li>
            </ul>
          </div>

          <div className="p-3 bg-[#17251C] text-[#F4F1E8] brutal-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#B7F28B] uppercase">ADMIN</span>
              <span className="text-[10px] bg-[#D94C4C] text-white px-1.5 py-0.5 brutal-border">SUPREME</span>
            </div>
            <ul className="text-[11px] text-[#DDEBDD] space-y-1 list-disc list-inside">
              <li>All Brand Manager capabilities</li>
              <li>Database Critical Override Authority</li>
              <li>Mandatory 15-char rationale logging</li>
              <li>Invite team members & assign roles</li>
              <li>Configure organisation AI & keys</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogHeader>
          <DialogTitle>INVITE NEW GOVERNANCE MEMBER</DialogTitle>
          <DialogDescription>
            Add an authorized team member to your organisation. RLS permissions take effect immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleInvite} className="space-y-4 pt-2">
          {feedback && (
            <div
              className={`p-3 brutal-border text-xs font-mono flex items-center space-x-2 ${
                feedback.type === "success"
                  ? "bg-[#B7F28B] text-[#17251C]"
                  : "bg-[#D94C4C] text-white"
              }`}
            >
              {feedback.type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              <span>{feedback.message}</span>
            </div>
          )}

          <div>
            <label className="block font-mono text-xs font-bold text-[#17251C] uppercase mb-1">
              EMAIL ADDRESS *
            </label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="e.g. colleague@acme.com"
              className="w-full p-2 bg-[#F4F1E8] brutal-border text-xs font-mono focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-mono text-xs font-bold text-[#17251C] uppercase mb-1">
              FULL NAME *
            </label>
            <input
              type="text"
              required
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="e.g. Jordan Lee"
              className="w-full p-2 bg-[#F4F1E8] brutal-border text-xs font-mono focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-xs font-bold text-[#17251C] uppercase mb-1">
                DEPARTMENT
              </label>
              <input
                type="text"
                value={inviteDept}
                onChange={(e) => setInviteDept(e.target.value)}
                placeholder="Marketing"
                className="w-full p-2 bg-[#F4F1E8] brutal-border text-xs font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-mono text-xs font-bold text-[#17251C] uppercase mb-1">
                ORGANISATION ROLE *
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as OrgRoleType)}
                className="w-full p-2 bg-[#F4F1E8] brutal-border text-xs font-mono focus:outline-none"
              >
                <option value="creator">Creator</option>
                <option value="reviewer">Reviewer</option>
                <option value="brand_manager">Brand Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t-2 border-[#253C2B]">
            <button
              type="button"
              onClick={() => setIsInviteOpen(false)}
              className="px-3 py-1.5 bg-[#F4F1E8] brutal-border text-xs font-mono font-bold hover:bg-[#DDEBDD]"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-[#16834A] text-white brutal-border text-xs font-mono font-bold brutal-shadow-sm flex items-center space-x-1.5"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>ADDING...</span>
                </>
              ) : (
                <span>CONFIRM & ADD MEMBER</span>
              )}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
