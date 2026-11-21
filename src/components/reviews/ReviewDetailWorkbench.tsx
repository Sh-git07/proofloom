"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  recordApprovalAction,
  assignReviewerAction,
  addReviewCommentAction,
  toggleFindingResolvedAction,
} from "@/app/actions/governance";
import { OrgRole } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { IdTag } from "@/components/ui/id-tag";
import { SeverityChip } from "@/components/ui/severity-chip";
import { SectionLabel } from "@/components/ui/section-label";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { diffWordsWithSpace, Change } from "diff";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UserCheck,
  MessageSquare,
  GitBranch,
  ShieldAlert,
  Send,
  Check,
  X,
  History,
  Scale,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { HelpTip } from "@/components/guidance/HelpTip";

interface ReviewFinding {
  id: string;
  finding_code?: string;
  category: string;
  severity: string;
  excerpt: string;
  explanation: string;
  guideline_reference?: string;
  verification_status?: string;
  recommended_action: string;
  suggested_replacement?: string;
  confidence?: string;
  confidence_note?: string;
  source?: "Rule" | "AI";
  is_resolved?: boolean;
}

interface VersionItem {
  id: string;
  version_no: number;
  source: string;
  body: string;
  change_summary?: string;
  created_at: string;
}

interface AssignmentItem {
  id: string;
  status: string;
  notes?: string;
  created_at: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_email?: string;
  assigned_by_name?: string;
}

interface CommentItem {
  id: string;
  comment: string;
  finding_id?: string;
  created_at: string;
  author_name: string;
}

interface DecisionItem {
  id: string;
  decision: string;
  reason?: string;
  is_override?: boolean;
  override_reason?: string;
  created_at: string;
  decider_name: string;
}

interface ReviewerOption {
  userId: string;
  role: string;
  fullName: string;
  email: string;
  department: string;
}

interface ReviewDetailWorkbenchProps {
  currentUserRole: OrgRole;
  currentUserId: string;
  contentItem: {
    id: string;
    title: string;
    content_type: string;
    platform: string;
    department: string;
    status: string;
    created_at: string;
    creator_name: string;
    creator_id?: string;
    campaign_context?: string;
    objective?: string;
  };
  versions: VersionItem[];
  latestAudit: {
    id: string;
    overall_score: number | null;
    status: string;
    mode: string;
    created_at: string;
  } | null;
  findings: ReviewFinding[];
  assignments: AssignmentItem[];
  comments: CommentItem[];
  decisions: DecisionItem[];
  qualifiedReviewers: ReviewerOption[];
}

export function ReviewDetailWorkbench({
  currentUserRole,
  currentUserId,
  contentItem,
  versions,
  latestAudit,
  findings: initialFindings,
  assignments: initialAssignments,
  comments: initialComments,
  decisions: initialDecisions,
  qualifiedReviewers,
}: ReviewDetailWorkbenchProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState<"findings" | "diff" | "comments" | "decisions">(
    "findings"
  );
  const [findings, setFindings] = React.useState<ReviewFinding[]>(initialFindings);
  const [comments, setComments] = React.useState<CommentItem[]>(initialComments);
  const [decisions, setDecisions] = React.useState<DecisionItem[]>(initialDecisions);
  const [assignments, setAssignments] = React.useState<AssignmentItem[]>(initialAssignments);
  const [currentStatus, setCurrentStatus] = React.useState<string>(contentItem.status);

  // Assignment modal / controls
  const [selectedReviewerId, setSelectedReviewerId] = React.useState<string>(
    qualifiedReviewers[0]?.userId || ""
  );
  const [assignmentNotes, setAssignmentNotes] = React.useState("");
  const [isAssigning, setIsAssigning] = React.useState(false);

  // Comment input
  const [commentText, setCommentText] = React.useState("");
  const [isPostingComment, setIsPostingComment] = React.useState(false);

  // Decision modals
  const [isApproveOpen, setIsApproveOpen] = React.useState(false);
  const [isRejectOpen, setIsRejectOpen] = React.useState(false);
  const [isRevisionOpen, setIsRevisionOpen] = React.useState(false);
  const [decisionReason, setDecisionReason] = React.useState("");
  const [isOverrideConfirmed, setIsOverrideConfirmed] = React.useState(false);
  const [overrideReason, setOverrideReason] = React.useState("");
  const [isSubmittingDecision, setIsSubmittingDecision] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  // Version diff selector
  const [diffBaseVer, setDiffBaseVer] = React.useState<number>(1);
  const [diffCompareVer, setDiffCompareVer] = React.useState<number>(
    versions[versions.length - 1]?.version_no || 1
  );

  const canReview = ["reviewer", "brand_manager", "admin"].includes(currentUserRole);
  const canAssign = ["brand_manager", "admin"].includes(currentUserRole);
  const isAdmin = currentUserRole === "admin";

  const unresolvedCriticalCount = findings.filter(
    (f) => f.severity === "CRITICAL" && !f.is_resolved
  ).length;

  // Base and Compare texts for diff
  const baseText = versions.find((v) => v.version_no === diffBaseVer)?.body || "";
  const compareText = versions.find((v) => v.version_no === diffCompareVer)?.body || "";
  const diffWords: Change[] = React.useMemo(() => {
    return diffWordsWithSpace(baseText, compareText);
  }, [baseText, compareText]);

  // Handlers
  async function handleToggleResolved(finding: ReviewFinding) {
    const nextState = !finding.is_resolved;
    setFindings((prev) =>
      prev.map((f) => (f.id === finding.id ? { ...f, is_resolved: nextState } : f))
    );

    const res = await toggleFindingResolvedAction({
      findingId: finding.id,
      isResolved: nextState,
      contentItemId: contentItem.id,
    });

    if (!res.success) {
      setFindings((prev) =>
        prev.map((f) => (f.id === finding.id ? { ...f, is_resolved: !nextState } : f))
      );
      alert(res.error || "Failed to update finding status");
    }
  }

  async function handleAssignReviewer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReviewerId) return;

    setIsAssigning(true);
    setActionError(null);

    const res = await assignReviewerAction({
      contentItemId: contentItem.id,
      reviewerId: selectedReviewerId,
      notes: assignmentNotes.trim() || undefined,
    });

    setIsAssigning(false);

    if (res.success) {
      const assigned = qualifiedReviewers.find((r) => r.userId === selectedReviewerId);
      setAssignments((prev) => [
        {
          id: `asg-${Date.now()}`,
          status: "IN_REVIEW",
          notes: assignmentNotes,
          created_at: new Date().toISOString(),
          reviewer_id: selectedReviewerId,
          reviewer_name: assigned?.fullName || "Reviewer",
          reviewer_email: assigned?.email,
        },
        ...prev,
      ]);
      setCurrentStatus("IN_REVIEW");
      setActionSuccess(`Assigned reviewer ${assigned?.fullName || ""}. Status updated to IN REVIEW.`);
      setAssignmentNotes("");
    } else {
      setActionError(res.error || "Failed to assign reviewer.");
    }
  }

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsPostingComment(true);
    setActionError(null);

    const res = await addReviewCommentAction({
      contentItemId: contentItem.id,
      comment: commentText.trim(),
    });

    setIsPostingComment(false);

    if (res.success) {
      setComments((prev) => [
        ...prev,
        {
          id: `c-${Date.now()}`,
          comment: commentText.trim(),
          created_at: new Date().toISOString(),
          author_name: "You",
        },
      ]);
      setCommentText("");
    } else {
      setActionError(res.error || "Failed to post comment.");
    }
  }

  async function handleDecisionSubmit(
    decision: "APPROVED" | "REJECTED" | "REVISION_REQUESTED",
    isOverride: boolean = false
  ) {
    setIsSubmittingDecision(true);
    setActionError(null);

    const res = await recordApprovalAction({
      contentItemId: contentItem.id,
      decision,
      reason: decisionReason.trim() || (decision === "APPROVED" ? "All brand guidelines verified." : ""),
      isOverride,
      overrideReason: isOverride ? overrideReason.trim() : undefined,
    });

    setIsSubmittingDecision(false);

    if (res.success) {
      const newStatus =
        decision === "APPROVED"
          ? "READY_TO_PUBLISH"
          : decision === "REJECTED"
          ? "REJECTED"
          : "REVISION_REQUIRED";

      setCurrentStatus(newStatus);
      setDecisions((prev) => [
        {
          id: `dec-${Date.now()}`,
          decision,
          reason: decisionReason,
          is_override: isOverride,
          override_reason: overrideReason,
          created_at: new Date().toISOString(),
          decider_name: "You",
        },
        ...prev,
      ]);

      setIsApproveOpen(false);
      setIsRejectOpen(false);
      setIsRevisionOpen(false);
      setDecisionReason("");
      setOverrideReason("");
      setIsOverrideConfirmed(false);

      setActionSuccess(
        `Decision ${decision.replace(/_/g, " ")} recorded successfully. Content status updated to ${newStatus.replace(/_/g, " ")}.`
      );
    } else {
      setActionError(res.error || "Failed to record decision.");
    }
  }

  const statusBadgeColor =
    currentStatus === "APPROVED" || currentStatus === "READY_TO_PUBLISH"
      ? "bg-[#B7F28B] text-[#17251C]"
      : currentStatus === "REJECTED"
      ? "bg-[#D94C4C] text-white"
      : currentStatus === "REVISION_REQUIRED"
      ? "bg-[#E6A23C] text-[#17251C]"
      : currentStatus === "IN_REVIEW"
      ? "bg-[#16834A] text-white"
      : "bg-[#F4F1E8] text-[#17251C]";

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. Header Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/reviews"
          className="inline-flex items-center space-x-1.5 font-mono text-xs font-bold text-[#17251C] hover:text-[#16834A] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>&larr; BACK TO REVIEW QUEUE</span>
        </Link>
        <span className="font-mono text-xs text-[#637367]">
          Logged in as: <strong className="text-[#17251C] uppercase">{currentUserRole.replace(/_/g, " ")}</strong>
        </span>
      </div>

      {/* 2. Main Item Meta Panel */}
      <div className="brutal-panel bg-white p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b-2 border-[#253C2B] pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <SectionLabel number="06" title="FORMAL HUMAN REVIEW WORKBENCH" />
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-[#F4F1E8] brutal-border">
                {contentItem.content_type} &bull; {contentItem.platform}
              </span>
            </div>
            <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
              {contentItem.title}
            </h1>
            <p className="text-xs text-[#637367] mt-0.5 font-mono">
              Authored by <strong className="text-[#17251C]">{contentItem.creator_name}</strong> &bull; {contentItem.department} &bull; Created {new Date(contentItem.created_at).toLocaleDateString()}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`font-mono text-xs font-extrabold px-2.5 py-1 brutal-border ${statusBadgeColor}`}>
              STATUS: {currentStatus.replace(/_/g, " ")}
            </span>
            {latestAudit && (
              <Link href={`/audits/${latestAudit.id}`}>
                <Button variant="secondary" size="md" className="flex items-center space-x-1 font-mono text-xs">
                  <FileText className="w-3.5 h-3.5" />
                  <span>AUDIT REPORT ({latestAudit.overall_score ?? "--"}/100) &rarr;</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Action feedback banners */}
        {actionSuccess && (
          <div className="p-3 bg-[#DDEBDD] border-2 border-[#16834A] text-[#16834A] text-xs font-mono font-bold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="p-3 bg-[#F4F1E8] border-2 border-[#D94C4C] text-[#D94C4C] text-xs font-mono font-bold flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* 3. Role Governance Action Bar */}
        {canReview && (
          <div className="p-4 bg-[#F4F1E8] brutal-border space-y-3">
            <div className="flex items-center justify-between border-b border-[#253C2B]/20 pb-2">
              <span className="font-mono text-xs font-bold uppercase text-[#17251C]">
                GOVERNANCE ACTIONS &bull; YOUR ROLE: {currentUserRole.toUpperCase()}
              </span>
              {unresolvedCriticalCount > 0 ? (
                <span className="font-mono text-[10px] font-extrabold px-2 py-0.5 bg-[#D94C4C] text-white brutal-border">
                  {unresolvedCriticalCount} UNRESOLVED CRITICAL BLOCKS
                </span>
              ) : (
                <span className="font-mono text-[10px] font-extrabold px-2 py-0.5 bg-[#B7F28B] text-[#17251C] brutal-border">
                  ZERO CRITICAL BLOCKS
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Request Changes Button */}
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setActionError(null);
                  setIsRevisionOpen(true);
                }}
                className="font-mono text-xs"
              >
                REQUEST CHANGES...
              </Button>

              {/* Reject Button */}
              <Button
                variant="danger"
                size="md"
                onClick={() => {
                  setActionError(null);
                  setIsRejectOpen(true);
                }}
                className="font-mono text-xs"
              >
                REJECT SUBMISSION...
              </Button>

              {/* Approve Button / Critical Block Gate */}
              {unresolvedCriticalCount === 0 ? (
                <Button
                  data-tour="tour-review-actions"
                  variant="lime"
                  size="md"
                  onClick={() => {
                    setActionError(null);
                    setIsApproveOpen(true);
                  }}
                  className="font-mono text-xs font-bold"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  <span>APPROVE CONTENT &rarr; READY TO PUBLISH</span>
                </Button>
              ) : isAdmin ? (
                <Button
                  data-tour="tour-admin-override"
                  variant="danger"
                  size="md"
                  onClick={() => {
                    setActionError(null);
                    setIsApproveOpen(true);
                  }}
                  className="font-mono text-xs font-bold"
                >
                  <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                  <span>ADMIN OVERRIDE CRITICAL & APPROVE...</span>
                </Button>
              ) : (
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    data-tour="tour-critical-block"
                    disabled
                    title="Approval is strictly blocked while CRITICAL findings remain unresolved. Only an Administrator can execute an override."
                    className="px-4 py-2 bg-[#637367]/20 border-2 border-[#637367] text-[#637367] font-mono text-xs font-bold cursor-not-allowed flex items-center space-x-1.5"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>APPROVAL BLOCKED ({unresolvedCriticalCount} CRITICAL FINDINGS)</span>
                  </button>
                  <HelpTip
                    text="Approval is strictly blocked while CRITICAL findings remain unresolved. Remediate findings or require Admin override."
                    articleHash="critical-finding-block"
                  />
                </div>
              )}
            </div>

            {/* Critical Block Warning Banner */}
            {unresolvedCriticalCount > 0 && (
              <div data-tour="tour-critical-block" className="p-3 bg-[#D94C4C]/10 border-2 border-[#D94C4C] text-[#D94C4C] font-mono text-xs space-y-1">
                <div className="flex items-center justify-between font-bold uppercase">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>APPROVAL BLOCKED BY POSTGRESQL GOVERNANCE ENGINE</span>
                  </div>
                  <HelpTip
                    text="Governance safety lock: content items with unresolved CRITICAL findings cannot be approved until remediated or granted an admin exception."
                    articleHash="critical-finding-block"
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-[#17251C]">
                  This content contains <strong>{unresolvedCriticalCount} unresolved CRITICAL finding(s)</strong> (e.g. contradicted claims or severe guideline breaches). In accordance with policy, approval is rejected at the database level unless all critical findings are resolved or an Administrator submits a documented executive override (minimum 15 characters).
                </p>
              </div>
            )}
          </div>
        )}

        {/* Reviewer Assignment Panel for Brand Manager & Admin */}
        {canAssign && (
          <form data-tour="tour-assign-reviewers" onSubmit={handleAssignReviewer} className="p-3.5 bg-white brutal-border space-y-2">
            <span className="font-mono text-xs font-bold uppercase text-[#17251C] flex items-center space-x-1.5">
              <UserCheck className="w-4 h-4 text-[#16834A]" />
              <span>ASSIGN REVIEWER (BRAND MANAGER / ADMIN)</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <div className="sm:col-span-5">
                <select
                  value={selectedReviewerId}
                  onChange={(e) => setSelectedReviewerId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F4F1E8] brutal-border font-mono text-xs text-[#17251C] focus:outline-none"
                >
                  {qualifiedReviewers.map((r) => (
                    <option key={r.userId} value={r.userId}>
                      {r.fullName} ({r.role.toUpperCase()} &bull; {r.department})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-5">
                <input
                  type="text"
                  placeholder="Review instructions or handover notes (optional)..."
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F4F1E8] brutal-border font-mono text-xs text-[#17251C] focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isAssigning || !selectedReviewerId}
                  className="w-full font-mono text-xs"
                >
                  {isAssigning ? "ASSIGNING..." : "ASSIGN"}
                </Button>
              </div>
            </div>

            {assignments.length > 0 && (
              <div className="pt-2 border-t border-[#253C2B]/10 font-mono text-[11px] text-[#637367] flex items-center space-x-2">
                <span>Current Assignee:</span>
                <span className="font-bold text-[#17251C]">
                  {assignments[0].reviewer_name}
                </span>
                <span>&bull; Status: {assignments[0].status}</span>
              </div>
            )}
          </form>
        )}
      </div>

      {/* 4. Tab Navigation */}
      <div className="flex flex-wrap gap-2 font-mono text-xs border-b-2 border-[#253C2B] pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("findings")}
          className={`px-4 py-2 brutal-border font-bold uppercase transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === "findings"
              ? "bg-[#16834A] text-white brutal-shadow-sm translate-x-[-1px] translate-y-[-1px]"
              : "bg-white text-[#17251C] hover:bg-[#DDEBDD]"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>01 FINDINGS & EVIDENCE ({findings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("diff")}
          className={`px-4 py-2 brutal-border font-bold uppercase transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === "diff"
              ? "bg-[#16834A] text-white brutal-shadow-sm translate-x-[-1px] translate-y-[-1px]"
              : "bg-white text-[#17251C] hover:bg-[#DDEBDD]"
          }`}
        >
          <GitBranch className="w-4 h-4" />
          <span>02 CONTENT & VERSION DIFF ({versions.length} VERSIONS)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("comments")}
          className={`px-4 py-2 brutal-border font-bold uppercase transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === "comments"
              ? "bg-[#16834A] text-white brutal-shadow-sm translate-x-[-1px] translate-y-[-1px]"
              : "bg-white text-[#17251C] hover:bg-[#DDEBDD]"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>03 REVIEW COMMENTS ({comments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("decisions")}
          className={`px-4 py-2 brutal-border font-bold uppercase transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === "decisions"
              ? "bg-[#16834A] text-white brutal-shadow-sm translate-x-[-1px] translate-y-[-1px]"
              : "bg-white text-[#17251C] hover:bg-[#DDEBDD]"
          }`}
        >
          <History className="w-4 h-4" />
          <span>04 DECISION & AUDIT HISTORY ({decisions.length})</span>
        </button>
      </div>

      {/* 5. TAB 1: FINDINGS & EVIDENCE */}
      {activeTab === "findings" && (
        <div className="space-y-4">
          {findings.length === 0 ? (
            <div className="brutal-panel bg-white p-8 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[#16834A] mx-auto" />
              <h4 className="font-mono font-bold text-sm text-[#17251C]">
                NO DETECTED FINDINGS
              </h4>
              <p className="text-xs text-[#637367] font-mono">
                This content has zero infractions flagged across verified claim reliability, tone voice, and terminology.
              </p>
            </div>
          ) : (
            findings.map((finding) => (
              <div
                key={finding.id}
                className={`brutal-panel bg-white p-5 space-y-3 transition-all ${
                  finding.is_resolved
                    ? "opacity-60 bg-[#DDEBDD]/20 border-[#637367]"
                    : finding.severity === "CRITICAL"
                    ? "border-l-4 border-l-[#D94C4C]"
                    : "hover:bg-[#F4F1E8]"
                }`}
              >
                {/* Finding Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#253C2B]/15 pb-2 font-mono">
                  <div className="flex items-center space-x-2">
                    <IdTag id={finding.id.slice(0, 8)} prefix="FIND-" />
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.2 brutal-border ${
                        finding.source === "AI" || finding.confidence_note === "AI" || finding.id?.includes("AI")
                          ? "bg-[#17251C] text-[#B7F28B]"
                          : "bg-[#F4F1E8] text-[#637367]"
                      }`}
                    >
                      {finding.source === "AI" || finding.confidence_note === "AI" || finding.id?.includes("AI") ? "AI" : "Rule"}
                    </span>
                    <SeverityChip severity={finding.severity as any} />
                    {finding.verification_status && (
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.2 brutal-border ${
                          finding.verification_status === "CONTRADICTED"
                            ? "bg-[#D94C4C] text-white"
                            : finding.verification_status === "OUTDATED"
                            ? "bg-[#E6A23C] text-[#17251C]"
                            : finding.verification_status === "VERIFIED"
                            ? "bg-[#B7F28B] text-[#17251C]"
                            : "bg-[#F4F1E8] text-[#17251C]"
                        }`}
                      >
                        {finding.verification_status}
                      </span>
                    )}
                    {finding.is_resolved && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-[#16834A] text-white brutal-border">
                        RESOLVED
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-[#637367] uppercase font-bold">
                    CATEGORY: {finding.category}
                  </span>
                </div>

                {/* Excerpt */}
                <div className="space-y-1">
                  <span className="font-mono text-[10px] text-[#637367] block uppercase">
                    FLAGGED EVIDENCE / EXCERPT:
                  </span>
                  <div className="font-mono text-xs font-bold text-[#17251C] bg-[#F4F1E8] p-2.5 brutal-border">
                    &ldquo;{finding.excerpt}&rdquo;
                  </div>
                </div>

                {/* Explanation */}
                <div>
                  <span className="font-mono text-[10px] text-[#637367] block uppercase">
                    ANALYSIS & RATIONALE:
                  </span>
                  <p className="text-xs text-[#17251C] font-medium leading-relaxed mt-0.5">
                    {finding.explanation}
                  </p>
                </div>

                {/* Guideline / Source */}
                {finding.guideline_reference && (
                  <div className="p-2.5 bg-[#F4F1E8] brutal-border font-mono text-xs flex items-start space-x-2">
                    <Scale className="w-3.5 h-3.5 text-[#16834A] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] text-[#637367] block">AUTHORITATIVE GUIDELINE / BENCHMARK SOURCE:</span>
                      <span className="font-bold text-[#17251C]">{finding.guideline_reference}</span>
                    </div>
                  </div>
                )}

                {/* Suggested replacement */}
                {finding.suggested_replacement && (
                  <div className="p-2.5 bg-[#DDEBDD] brutal-border font-mono text-xs space-y-1">
                    <span className="text-[10px] font-bold text-[#16834A] block uppercase">
                      RECOMMENDED INTENT-PRESERVING REWRITE:
                    </span>
                    <p className="font-bold text-[#17251C]">{finding.suggested_replacement}</p>
                  </div>
                )}

                {/* Remediation & Resolution controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#253C2B]/10 font-mono text-xs">
                  <div>
                    <span className="text-[#637367] text-[10px] block">RECOMMENDED ACTION:</span>
                    <span className="font-bold text-[#16834A]">{finding.recommended_action}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {(finding.category === "claims" ||
                      finding.category === "claim_reliability" ||
                      finding.category?.toLowerCase().includes("claim")) && (
                      <Link
                        href={`/provenance?claim=${encodeURIComponent(finding.excerpt)}${
                          latestAudit?.id ? `&auditId=${latestAudit.id}` : ""
                        }`}
                        className="brutal-btn brutal-btn-secondary px-2.5 py-1 text-[11px] flex items-center space-x-1"
                      >
                        <ExternalLink className="w-3 h-3 text-[#16834A]" />
                        <span>PROVENANCE &rarr;</span>
                      </Link>
                    )}

                    {canReview && (
                      <button
                        type="button"
                        onClick={() => handleToggleResolved(finding)}
                        className={`brutal-btn px-3 py-1.5 text-xs flex items-center space-x-1.5 ${
                          finding.is_resolved ? "brutal-btn-secondary" : "brutal-btn-lime"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{finding.is_resolved ? "MARK UNRESOLVED" : "MARK AS RESOLVED"}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 6. TAB 2: CONTENT & VERSION DIFF */}
      {activeTab === "diff" && (
        <div className="brutal-panel bg-white p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#253C2B] pb-3 font-mono">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#17251C]">
                WORD-LEVEL VERSION COMPARISON
              </h3>
              <p className="text-[11px] text-[#637367]">
                Compare original submission (Version 1) against revised or accepted rewrites.
              </p>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-1.5">
                <span className="text-[#637367]">Base:</span>
                <select
                  value={diffBaseVer}
                  onChange={(e) => setDiffBaseVer(Number(e.target.value))}
                  className="px-2 py-1 bg-[#F4F1E8] brutal-border font-bold"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.version_no}>
                      v{v.version_no} ({v.source})
                    </option>
                  ))}
                </select>
              </div>

              <span>&rarr;</span>

              <div className="flex items-center space-x-1.5">
                <span className="text-[#637367]">Compare:</span>
                <select
                  value={diffCompareVer}
                  onChange={(e) => setDiffCompareVer(Number(e.target.value))}
                  className="px-2 py-1 bg-[#F4F1E8] brutal-border font-bold"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.version_no}>
                      v{v.version_no} ({v.source})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Visual Diff Box */}
          <div className="p-4 bg-[#F4F1E8] brutal-border font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {diffWords.map((part, index) => {
              if (part.added) {
                return (
                  <span
                    key={index}
                    className="bg-[#B7F28B] text-[#17251C] px-1 py-0.5 font-bold underline"
                  >
                    {part.value}
                  </span>
                );
              }
              if (part.removed) {
                return (
                  <span
                    key={index}
                    className="bg-[#D94C4C]/30 text-[#D94C4C] line-through px-1 py-0.5"
                  >
                    {part.value}
                  </span>
                );
              }
              return <span key={index}>{part.value}</span>;
            })}
          </div>

          <div className="flex items-center space-x-4 font-mono text-[11px] text-[#637367]">
            <span className="flex items-center space-x-1">
              <span className="w-3 h-3 bg-[#B7F28B] border border-[#253C2B] inline-block" />
              <span>Added words</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-3 h-3 bg-[#D94C4C]/30 border border-[#253C2B] inline-block" />
              <span className="line-through">Removed words</span>
            </span>
          </div>

          {/* Version Chronology Table */}
          <div className="pt-4 border-t-2 border-[#253C2B] space-y-2">
            <h4 className="font-mono font-bold text-xs uppercase text-[#17251C]">
              IMMUTABLE VERSION RECORDS ({versions.length})
            </h4>
            <div className="space-y-2">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="p-3 bg-[#F4F1E8] brutal-border font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <span className="px-1.5 py-0.5 bg-[#17251C] text-white font-extrabold text-[10px]">
                      VERSION {v.version_no}
                    </span>
                    <span className="text-[#637367] uppercase text-[10px]">({v.source})</span>
                    <span className="font-bold text-[#17251C] truncate max-w-md">
                      {v.change_summary || "Submission"}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#637367]">
                    {new Date(v.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. TAB 3: COMMENTS & DISCUSSION */}
      {activeTab === "comments" && (
        <div className="brutal-panel bg-white p-5 space-y-5">
          <div className="border-b-2 border-[#253C2B] pb-3">
            <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
              INTERNAL REVIEW DISCUSSION TIMELINE
            </h3>
            <p className="font-mono text-[11px] text-[#637367]">
              Immutable review comments logged to activity audit trails.
            </p>
          </div>

          {/* New Comment Input */}
          <form onSubmit={handlePostComment} className="space-y-2">
            <textarea
              rows={3}
              placeholder="Add review feedback, evidence citations, or compliance questions..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full p-3 bg-[#F4F1E8] brutal-border font-mono text-xs text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isPostingComment || !commentText.trim()}
                className="font-mono text-xs flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isPostingComment ? "POSTING..." : "POST COMMENT"}</span>
              </Button>
            </div>
          </form>

          {/* Comments List */}
          <div className="space-y-3 pt-2">
            {comments.length === 0 ? (
              <p className="font-mono text-xs text-[#637367] italic text-center py-6">
                No discussion comments posted yet.
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="p-3.5 bg-[#F4F1E8] brutal-border font-mono text-xs space-y-1.5">
                  <div className="flex items-center justify-between border-b border-[#253C2B]/10 pb-1 text-[11px]">
                    <span className="font-bold text-[#17251C]">{c.author_name}</span>
                    <span className="text-[#637367]">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-[#17251C] leading-relaxed whitespace-pre-wrap">{c.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 8. TAB 4: DECISION & AUDIT HISTORY */}
      {activeTab === "decisions" && (
        <div className="brutal-panel bg-white p-5 space-y-5">
          <div className="border-b-2 border-[#253C2B] pb-3">
            <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
              FORMAL APPROVAL & OVERRIDE AUDIT LOG
            </h3>
            <p className="font-mono text-[11px] text-[#637367]">
              Tamper-evident record of all status changes, rejections, overrides, and publication sign-offs.
            </p>
          </div>

          <div className="space-y-3">
            {decisions.length === 0 ? (
              <p className="font-mono text-xs text-[#637367] italic text-center py-6">
                No formal decisions recorded yet.
              </p>
            ) : (
              decisions.map((d) => (
                <div
                  key={d.id}
                  className={`p-4 brutal-border font-mono text-xs space-y-2 ${
                    d.decision === "APPROVED"
                      ? "bg-[#DDEBDD]"
                      : d.decision === "REJECTED"
                      ? "bg-[#D94C4C]/15"
                      : "bg-[#F4F1E8]"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-[#253C2B]/15 pb-1.5">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`font-extrabold px-1.5 py-0.5 brutal-border ${
                          d.decision === "APPROVED"
                            ? "bg-[#16834A] text-white"
                            : d.decision === "REJECTED"
                            ? "bg-[#D94C4C] text-white"
                            : "bg-[#E6A23C] text-[#17251C]"
                        }`}
                      >
                        {d.decision}
                      </span>
                      {d.is_override && (
                        <span className="font-extrabold px-1.5 py-0.5 bg-[#D94C4C] text-white brutal-border">
                          ADMIN OVERRIDE
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#637367]">
                      {new Date(d.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-[#637367] block">DECIDER:</span>
                    <span className="font-bold text-[#17251C]">{d.decider_name}</span>
                  </div>

                  {d.reason && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-[#637367] block">DOCUMENTED REASON:</span>
                      <p className="text-[#17251C]">{d.reason}</p>
                    </div>
                  )}

                  {d.is_override && d.override_reason && (
                    <div className="p-2.5 bg-white border-2 border-[#D94C4C] text-[#D94C4C] space-y-1">
                      <span className="font-bold text-[10px] block uppercase">
                        EXECUTIVE OVERRIDE JUSTIFICATION:
                      </span>
                      <p className="text-[#17251C]">{d.override_reason}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 9. APPROVAL MODAL (WITH ADMIN CRITICAL OVERRIDE GATE) */}
      <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
        <div className="space-y-4 font-mono">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold uppercase text-[#17251C]">
              {unresolvedCriticalCount > 0 ? "EXECUTIVE OVERRIDE & APPROVAL" : "FORMAL CONTENT APPROVAL"}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#637367]">
              {unresolvedCriticalCount > 0
                ? "Unresolved critical findings exist. Only an Administrator can execute this override with a mandatory justification."
                : "Certifies this content satisfies brand accuracy guidelines and moves it to READY TO PUBLISH."}
            </DialogDescription>
          </DialogHeader>

          {unresolvedCriticalCount > 0 && (
            <div className="p-3 bg-[#D94C4C]/10 border-2 border-[#D94C4C] text-[#D94C4C] text-xs space-y-3">
              <div className="flex items-center space-x-2 font-bold uppercase">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>CRITICAL INFRACTION WARNING</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[#17251C]">
                Content contains {unresolvedCriticalCount} critical finding(s). By executing an override, you take administrative accountability for publication.
              </p>

              <label className="flex items-start space-x-2 cursor-pointer pt-1 border-t border-[#D94C4C]/30">
                <input
                  type="checkbox"
                  checked={isOverrideConfirmed}
                  onChange={(e) => setIsOverrideConfirmed(e.target.checked)}
                  className="mt-0.5 accent-[#16834A]"
                />
                <span className="text-xs font-bold text-[#17251C]">
                  I confirm executive override of unresolved critical infractions
                </span>
              </label>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[#17251C] mb-1">
                  Mandatory Override Justification (Min 15 Characters) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Legal approved claim exemption per internal test pilot validation memo #2026-09"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full p-2.5 bg-white brutal-border text-xs text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
                />
                <span className="text-[10px] text-[#637367] block text-right">
                  {overrideReason.trim().length} / 15 characters minimum
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-[#17251C] mb-1">
              Approval Sign-Off Note (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Verified against latest Q4 messaging pillars and factual vault."
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              className="w-full p-2.5 bg-[#F4F1E8] brutal-border text-xs text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button
              variant="outline"
              size="md"
              disabled={isSubmittingDecision}
              onClick={() => setIsApproveOpen(false)}
            >
              CANCEL
            </Button>
            <Button
              variant={unresolvedCriticalCount > 0 ? "danger" : "lime"}
              size="md"
              disabled={
                isSubmittingDecision ||
                (unresolvedCriticalCount > 0 &&
                  (!isOverrideConfirmed || overrideReason.trim().length < 15))
              }
              onClick={() => handleDecisionSubmit("APPROVED", unresolvedCriticalCount > 0)}
              className="font-bold"
            >
              {isSubmittingDecision ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
                  <span>RECORDING DECISION...</span>
                </>
              ) : unresolvedCriticalCount > 0 ? (
                "CONFIRM OVERRIDE & APPROVE"
              ) : (
                "APPROVE CONTENT &rarr; READY TO PUBLISH"
              )}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* 10. REQUEST CHANGES MODAL */}
      <Dialog open={isRevisionOpen} onOpenChange={setIsRevisionOpen}>
        <div className="space-y-4 font-mono">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold uppercase text-[#17251C]">
              REQUEST REVISIONS
            </DialogTitle>
            <DialogDescription className="text-xs text-[#637367]">
              Content status will transition to REVISION REQUIRED and the author will be notified.
            </DialogDescription>
          </DialogHeader>

          <div>
            <label className="block text-xs font-bold uppercase text-[#17251C] mb-1">
              Required Change Rationale (Mandatory) *
            </label>
            <textarea
              rows={3}
              required
              placeholder="Explain required changes, unverified stats, or tone adjustments..."
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              className="w-full p-2.5 bg-[#F4F1E8] brutal-border text-xs text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button
              variant="outline"
              size="md"
              disabled={isSubmittingDecision}
              onClick={() => setIsRevisionOpen(false)}
            >
              CANCEL
            </Button>
            <Button
              variant="secondary"
              size="md"
              disabled={isSubmittingDecision || decisionReason.trim().length < 5}
              onClick={() => handleDecisionSubmit("REVISION_REQUESTED", false)}
              className="font-bold bg-[#E6A23C] text-[#17251C]"
            >
              {isSubmittingDecision ? "RECORDING..." : "SUBMIT REVISION REQUEST"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* 11. REJECT MODAL */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <div className="space-y-4 font-mono">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold uppercase text-[#17251C]">
              REJECT CONTENT SUBMISSION
            </DialogTitle>
            <DialogDescription className="text-xs text-[#637367]">
              Status will transition to REJECTED. A documented rationale is required.
            </DialogDescription>
          </DialogHeader>

          <div>
            <label className="block text-xs font-bold uppercase text-[#17251C] mb-1">
              Rejection Rationale (Mandatory) *
            </label>
            <textarea
              rows={3}
              required
              placeholder="State policy breach, contradictory evidence, or disqualification reason..."
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              className="w-full p-2.5 bg-[#F4F1E8] brutal-border text-xs text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button
              variant="outline"
              size="md"
              disabled={isSubmittingDecision}
              onClick={() => setIsRejectOpen(false)}
            >
              CANCEL
            </Button>
            <Button
              variant="danger"
              size="md"
              disabled={isSubmittingDecision || decisionReason.trim().length < 5}
              onClick={() => handleDecisionSubmit("REJECTED", false)}
              className="font-bold"
            >
              {isSubmittingDecision ? "RECORDING..." : "CONFIRM REJECTION"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
