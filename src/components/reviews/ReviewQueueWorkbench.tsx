"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { IdTag } from "@/components/ui/id-tag";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { recordApprovalAction, assignReviewerAction, ApprovalDecisionType } from "@/app/actions/governance";
import { decideChallengeAction, ChallengeDecisionType } from "@/app/actions/challenges";
import {
  CheckSquare,
  Scale,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  UserCheck,
} from "lucide-react";

export interface ReviewQueueItem {
  id: string;
  title: string;
  content_type: string;
  platform: string;
  department: string;
  status: string;
  created_at: string;
  assigned_reviewer_id?: string | null;
  author?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
  assigned_reviewer?: {
    full_name?: string | null;
  } | null;
  latest_audit?: {
    id: string;
    overall_score: number | null;
    status: string;
    critical_findings_count: number;
    findings?: Array<{
      id: string;
      category: string;
      severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
      excerpt: string;
      explanation: string;
      is_resolved: boolean;
    }>;
  } | null;
  versions?: Array<{
    id: string;
    version_no: number;
    body: string;
    created_at: string;
  }>;
}

export interface ChallengeItem {
  id: string;
  finding_id: string;
  reason: string;
  context?: string | null;
  status: string;
  created_at: string;
  submitted_by_profile?: {
    full_name?: string | null;
  } | null;
  finding?: {
    excerpt: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
    category: string;
    explanation: string;
  } | null;
}

interface ReviewerOption {
  id: string;
  name: string;
  role: string;
}

export function ReviewQueueWorkbench({
  queueItems,
  challenges,
  reviewers,
  userRole,
  initialSelectedItemId,
}: {
  queueItems: ReviewQueueItem[];
  challenges: ChallengeItem[];
  reviewers: ReviewerOption[];
  userRole: string;
  initialSelectedItemId?: string;
}) {
  const [items, setItems] = React.useState<ReviewQueueItem[]>(queueItems);
  const [challengesList, setChallengesList] = React.useState<ChallengeItem[]>(challenges);
  const [activeTab, setActiveTab] = React.useState<"queue" | "court">("queue");

  // Selection
  const [selectedItemId, setSelectedItemId] = React.useState<string>(
    initialSelectedItemId || queueItems[0]?.id || ""
  );

  // Review Form state
  const [decision, setDecision] = React.useState<ApprovalDecisionType>("APPROVED");
  const [reason, setReason] = React.useState("");
  const [isOverride, setIsOverride] = React.useState(false);
  const [overrideReason, setOverrideReason] = React.useState("");
  const [selectedReviewerId, setSelectedReviewerId] = React.useState("");
  const [isSubmittingDecision, setIsSubmittingDecision] = React.useState(false);
  const [decisionError, setDecisionError] = React.useState<string | null>(null);
  const [decisionSuccess, setDecisionSuccess] = React.useState<string | null>(null);

  // Court Challenge Modal state
  const [selectedChallenge, setSelectedChallenge] = React.useState<ChallengeItem | null>(null);
  const [challengeDecision, setChallengeDecision] = React.useState<ChallengeDecisionType>("UPHOLD");
  const [challengeReason, setChallengeReason] = React.useState("");
  const [isSubmittingCourt, setIsSubmittingCourt] = React.useState(false);
  const [courtFeedback, setCourtFeedback] = React.useState<string | null>(null);

  const selectedItem = items.find((item) => item.id === selectedItemId);
  const unresolvedCriticalCount = selectedItem?.latest_audit?.critical_findings_count || 0;
  const isAdmin = userRole === "admin";
  const canDecide = userRole === "admin" || userRole === "brand_manager" || userRole === "reviewer";

  async function handleDecisionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem) return;
    if (reason.trim().length < 10) {
      setDecisionError("Documented rationale must be at least 10 characters.");
      return;
    }
    if (decision === "APPROVED" && unresolvedCriticalCount > 0 && (!isOverride || overrideReason.trim().length < 15)) {
      setDecisionError("Approving with unresolved CRITICAL findings requires an Admin Override and a reason of >= 15 characters.");
      return;
    }

    setIsSubmittingDecision(true);
    setDecisionError(null);
    setDecisionSuccess(null);

    try {
      const res = await recordApprovalAction({
        contentItemId: selectedItem.id,
        decision,
        reason: reason.trim(),
        isOverride,
        overrideReason: isOverride ? overrideReason.trim() : undefined,
      });

      if (res.success) {
        setDecisionSuccess(`Decision successfully recorded: ${res.status}.`);
        setItems((prev) =>
          prev.map((it) => (it.id === selectedItem.id ? { ...it, status: res.status } : it))
        );
        setReason("");
        setOverrideReason("");
        setIsOverride(false);
      }
    } catch (err: unknown) {
      setDecisionError(err instanceof Error ? err.message : "Failed to record approval decision");
    } finally {
      setIsSubmittingDecision(false);
    }
  }

  async function handleAssignReviewer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem || !selectedReviewerId) return;

    try {
      await assignReviewerAction({
        contentItemId: selectedItem.id,
        reviewerId: selectedReviewerId,
      });
      setItems((prev) =>
        prev.map((it) =>
          it.id === selectedItem.id
            ? {
                ...it,
                status: "IN_REVIEW",
                assigned_reviewer_id: selectedReviewerId,
                assigned_reviewer: {
                  full_name: reviewers.find((r) => r.id === selectedReviewerId)?.name,
                },
              }
            : it
        )
      );
      alert("Reviewer successfully assigned.");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to assign reviewer");
    }
  }

  async function handleCourtSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedChallenge) return;
    if (challengeReason.trim().length < 15) {
      alert("Justification must be at least 15 characters.");
      return;
    }

    setIsSubmittingCourt(true);
    setCourtFeedback(null);

    try {
      const res = await decideChallengeAction({
        challengeId: selectedChallenge.id,
        findingId: selectedChallenge.finding_id,
        decision: challengeDecision,
        reason: challengeReason.trim(),
      });

      if (res.success) {
        const newStatus =
          challengeDecision === "UPHOLD"
            ? "UPHELD"
            : challengeDecision === "REVERSE"
            ? "REVERSED"
            : "RESOLVED";
        setCourtFeedback(`Challenge adjudicated: ${challengeDecision}. Immutable event logged.`);
        setChallengesList((prev) =>
          prev.map((c) => (c.id === selectedChallenge.id ? { ...c, status: newStatus } : c))
        );
        setTimeout(() => {
          setSelectedChallenge(null);
          setChallengeReason("");
          setCourtFeedback(null);
        }, 1500);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to adjudicate challenge");
    } finally {
      setIsSubmittingCourt(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Mode Tabs */}
      <div className="brutal-panel bg-white p-2 flex flex-wrap gap-2 font-mono text-xs">
        <button
          type="button"
          onClick={() => setActiveTab("queue")}
          className={`px-4 py-2 brutal-border font-bold uppercase transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === "queue"
              ? "bg-[#16834A] text-white brutal-shadow-sm translate-x-[-1px] translate-y-[-1px]"
              : "bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD]"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>01 SUBMISSION REVIEW QUEUE</span>
          <span className="px-1.5 py-0.2 bg-white text-[#17251C] rounded-[1px] font-extrabold text-[10px]">
            {items.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("court")}
          className={`px-4 py-2 brutal-border font-bold uppercase transition-all flex items-center space-x-2 cursor-pointer ${
            activeTab === "court"
              ? "bg-[#16834A] text-white brutal-shadow-sm translate-x-[-1px] translate-y-[-1px]"
              : "bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD]"
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>02 BRAND MEMORY COURT QUEUE</span>
          <span className="px-1.5 py-0.2 bg-white text-[#17251C] rounded-[1px] font-extrabold text-[10px]">
            {challengesList.filter((c) => c.status === "PENDING").length}
          </span>
        </button>
      </div>

      {/* 2. TAB: SUBMISSION REVIEW QUEUE */}
      {activeTab === "queue" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Submissions Queue List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-2 font-mono text-xs">
              <span className="font-bold text-[#17251C] uppercase">
                PENDING SUBMISSIONS ({items.length})
              </span>
              <span className="text-[10px] text-[#637367]">Select to inspect</span>
            </div>

            <div className="space-y-2.5 max-h-[750px] overflow-y-auto">
              {items.map((item) => {
                const isSelected = item.id === selectedItemId;
                const statusColor =
                  item.status === "APPROVED"
                    ? "bg-[#B7F28B] text-[#17251C]"
                    : item.status === "REJECTED"
                    ? "bg-[#D94C4C] text-white"
                    : item.status === "REVISION_REQUIRED"
                    ? "bg-[#E6A23C] text-[#17251C]"
                    : "bg-[#16834A] text-white";

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedItemId(item.id);
                      setDecisionError(null);
                      setDecisionSuccess(null);
                    }}
                    className={`brutal-panel bg-white p-4 transition-all cursor-pointer ${
                      isSelected
                        ? "border-l-4 border-l-[#16834A] brutal-shadow"
                        : "hover:bg-[#F4F1E8]"
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] mb-1.5">
                      <span className="font-extrabold text-[#637367] uppercase">
                        {item.department} &bull; {item.platform}
                      </span>
                      <span className={`font-extrabold px-1.5 py-0.2 brutal-border ${statusColor}`}>
                        {item.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <h4 className="font-bold text-sm text-[#17251C] truncate mb-1">
                      {item.title}
                    </h4>

                    <div className="flex items-center justify-between font-mono text-[10px] text-[#637367] pt-1 border-t border-[#253C2B]/10">
                      <span>By {item.author?.full_name || "Creator"}</span>
                      {item.latest_audit && (
                        <span className="font-bold text-[#17251C]">
                          Score: {item.latest_audit.overall_score || "--"}/100
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Review Workbench (7 cols) */}
          <div className="lg:col-span-7">
            {selectedItem ? (
              <div className="brutal-panel bg-white p-6 space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-[#253C2B] pb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <IdTag id={selectedItem.id.slice(0, 8)} prefix="ITEM-" />
                      <span className="font-mono text-xs font-bold text-[#16834A]">
                        {selectedItem.content_type}
                      </span>
                    </div>
                    <h2 className="font-mono font-extrabold text-xl text-[#17251C] mt-1">
                      {selectedItem.title}
                    </h2>
                  </div>

                  {selectedItem.latest_audit && (
                    <Link
                      href={`/audits/${selectedItem.latest_audit.id}`}
                      className="brutal-btn brutal-btn-secondary px-3 py-1.5 text-xs font-mono font-bold flex items-center space-x-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>FULL AUDIT REPORT &rarr;</span>
                    </Link>
                  )}
                </div>

                {/* Score & Risk Alert */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                  <div className="p-3 bg-[#F4F1E8] brutal-border">
                    <span className="text-[10px] text-[#637367] block uppercase">INTEGRITY SCORE</span>
                    <span className="font-extrabold text-2xl text-[#17251C]">
                      {selectedItem.latest_audit?.overall_score ?? "--"}/100
                    </span>
                  </div>

                  <div className={`p-3 brutal-border ${unresolvedCriticalCount > 0 ? "bg-[#D94C4C]/20 border-[#D94C4C]" : "bg-[#F4F1E8]"}`}>
                    <span className="text-[10px] text-[#637367] block uppercase">CRITICAL FINDINGS</span>
                    <span className={`font-extrabold text-2xl ${unresolvedCriticalCount > 0 ? "text-[#D94C4C]" : "text-[#16834A]"}`}>
                      {unresolvedCriticalCount}
                    </span>
                  </div>

                  <div className="p-3 bg-[#F4F1E8] brutal-border">
                    <span className="text-[10px] text-[#637367] block uppercase">VERSION STATUS</span>
                    <span className="font-extrabold text-2xl text-[#17251C]">
                      v{selectedItem.versions?.[selectedItem.versions.length - 1]?.version_no || 1}
                    </span>
                  </div>
                </div>

                {/* Content Preview */}
                <div className="space-y-2 font-mono">
                  <span className="text-xs font-bold uppercase text-[#17251C] block">
                    CURRENT SUBMISSION BODY:
                  </span>
                  <div className="p-3 bg-[#F4F1E8] brutal-border text-xs text-[#17251C] leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {selectedItem.versions?.[selectedItem.versions.length - 1]?.body || "No content body recorded."}
                  </div>
                </div>

                {/* Assign Reviewer Form (Managers & Admins) */}
                {(userRole === "admin" || userRole === "brand_manager") && (
                  <form onSubmit={handleAssignReviewer} className="p-3 bg-[#F4F1E8] brutal-border flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs">
                    <div className="flex items-center space-x-2 w-full sm:w-auto">
                      <UserCheck className="w-4 h-4 text-[#16834A] shrink-0" />
                      <span className="font-bold text-[#17251C]">ASSIGN REVIEWER:</span>
                    </div>

                    <div className="flex items-center space-x-2 w-full sm:w-auto">
                      <select
                        value={selectedReviewerId}
                        onChange={(e) => setSelectedReviewerId(e.target.value)}
                        className="px-2.5 py-1.5 bg-white brutal-border text-xs focus:outline-none"
                      >
                        <option value="">-- Choose Reviewer --</option>
                        {reviewers.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.role})
                          </option>
                        ))}
                      </select>
                      <Button type="submit" variant="secondary" size="sm">
                        ASSIGN
                      </Button>
                    </div>
                  </form>
                )}

                {/* Formal Decision Recording Form */}
                {canDecide ? (
                  <form onSubmit={handleDecisionSubmit} className="space-y-4 pt-3 border-t-2 border-[#253C2B] font-mono text-xs">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[#17251C]">
                      RECORD FORMAL GOVERNANCE DECISION
                    </h3>

                    {/* Decision Choice */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: "APPROVED", label: "APPROVE", color: "hover:bg-[#B7F28B]" },
                        { key: "REVISION_REQUESTED", label: "REQUEST REVISIONS", color: "hover:bg-[#E6A23C]" },
                        { key: "REJECTED", label: "REJECT", color: "hover:bg-[#D94C4C] hover:text-white" },
                      ].map((d) => (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => setDecision(d.key as ApprovalDecisionType)}
                          className={`py-2 px-3 brutal-border font-bold text-xs uppercase transition-all ${
                            decision === d.key
                              ? "bg-[#17251C] text-[#B7F28B] brutal-shadow-sm"
                              : `bg-white text-[#17251C] ${d.color}`
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>

                    {/* Decision Reason */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-[#17251C] mb-1">
                        Decision Rationale * (min 10 characters)
                      </label>
                      <textarea
                        required
                        rows={2}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Document the empirical reasoning, regulatory basis, or revision directives for this decision..."
                        className="w-full p-2 bg-white brutal-border text-xs focus:outline-none resize-y"
                      />
                    </div>

                    {/* CRITICAL OVERRIDE GATING: Server-Enforced in PostgreSQL */}
                    {decision === "APPROVED" && unresolvedCriticalCount > 0 && (
                      <div className="p-3.5 bg-[#D94C4C]/15 border-2 border-[#D94C4C] space-y-2.5">
                        <div className="flex items-center space-x-2 text-[#D94C4C]">
                          <ShieldAlert className="w-5 h-5 shrink-0" />
                          <span className="font-extrabold uppercase">
                            APPROVAL BLOCKED: {unresolvedCriticalCount} UNRESOLVED CRITICAL FINDING(S)
                          </span>
                        </div>
                        <p className="text-[11px] text-[#17251C]">
                          The database function will reject standard approval attempts. Only an authorized Executive Administrator can override critical findings with an immutable justification.
                        </p>

                        {isAdmin ? (
                          <div className="space-y-2 pt-2 border-t border-[#D94C4C]/30">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isOverride}
                                onChange={(e) => setIsOverride(e.target.checked)}
                                className="w-4 h-4 brutal-border"
                              />
                              <span className="font-extrabold text-[#D94C4C] uppercase text-xs">
                                Confirm Admin Critical Override
                              </span>
                            </label>

                            {isOverride && (
                              <div>
                                <label className="block text-[10px] font-bold uppercase text-[#17251C] mb-1">
                                  Admin Override Justification * (min 15 chars)
                                </label>
                                <textarea
                                  required
                                  rows={2}
                                  value={overrideReason}
                                  onChange={(e) => setOverrideReason(e.target.value)}
                                  placeholder="Document high-level executive justification for overriding critical compliance restrictions..."
                                  className="w-full p-2 bg-white brutal-border text-xs focus:outline-none resize-y"
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-2 bg-white brutal-border text-[11px] font-bold text-[#D94C4C]">
                            Your current role ({userRole}) does not have admin override authority.
                          </div>
                        )}
                      </div>
                    )}

                    {decisionError && (
                      <div className="p-2.5 bg-[#F4F1E8] border-2 border-[#D94C4C] text-[#D94C4C] text-xs font-bold flex items-center space-x-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{decisionError}</span>
                      </div>
                    )}

                    {decisionSuccess && (
                      <div className="p-2.5 bg-[#DDEBDD] border-2 border-[#16834A] text-[#16834A] text-xs font-bold flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{decisionSuccess}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      disabled={isSubmittingDecision}
                      variant="lime"
                      size="md"
                      className="w-full flex items-center justify-center space-x-2"
                    >
                      {isSubmittingDecision ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>RECORDING GOVERNANCE DECISION...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>RECORD FORMAL GOVERNANCE DECISION &rarr;</span>
                        </>
                      )}
                    </Button>
                  </form>
                ) : (
                  <div className="p-3 bg-[#F4F1E8] brutal-border font-mono text-xs text-[#637367]">
                    Read-only view. Creator roles cannot adjudicate formal approval decisions.
                  </div>
                )}
              </div>
            ) : (
              <div className="brutal-panel bg-white p-8 text-center font-mono text-xs text-[#637367]">
                Select a submission from the left queue to inspect evidence and adjudicate sign-off.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. TAB: BRAND MEMORY COURT QUEUE */}
      {activeTab === "court" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-2 font-mono text-xs">
            <div className="flex items-center space-x-2">
              <Scale className="w-4 h-4 text-[#16834A]" />
              <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
                BRAND MEMORY COURT &mdash; CONTESTED FINDINGS QUEUE ({challengesList.length})
              </h3>
            </div>
            <span className="text-[10px] text-[#637367]">
              Adjudicate creator challenges with precedent-setting rulings
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {challengesList.map((challenge) => {
              const isPending = challenge.status === "PENDING";

              return (
                <div key={challenge.id} className="brutal-panel bg-white p-5 space-y-3 font-mono text-xs">
                  <div className="flex items-start justify-between border-b border-[#253C2B]/15 pb-2">
                    <div>
                      <span className="text-[10px] text-[#637367] uppercase block font-bold">
                        CHALLENGED FINDING:
                      </span>
                      <span className="font-extrabold text-sm text-[#17251C]">
                        &ldquo;{challenge.finding?.excerpt || "Flagged span"}&rdquo;
                      </span>
                    </div>

                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.2 brutal-border ${
                        challenge.status === "PENDING"
                          ? "bg-[#E6A23C] text-[#17251C]"
                          : challenge.status === "UPHELD"
                          ? "bg-[#17251C] text-white"
                          : "bg-[#B7F28B] text-[#17251C]"
                      }`}
                    >
                      {challenge.status}
                    </span>
                  </div>

                  <div className="p-2.5 bg-[#F4F1E8] brutal-border space-y-1">
                    <span className="text-[10px] text-[#637367] block uppercase">CREATOR JUSTIFICATION:</span>
                    <p className="text-xs text-[#17251C] leading-relaxed">
                      {challenge.reason}
                    </p>
                    {challenge.context && (
                      <p className="text-[10px] text-[#16834A] pt-1">
                        Context: {challenge.context}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-[#637367]">
                      Submitted by {challenge.submitted_by_profile?.full_name || "Author"} &bull;{" "}
                      {new Date(challenge.created_at).toLocaleDateString()}
                    </span>

                    {canDecide && isPending && (
                      <Button
                        variant="lime"
                        size="sm"
                        onClick={() => setSelectedChallenge(challenge)}
                        className="flex items-center space-x-1"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>ADJUDICATE &rarr;</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: COURT ADJUDICATION DIALOG */}
      {selectedChallenge && (
        <Dialog open={Boolean(selectedChallenge)} onOpenChange={() => setSelectedChallenge(null)}>
          <DialogHeader>
            <DialogTitle>Brand Memory Court &mdash; Adjudication</DialogTitle>
            <DialogDescription>
              Record an authoritative ruling for this contested brand finding.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCourtSubmit} className="space-y-3 font-mono text-xs">
            <div className="p-2.5 bg-[#F4F1E8] brutal-border">
              <span className="text-[10px] text-[#637367] uppercase block font-bold">CONTESTED FINDING:</span>
              <span className="font-bold text-[#17251C]">&ldquo;{selectedChallenge.finding?.excerpt}&rdquo;</span>
              <p className="text-[11px] text-[#17251C] mt-1">{selectedChallenge.reason}</p>
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">
                Court Adjudication Ruling *
              </label>
              <select
                value={challengeDecision}
                onChange={(e) => setChallengeDecision(e.target.value as ChallengeDecisionType)}
                className="w-full px-3 py-2 bg-white brutal-border font-mono text-xs focus:outline-none"
              >
                <option value="UPHOLD">UPHOLD &mdash; Finding stands, creator must resolve</option>
                <option value="REVERSE">REVERSE &mdash; Finding overturned, guideline satisfied</option>
                <option value="ACCEPT_AS_EXCEPTION">ACCEPT AS EXCEPTION &mdash; Valid one-time campaign exception</option>
                <option value="REQUEST_EVIDENCE">REQUEST EVIDENCE &mdash; Return to creator for supporting data</option>
                <option value="PROPOSE_GUIDELINE_CHANGE">PROPOSE GUIDELINE CHANGE &mdash; Draft new guideline proposal</option>
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">
                Ruling Rationale & Precedent Note * (min 15 chars)
              </label>
              <textarea
                required
                rows={3}
                value={challengeReason}
                onChange={(e) => setChallengeReason(e.target.value)}
                placeholder="Document the legal, empirical, or brand justification for this precedent-setting ruling..."
                className="w-full p-2 bg-white brutal-border text-xs focus:outline-none resize-y"
              />
            </div>

            {courtFeedback && (
              <div className="p-2.5 bg-[#DDEBDD] brutal-border text-xs text-[#16834A] font-bold">
                {courtFeedback}
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmittingCourt}
                variant="lime"
                size="md"
                className="w-full flex items-center justify-center space-x-1"
              >
                {isSubmittingCourt ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>RECORDING COURT RULING...</span>
                  </>
                ) : (
                  <>
                    <Scale className="w-3.5 h-3.5" />
                    <span>COMMIT COURT RULING &rarr;</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
