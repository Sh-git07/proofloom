"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SeverityChip } from "@/components/ui/severity-chip";
import { StatusLED } from "@/components/ui/status-led";
import { IdTag } from "@/components/ui/id-tag";
import { SectionLabel } from "@/components/ui/section-label";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { acceptRewriteAction, rejectFindingAction } from "@/app/actions/rewrites";
import { submitChallengeAction } from "@/app/actions/challenges";
import { submitForReviewAction, toggleFindingResolvedAction } from "@/app/actions/governance";
import { OrgRole } from "@/lib/permissions";
import { SCORING_FOOTNOTE } from "@/lib/audit/scoring";
import { buildViewerSegments } from "@/lib/audit/viewer";
import { getSentenceAround } from "@/lib/audit/terminology";
import { diffWordsWithSpace, Change } from "diff";
import {
  deriveEngineModeLabel,
  extractStageOutcome,
  calculateStageFindingsCount,
} from "@/lib/audit/labelling";
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  ExternalLink,
  BookOpen,
  GitBranch,
  Check,
  Scale,
  Send,
} from "lucide-react";

interface AuditStage {
  id: string;
  stage_number: number;
  stage_name?: string;
  stage_key?: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "REQUIRES_REVIEW";
  started_at?: string;
  completed_at?: string;
  findings_count?: number;
  error_message?: string;
  detail?: string;
}

interface AuditFinding {
  id: string;
  category: "voice" | "claims" | "terminology" | "accessibility" | "visual";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  excerpt: string;
  start_index: number;
  end_index: number;
  explanation: string;
  guideline_reference?: string;
  evidence_source_id?: string;
  verification_status?: string;
  recommended_action: string;
  suggested_replacement?: string;
  suggested_sentence?: string;
  confidence?: string;
  confidence_note?: string;
  source?: "Rule" | "AI";
  is_resolved?: boolean;
}

interface AuditReportViewProps {
  userRole?: OrgRole;
  creatorName?: string;
  audit: {
    id: string;
    overall_score: number | null;
    status: string;
    mode: "live_ai" | "demo";
    scores: {
      voice?: number;
      claims?: number;
      terminology?: number;
      accessibility?: number;
      visual?: number | null;
      ai_warning?: boolean;
    } | null;
    checked_dimensions: string[];
    created_at: string;
  };
  contentItem: {
    id: string;
    title: string;
    content_type: string;
    platform: string;
    department: string;
    status: string;
  };
  contentVersion: {
    body: string;
    version_no: number;
  };
  initialStages: AuditStage[];
  initialFindings: AuditFinding[];
}

export function AuditReportView({
  userRole = "creator",
  creatorName,
  audit,
  contentItem,
  contentVersion,
  initialStages,
  initialFindings,
}: AuditReportViewProps) {
  const router = useRouter();

  const [stages, setStages] = React.useState<AuditStage[]>(initialStages);
  const [findings, setFindings] = React.useState<AuditFinding[]>(initialFindings);
  const [isRunning, setIsRunning] = React.useState(
    audit.status === "QUEUED" || audit.status === "PROCESSING"
  );
  const [activeStageNumber, setActiveStageNumber] = React.useState<number | null>(null);
  const [runError, setRunError] = React.useState<string | null>(null);

  // Filters
  const [selectedSeverity, setSelectedSeverity] = React.useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [selectedFindingIds, setSelectedFindingIds] = React.useState<string[]>(
    initialFindings[0] ? [initialFindings[0].id] : []
  );
  const [selectedFindingId, setSelectedFindingId] = React.useState<string | null>(
    initialFindings[0]?.id || null
  );

  function handleHighlightClick(covering: AuditFinding[]) {
    if (covering.length === 0) return;
    const ids = covering.map((f) => f.id);
    setSelectedFindingIds(ids);
    setSelectedFindingId(ids[0]);
    setSelectedSeverity("ALL");
    setSelectedCategory("ALL");
  }

  // Intent-preserving rewrite state
  const [isAcceptingRewrite, setIsAcceptingRewrite] = React.useState<string | null>(null);
  const [rewriteSuccessMessage, setRewriteSuccessMessage] = React.useState<string | null>(null);

  // Challenge modal state (Brand Memory Court)
  const [challengeFinding, setChallengeFinding] = React.useState<AuditFinding | null>(null);
  const [challengeReason, setChallengeReason] = React.useState("");
  const [challengeContext, setChallengeContext] = React.useState("");
  const [isSubmittingChallenge, setIsSubmittingChallenge] = React.useState(false);
  const [challengeFeedback, setChallengeFeedback] = React.useState<string | null>(null);

  // Compare diff modal state
  const [compareFinding, setCompareFinding] = React.useState<AuditFinding | null>(null);

  // Review submission state
  const [contentStatus, setContentStatus] = React.useState<string>(contentItem.status);
  const [isSubmittingReview, setIsSubmittingReview] = React.useState(false);
  const [submitFeedback, setSubmitFeedback] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const hasUnresolvedCritical = findings.some(
    (f) => f.severity === "CRITICAL" && !f.is_resolved
  );

  const engineMode = deriveEngineModeLabel(audit.mode, stages);

  const hasAIFailed =
    audit.mode === "live_ai" &&
    (Boolean(audit.scores?.ai_warning) ||
      stages.some(
        (s) =>
          (s.detail && s.detail.includes("AI: failed, rules only")) ||
          s.status === "FAILED" ||
          Boolean(s.error_message)
      ));

  async function handleSubmitForReview() {
    setIsSubmittingReview(true);
    setSubmitError(null);
    setSubmitFeedback(null);

    const res = await submitForReviewAction(contentItem.id);
    setIsSubmittingReview(false);

    if (res.success) {
      const nextStatus = (res as { new_status?: string }).new_status || "READY_FOR_REVIEW";
      setContentStatus(nextStatus);
      setSubmitFeedback(
        `Successfully submitted content for formal review (Status: ${nextStatus.replace(/_/g, " ")}).`
      );
    } else {
      setSubmitError(res.error || "Failed to submit content for review.");
    }
  }

  async function handleToggleFindingResolved(finding: AuditFinding) {
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

  // Auto-runner loop: Executes next stage until all are COMPLETED
  React.useEffect(() => {
    let isCancelled = false;

    async function runPipeline() {
      if (!isRunning) return;

      try {
        while (!isCancelled) {
          const res = await fetch(`/api/audits/${audit.id}/run-stage`, {
            method: "POST",
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || "Stage execution failed");
          }

          if (data.stage) {
            setActiveStageNumber(data.stage.number);
            setStages((prev) =>
              prev.map((s) =>
                s.stage_number === data.stage.number
                  ? {
                      ...s,
                      status: "COMPLETED",
                      findings_count: data.stage.findingsCount,
                      detail: data.stage.detail,
                    }
                  : s
              )
            );
          }

          if (data.completed) {
            setIsRunning(false);
            setActiveStageNumber(null);
            router.refresh();
            break;
          }

          await new Promise((r) => setTimeout(r, 600));
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setIsRunning(false);
          setRunError(err instanceof Error ? err.message : "Stage execution encountered an error");
        }
      }
    }

    if (isRunning) {
      runPipeline();
    }

    return () => {
      isCancelled = true;
    };
  }, [isRunning, audit.id, router]);

  function handleRetryStage() {
    setRunError(null);
    setIsRunning(true);
  }

  // Accept rewrite handler
  async function handleAcceptRewrite(finding: AuditFinding) {
    if (!finding.suggested_replacement) return;
    setIsAcceptingRewrite(finding.id);
    setRewriteSuccessMessage(null);

    const isDisclaimer =
      finding.explanation.toLowerCase().includes("legal disclaimer missing") ||
      finding.recommended_action.toLowerCase().includes("required disclaimer") ||
      finding.guideline_reference?.toLowerCase().includes("mandatory disclaimer");

    const replacementToApply = isDisclaimer
      ? `${finding.excerpt} Results based on an internal pilot; individual results may vary.`
      : finding.suggested_replacement;

    try {
      const res = await acceptRewriteAction({
        contentItemId: contentItem.id,
        findingId: finding.id,
        originalBody: contentVersion.body,
        excerpt: finding.excerpt,
        replacement: replacementToApply,
      });

      if (res.success) {
        setRewriteSuccessMessage(
          `Rewrite accepted! New Content Version ${res.versionNo} created. Version 1 is permanently archived untouched.`
        );
        // Mark finding resolved locally
        setFindings((prev) =>
          prev.map((f) => (f.id === finding.id ? { ...f, is_resolved: true } : f))
        );
        router.refresh();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error accepting rewrite");
    } finally {
      setIsAcceptingRewrite(null);
    }
  }

  // Dismiss finding handler
  async function handleDismissFinding(finding: AuditFinding) {
    const reason = prompt("Enter a documented reason for dismissing this compliance finding (min 10 chars):");
    if (!reason || reason.trim().length < 10) {
      alert("A documented reason of at least 10 characters is required.");
      return;
    }

    try {
      await rejectFindingAction({
        findingId: finding.id,
        contentItemId: contentItem.id,
        reason: reason.trim(),
      });
      setFindings((prev) =>
        prev.map((f) => (f.id === finding.id ? { ...f, is_resolved: true } : f))
      );
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error dismissing finding");
    }
  }

  // Submit challenge handler (Brand Memory Court)
  async function handleChallengeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeFinding) return;
    if (challengeReason.trim().length < 15) {
      alert("Challenge rationale must be at least 15 characters.");
      return;
    }

    setIsSubmittingChallenge(true);
    setChallengeFeedback(null);

    try {
      const res = await submitChallengeAction({
        findingId: challengeFinding.id,
        contentItemId: contentItem.id,
        reason: challengeReason.trim(),
        contextNote: challengeContext.trim() || undefined,
      });

      if (res.success) {
        setChallengeFeedback("Challenge successfully registered in the Brand Memory Court queue.");
        setTimeout(() => {
          setChallengeFinding(null);
          setChallengeReason("");
          setChallengeContext("");
          setChallengeFeedback(null);
        }, 1500);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error submitting challenge");
    } finally {
      setIsSubmittingChallenge(false);
    }
  }

  // Filtered findings list
  const filteredFindings = findings.filter((f) => {
    if (selectedSeverity !== "ALL" && f.severity !== selectedSeverity) return false;
    if (selectedCategory !== "ALL" && f.category !== selectedCategory) return false;
    return true;
  });

  // Content highlighted renderer (merged, non-overlapping character ranges)
  function renderHighlightedContent() {
    const text = contentVersion.body;
    if (findings.length === 0) {
      return <p className="font-mono text-xs leading-relaxed text-[#17251C] whitespace-pre-wrap">{text}</p>;
    }

    const segments = buildViewerSegments(text, findings);

    return (
      <div className="font-mono text-xs leading-relaxed text-[#17251C] whitespace-pre-wrap">
        {segments.map((seg, idx) => {
          if (seg.coveringFindings.length === 0) {
            return <span key={`plain-${seg.start}-${idx}`}>{seg.text}</span>;
          }

          const topFinding = seg.coveringFindings[0];
          const allResolved = seg.coveringFindings.every((f) => f.is_resolved);
          const hasSelected = seg.coveringFindings.some((f) => selectedFindingIds.includes(f.id));

          const highlightClass = allResolved
            ? "bg-[#DDEBDD] border-b border-[#16834A] text-[#16834A] line-through opacity-70"
            : topFinding.severity === "CRITICAL"
            ? "bg-[#D94C4C]/20 border-b-2 border-[#D94C4C] text-[#D94C4C] font-bold"
            : topFinding.severity === "HIGH"
            ? "bg-[#E6A23C]/20 border-b-2 border-[#E6A23C] text-[#17251C] font-bold"
            : "bg-[#B7F28B]/30 border-b-2 border-[#16834A] text-[#17251C] font-semibold";

          const titleText = seg.coveringFindings
            .map((f) => `[${f.severity}] ${f.category.toUpperCase()}: ${f.explanation}`)
            .join(" | ");

          return (
            <button
              key={`seg-${seg.start}-${seg.end}-${idx}`}
              type="button"
              onClick={() => handleHighlightClick(seg.coveringFindings)}
              className={`cursor-pointer px-0.5 py-0.5 rounded-[1px] transition-all text-left inline ${highlightClass} ${
                hasSelected ? "ring-2 ring-[#17251C] bg-[#B7F28B]/60" : "hover:bg-opacity-50"
              }`}
              title={titleText}
            >
              {seg.text}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Bar with Meta */}
      <div className="brutal-panel bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <SectionLabel number="03" title="AUDIT REPORT" />
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-[#F4F1E8] brutal-border">
              {contentItem.content_type} &bull; {contentItem.platform}
            </span>
            <span
              className={`font-mono text-[10px] font-bold px-2 py-0.5 brutal-border ${
                engineMode.includes("partial") || (engineMode === "RULES ONLY" && audit.mode === "live_ai")
                  ? "bg-[#D94C4C] text-white"
                  : "bg-[#B7F28B] text-[#17251C]"
              }`}
            >
              {engineMode}
            </span>
          </div>
          <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
            {contentItem.title}
          </h1>
          <p className="text-xs text-[#637367] mt-0.5 font-mono">
            Authored by <span className="font-bold text-[#17251C]">{creatorName || contentItem.department}</span> &bull; Original Submission Version {contentVersion.version_no}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {hasUnresolvedCritical ? (
            <span className="font-mono text-xs font-extrabold px-2.5 py-1 bg-[#D94C4C] text-white brutal-border">
              REVISION REQUIRED
            </span>
          ) : ['READY_FOR_REVIEW', 'IN_REVIEW', 'APPROVED', 'READY_TO_PUBLISH'].includes(contentStatus) ? (
            <>
              <span className="font-mono text-xs font-extrabold px-2 py-1 bg-[#16834A] text-[#B7F28B] brutal-border">
                {contentStatus.replace(/_/g, " ")}
              </span>
              <Link href={`/reviews/${contentItem.id}`}>
                <Button variant="lime" size="md" className="flex items-center space-x-1.5">
                  <span>OPEN REVIEW WORKBENCH</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </>
          ) : (
            audit.status === "COMPLETED" &&
            userRole !== "reviewer" && (
              <Button
                variant="lime"
                size="md"
                disabled={isSubmittingReview}
                onClick={handleSubmitForReview}
                className="flex items-center space-x-1.5 font-mono font-bold"
              >
                {isSubmittingReview ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>SUBMITTING...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>SUBMIT FOR REVIEW</span>
                  </>
                )}
              </Button>
            )
          )}

          <Link href="/studio">
            <Button variant="secondary" size="md">
              NEW SUBMISSION
            </Button>
          </Link>
          <Link href="/audits">
            <Button variant="outline" size="md">
              ALL AUDITS &rarr;
            </Button>
          </Link>
        </div>
      </div>

      {submitFeedback && (
        <div className="p-3.5 bg-[#DDEBDD] border-2 border-[#16834A] text-[#16834A] text-xs font-mono font-bold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{submitFeedback}</span>
          </div>
          <Link href={`/reviews/${contentItem.id}`} className="underline font-bold text-[#17251C]">
            Go to Review Workbench &rarr;
          </Link>
        </div>
      )}

      {submitError && (
        <div className="p-3.5 bg-[#F4F1E8] border-2 border-[#D94C4C] text-[#D94C4C] text-xs font-mono font-bold flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {rewriteSuccessMessage && (
        <div className="p-3.5 bg-[#DDEBDD] border-2 border-[#16834A] text-[#16834A] text-xs font-mono font-bold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{rewriteSuccessMessage}</span>
          </div>
          <Link href="/studio" className="underline font-bold text-[#17251C]">
            Open Studio &rarr;
          </Link>
        </div>
      )}

      {engineMode.includes("partial") && (
        <div className="p-3.5 bg-[#FFF3CD] border-2 border-[#E6A23C] text-[#856404] text-xs font-mono font-bold flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-[#E6A23C]" />
          <span>{engineMode}. Deterministic rule-based analysis was preserved for unassisted stages.</span>
        </div>
      )}

      {engineMode === "RULES ONLY" && audit.mode === "live_ai" && (
        <div className="p-3.5 bg-[#FFF3CD] border-2 border-[#E6A23C] text-[#856404] text-xs font-mono font-bold flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-[#E6A23C]" />
          <span>RULES ONLY: External AI was unavailable across all stages. Deterministic rule-based analysis completed.</span>
        </div>
      )}

      {/* 2. LIVE STAGE RUNNER ANIMATION */}
      {isRunning ? (
        <div className="brutal-panel bg-white p-6 space-y-5">
          <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-3">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 text-[#16834A] animate-spin" />
              <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
                STAGED VERIFICATION PIPELINE IN PROGRESS
              </h3>
            </div>
            <div className="flex items-center space-x-2 font-mono text-xs font-bold">
              <StatusLED status="processing" />
              <span className="text-[#16834A]">SERVERLESS SAFE RUNNER</span>
            </div>
          </div>

          <div className="space-y-3 font-mono">
            {stages.map((stage) => {
              const isProcessing = stage.stage_number === activeStageNumber || stage.status === "PROCESSING";
              const isCompleted = stage.status === "COMPLETED";
              const isFailed = stage.status === "FAILED";

              return (
                <div
                  key={stage.id}
                  className={`p-3.5 brutal-border transition-all flex items-center justify-between ${
                    isProcessing
                      ? "bg-[#B7F28B] text-[#17251C] brutal-shadow-sm"
                      : isCompleted
                      ? "bg-[#DDEBDD] text-[#17251C]"
                      : isFailed
                      ? "bg-[#D94C4C]/20 border-[#D94C4C] text-[#D94C4C]"
                      : "bg-[#F4F1E8] text-[#637367] opacity-60"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {isProcessing ? (
                      <span className="status-led status-led-live" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-[#16834A]" />
                    ) : isFailed ? (
                      <AlertTriangle className="w-4 h-4 text-[#D94C4C]" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[#637367]" />
                    )}
                    <span className="font-bold text-xs tracking-wider">
                      {stage.stage_name || stage.stage_key}
                    </span>
                  </div>

                  <div className="text-right text-[11px] font-bold">
                    {isProcessing && <span className="animate-pulse">ANALYZING...</span>}
                    {isCompleted && (
                      <span className="text-right">
                        {stage.detail?.includes("AI: failed, rules only") ? (
                          <span className="text-[#D94C4C] font-bold flex items-center space-x-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#D94C4C] shrink-0" />
                            <span>WARNING: {extractStageOutcome(stage.detail)} ({stage.findings_count ?? calculateStageFindingsCount(stage.stage_number, findings)} findings)</span>
                          </span>
                        ) : (
                          <span className="text-[#16834A] flex items-center space-x-1.5 font-bold">
                            <span>PASSED ({stage.findings_count ?? calculateStageFindingsCount(stage.stage_number, findings)} findings)</span>
                            <span className="text-[#637367]">&bull;</span>
                            <span className={stage.detail?.includes("AI: used") ? "text-[#16834A]" : "text-[#637367]"}>
                              {extractStageOutcome(stage.detail)}
                            </span>
                          </span>
                        )}
                      </span>
                    )}
                    {isFailed && <span>STAGE FAILED</span>}
                    {!isProcessing && !isCompleted && !isFailed && <span>QUEUED</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (runError || stages.some((s) => s.status === "FAILED")) ? (
        <div className="brutal-panel bg-white p-6 space-y-4 border-2 border-[#D94C4C]">
          <div className="flex items-center space-x-2 text-[#D94C4C]">
            <AlertTriangle className="w-5 h-5 text-[#D94C4C]" />
            <h3 className="font-mono font-bold text-sm uppercase">Stage Execution Interrupted</h3>
          </div>
          <p className="font-mono text-xs text-[#17251C]">
            {runError ||
              stages.find((s) => s.status === "FAILED")?.error_message ||
              `Stage ${stages.find((s) => s.status === "FAILED")?.stage_number || ""} failed during execution.`}
          </p>
          <Button variant="danger" size="md" onClick={handleRetryStage}>
            RETRY STAGE &rarr;
          </Button>
        </div>
      ) : (
        <>
          {/* 3. HERO SCORE GAUGE & METRIC PANELS */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Score Card */}
            <div className="lg:col-span-1 brutal-panel bg-white p-5 flex flex-col justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold text-[#637367] uppercase block">
                  BRAND INTEGRITY SCORE
                </span>
                <div className="flex items-baseline space-x-2 mt-2">
                  <span
                    className={`font-mono font-black text-6xl tracking-tight ${
                      (audit.overall_score || 0) >= 80
                        ? "text-[#16834A]"
                        : (audit.overall_score || 0) >= 60
                        ? "text-[#E6A23C]"
                        : "text-[#D94C4C]"
                    }`}
                  >
                    {audit.overall_score ?? "--"}
                  </span>
                  <span className="font-mono text-sm text-[#637367]">/ 100</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t-2 border-[#253C2B] space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#637367]">AUDIT DECISION:</span>
                  <span
                    className={`font-extrabold uppercase px-1.5 py-0.5 brutal-border ${
                      hasUnresolvedCritical
                        ? "bg-[#D94C4C] text-white"
                        : "bg-[#B7F28B] text-[#17251C]"
                    }`}
                  >
                    {hasUnresolvedCritical ? "REVISION REQUIRED" : "READY FOR REVIEW"}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-[#637367]">ENGINE MODE:</span>
                  <span className={`font-bold ${engineMode.includes("partial") || (engineMode === "RULES ONLY" && audit.mode === "live_ai") ? "text-[#D94C4C]" : "text-[#17251C]"}`}>
                    {engineMode}
                  </span>
                </div>
              </div>
            </div>

            {/* Dimension Breakdown Panels */}
            <div className="lg:col-span-3 brutal-panel bg-white p-5 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-2">
                <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
                  GOVERNANCE DIMENSION BREAKDOWN
                </h3>
                <span className="font-mono text-[10px] text-[#637367]">
                  Target Threshold ≥ 85.0
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
                {/* Voice */}
                <div className="p-3 bg-[#F4F1E8] brutal-border">
                  <span className="text-[10px] font-bold text-[#637367] block uppercase">
                    BRAND VOICE
                  </span>
                  <span className="text-2xl font-black text-[#17251C] mt-1 block">
                    {audit.scores?.voice ?? 100}/100
                  </span>
                  <span className="text-[9px] text-[#637367] block mt-0.5">Tone & Hype</span>
                </div>

                {/* Claims */}
                <div className="p-3 bg-[#F4F1E8] brutal-border">
                  <span className="text-[10px] font-bold text-[#637367] block uppercase">
                    CLAIM TRUTH
                  </span>
                  <span
                    className={`text-2xl font-black mt-1 block ${
                      (audit.scores?.claims ?? 100) < 70 ? "text-[#D94C4C]" : "text-[#17251C]"
                    }`}
                  >
                    {audit.scores?.claims ?? 100}/100
                  </span>
                  <span className="text-[9px] text-[#637367] block mt-0.5">Empirical Evidence</span>
                </div>

                {/* Terminology */}
                <div className="p-3 bg-[#F4F1E8] brutal-border">
                  <span className="text-[10px] font-bold text-[#637367] block uppercase">
                    TERMINOLOGY
                  </span>
                  <span className="text-2xl font-black text-[#17251C] mt-1 block">
                    {audit.scores?.terminology ?? 100}/100
                  </span>
                  <span className="text-[9px] text-[#637367] block mt-0.5">Standards & Legal</span>
                </div>

                {/* Accessibility */}
                <div className="p-3 bg-[#F4F1E8] brutal-border">
                  <span className="text-[10px] font-bold text-[#637367] block uppercase">
                    A11Y (TEXT)
                  </span>
                  <span className="text-2xl font-black text-[#17251C] mt-1 block">
                    {audit.scores?.accessibility ?? 100}/100
                  </span>
                  <span className="text-[9px] text-[#637367] block mt-0.5">Flesch Reading Ease</span>
                </div>

                {/* Visual */}
                <div className="p-3 bg-[#F4F1E8] brutal-border col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-[#637367] block uppercase">
                    VISUAL
                  </span>
                  <span className="text-sm font-bold text-[#637367] mt-2 block">
                    NOT CHECKED
                  </span>
                  <span className="text-[9px] text-[#637367] block mt-0.5">Excluded from total</span>
                </div>
              </div>

              <p className="text-[10px] font-mono text-[#637367] uppercase pt-1">
                {SCORING_FOOTNOTE}
              </p>
            </div>
          </div>

          {/* Verification Pipeline Stages & Honest AI Labels */}
          <div className="brutal-panel bg-white p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-2">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-[#16834A]" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#17251C]">
                  VERIFICATION PIPELINE AUDIT STAGES (7 STAGES)
                </h3>
              </div>
              <span className="text-[10px] text-[#637367]">
                {audit.mode === "live_ai"
                  ? hasAIFailed
                    ? "AI WARNING REPORTED (FALLBACK ACTIVE)"
                    : "LIVE AI PIPELINE"
                  : "DETERMINISTIC DEMO"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {stages.map((stg) => {
                const isFailed =
                  (stg.detail && stg.detail.includes("AI: failed, rules only")) ||
                  stg.status === "FAILED";
                const outcome = extractStageOutcome(stg.detail);
                const isAIUsed = outcome.includes("AI: used");
                const stageFindingsCount = stg.findings_count ?? calculateStageFindingsCount(stg.stage_number, findings);

                return (
                  <div
                    key={stg.id}
                    className={`p-2.5 brutal-border flex flex-col justify-between ${
                      isFailed
                        ? "bg-[#F8D7DA] border-[#D94C4C] text-[#721C24]"
                        : "bg-[#F4F1E8] text-[#17251C]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] truncate">
                        {stg.stage_name || stg.stage_key}
                      </span>
                      {isFailed ? (
                        <span className="px-1.5 py-0.2 bg-[#D94C4C] text-white font-extrabold text-[9px] uppercase">
                          WARNING
                        </span>
                      ) : (
                        <span className="text-[#16834A] font-bold text-[9px]">PASSED</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[#253C2B]/15 text-[10px]">
                      <span className="text-[#637367]">
                        {stageFindingsCount} findings
                      </span>
                      <span
                        className={`font-bold ${
                          isFailed
                            ? "text-[#D94C4C]"
                            : isAIUsed
                            ? "text-[#16834A]"
                            : "text-[#637367]"
                        }`}
                      >
                        {outcome}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. MAIN OPERATIONAL AUDIT CONSOLE */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 5-cols: Document Content Viewer */}
            <div className="lg:col-span-5 brutal-panel bg-white p-5 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-3">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-[#16834A]" />
                  <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
                    INLINE SUBMISSION VIEWER
                  </h3>
                </div>
                <span className="font-mono text-[10px] text-[#637367]">
                  {findings.length} flagged spans
                </span>
              </div>

              <div className="p-4 bg-[#F4F1E8] brutal-border min-h-[300px] overflow-y-auto max-h-[550px]">
                {renderHighlightedContent()}
              </div>

              <div className="p-2.5 bg-white brutal-border text-[11px] font-mono text-[#637367] flex items-center justify-between">
                <span>Click any highlighted segment to view finding evidence</span>
                <span className="text-[#16834A] font-bold">100% Traceable</span>
              </div>
            </div>

            {/* Right 7-cols: Interactive Findings & Provenance Drawer */}
            <div className="lg:col-span-7 space-y-4">
              {/* Filter Tabs */}
              <div className="brutal-panel bg-white p-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center space-x-1.5 overflow-x-auto">
                  <span className="text-[#637367] font-bold text-[10px] uppercase pr-1">SEVERITY:</span>
                  {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                    <button
                      key={sev}
                      onClick={() => setSelectedSeverity(sev)}
                      className={`px-2 py-0.5 brutal-border text-[10px] font-bold uppercase transition-all ${
                        selectedSeverity === sev
                          ? "bg-[#17251C] text-[#B7F28B]"
                          : "bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD]"
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-1.5 overflow-x-auto">
                  <span className="text-[#637367] font-bold text-[10px] uppercase pr-1">DIMENSION:</span>
                  {["ALL", "claims", "voice", "terminology", "accessibility"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2 py-0.5 brutal-border text-[10px] font-bold uppercase transition-all ${
                        selectedCategory === cat
                          ? "bg-[#16834A] text-white"
                          : "bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Findings List */}
              <div className="space-y-3">
                {filteredFindings.length === 0 ? (
                  <div className="brutal-panel bg-white p-8 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-[#16834A] mx-auto" />
                    <h4 className="font-mono font-bold text-sm text-[#17251C]">
                      No infractions matching selected criteria
                    </h4>
                    <p className="text-xs text-[#637367] font-mono">
                      All checked statements in this category comply with organizational guidelines.
                    </p>
                  </div>
                ) : (
                  filteredFindings.map((finding) => {
                    const isSelected = selectedFindingIds.includes(finding.id);
                    const isDisclaimer =
                      finding.explanation.toLowerCase().includes("legal disclaimer missing") ||
                      finding.recommended_action.toLowerCase().includes("required disclaimer") ||
                      finding.guideline_reference?.toLowerCase().includes("mandatory disclaimer");

                    const sentenceInfo = getSentenceAround(contentVersion.body, finding.start_index, finding.end_index);
                    const suggestedSentence =
                      finding.suggested_sentence ||
                      (sentenceInfo.sentence && finding.suggested_replacement
                        ? sentenceInfo.sentence.replace(finding.excerpt, finding.suggested_replacement)
                        : finding.suggested_replacement);

                    return (
                      <div
                        key={finding.id}
                        onClick={() => {
                          if (selectedFindingIds.includes(finding.id)) {
                            setSelectedFindingIds(selectedFindingIds.filter((id) => id !== finding.id));
                          } else {
                            setSelectedFindingIds([finding.id, ...selectedFindingIds]);
                          }
                          setSelectedFindingId(finding.id);
                        }}
                        className={`brutal-panel bg-white p-4 transition-all cursor-pointer ${
                          isSelected
                            ? "border-l-4 border-l-[#16834A] brutal-shadow"
                            : "hover:bg-[#F4F1E8]"
                        } ${finding.is_resolved ? "opacity-60 bg-[#DDEBDD]/30" : ""}`}
                      >
                        {/* Finding Card Top Bar */}
                        <div className="flex items-center justify-between border-b border-[#253C2B]/15 pb-2 mb-2 font-mono">
                          <div className="flex items-center space-x-2">
                            <IdTag id={finding.id} />
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.2 brutal-border ${
                                (finding.source === "AI" || finding.confidence_note === "AI" || finding.id?.includes("AI"))
                                  ? "bg-[#17251C] text-[#B7F28B]"
                                  : "bg-[#F4F1E8] text-[#637367]"
                              }`}
                            >
                              {(finding.source === "AI" || finding.confidence_note === "AI" || finding.id?.includes("AI")) ? "AI" : "Rule"}
                            </span>
                            <SeverityChip severity={finding.severity} />
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
                            {finding.category}
                          </span>
                        </div>

                        {/* Excerpt */}
                        <div className="mb-2">
                          <span className="font-mono text-[10px] text-[#637367] block uppercase">
                            FLAGGED EXCERPT:
                          </span>
                          <p className="font-mono text-xs font-bold text-[#17251C] bg-[#F4F1E8] p-1.5 brutal-border mt-0.5">
                            &ldquo;{finding.excerpt}&rdquo;
                          </p>
                        </div>

                        {/* Explanation */}
                        <p className="text-xs text-[#17251C] font-medium leading-relaxed">
                          {finding.explanation}
                        </p>

                        {/* Expandable Details if selected */}
                        {isSelected && (
                          <div className="mt-3 pt-3 border-t-2 border-[#253C2B] space-y-2.5 font-mono text-xs">
                            {finding.guideline_reference && (
                              <div className="flex items-start space-x-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-[#16834A] shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-[#637367] text-[10px] block">AUTHORITATIVE SOURCE / GUIDELINE:</span>
                                  <span className="font-bold text-[#17251C]">{finding.guideline_reference}</span>
                                </div>
                              </div>
                            )}

                            {/* Terminology specific standard display (Requirement 6) */}
                            {finding.category === "terminology" && !isDisclaimer && (
                              <div className="p-2 bg-[#F4F1E8] brutal-border space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className="text-[10px] font-bold text-[#637367] uppercase">APPROVED TERM:</span>
                                  <span className="font-bold text-xs text-[#16834A] px-1.5 py-0.5 bg-[#DDEBDD] brutal-border">
                                    {finding.suggested_replacement || "Approved Standard"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-[#637367] block uppercase font-bold">RULE EXPLANATION:</span>
                                  <p className="text-xs text-[#17251C]">{finding.explanation}</p>
                                </div>
                              </div>
                            )}

                            <div>
                              <span className="text-[#637367] text-[10px] block">RECOMMENDED REMEDIATION:</span>
                              <span className="font-bold text-[#16834A] block">{finding.recommended_action}</span>
                            </div>

                            {/* Disclaimer: exact approved disclaimer text as suggested addition (Requirement 3) */}
                            {isDisclaimer ? (
                              <div className="p-2.5 bg-[#DDEBDD] brutal-border space-y-1.5">
                                <span className="text-[10px] font-bold text-[#16834A] block uppercase">
                                  SUGGESTED ADDITION:
                                </span>
                                <p className="font-bold text-xs text-[#17251C]">
                                  Results based on an internal pilot; individual results may vary.
                                </p>
                              </div>
                            ) : finding.category === "terminology" ? (
                              /* Terminology: suggested replacement sentence (Requirement 6) */
                              <div className="p-2.5 bg-[#DDEBDD] brutal-border space-y-1.5">
                                <span className="text-[10px] font-bold text-[#16834A] block uppercase">
                                  SUGGESTED REPLACEMENT SENTENCE:
                                </span>
                                <p className="font-bold text-xs text-[#17251C]">
                                  {suggestedSentence}
                                </p>
                              </div>
                            ) : finding.suggested_replacement ? (
                              <div className="p-2.5 bg-[#DDEBDD] brutal-border space-y-1.5">
                                <span className="text-[10px] font-bold text-[#16834A] block uppercase">
                                  INTENT-PRESERVING REWRITE SUGGESTION:
                                </span>
                                <p className="font-bold text-xs text-[#17251C]">
                                  {finding.suggested_replacement}
                                </p>
                              </div>
                            ) : null}

                            {/* Action Buttons: Accept / Compare / Challenge / Provenance */}
                            <div className="flex flex-wrap items-center gap-2 pt-2">
                              {!finding.is_resolved && finding.suggested_replacement && (
                                <button
                                  type="button"
                                  disabled={isAcceptingRewrite === finding.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcceptRewrite(finding);
                                  }}
                                  className="brutal-btn brutal-btn-lime px-3 py-1.5 text-[11px] flex items-center space-x-1"
                                >
                                  {isAcceptingRewrite === finding.id ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                      <span>CREATING VERSION 2...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3 h-3" />
                                      <span>ACCEPT REWRITE &rarr; VERSION 2</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {finding.suggested_replacement && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCompareFinding(finding);
                                  }}
                                  className="brutal-btn brutal-btn-secondary px-2.5 py-1.5 text-[11px] flex items-center space-x-1"
                                >
                                  <GitBranch className="w-3 h-3 text-[#16834A]" />
                                  <span>WORD DIFF</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setChallengeFinding(finding);
                                }}
                                className="brutal-btn brutal-btn-secondary px-2.5 py-1.5 text-[11px] flex items-center space-x-1"
                              >
                                <Scale className="w-3 h-3 text-[#E6A23C]" />
                                <span>CHALLENGE (COURT)</span>
                              </button>

                              <Link
                                href={`/provenance?claim=${encodeURIComponent(finding.excerpt)}&auditId=${audit.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="brutal-btn brutal-btn-secondary px-2.5 py-1.5 text-[11px] flex items-center space-x-1"
                              >
                                <ExternalLink className="w-3 h-3 text-[#16834A]" />
                                <span>PROVENANCE</span>
                              </Link>

                              {(userRole === "reviewer" ||
                                userRole === "brand_manager" ||
                                userRole === "admin") && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFindingResolved(finding);
                                  }}
                                  className={`brutal-btn px-2.5 py-1.5 text-[11px] flex items-center space-x-1 ${
                                    finding.is_resolved
                                      ? "brutal-btn-secondary text-[#637367]"
                                      : "brutal-btn-lime"
                                  }`}
                                >
                                  <Check className="w-3 h-3" />
                                  <span>
                                    {finding.is_resolved
                                      ? "MARK UNRESOLVED"
                                      : "MARK AS RESOLVED"}
                                  </span>
                                </button>
                              )}

                              {!finding.is_resolved && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDismissFinding(finding);
                                  }}
                                  className="text-[11px] font-bold text-[#637367] hover:text-[#D94C4C] px-2 py-1 underline"
                                >
                                  Dismiss
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODAL: WORD DIFF COMPARISON */}
      {compareFinding && compareFinding.suggested_replacement && (
        <Dialog open={Boolean(compareFinding)} onOpenChange={() => setCompareFinding(null)}>
          <DialogHeader>
            <DialogTitle>Intent-Preserving Word Diff</DialogTitle>
            <DialogDescription>
              Comparing original flagged excerpt with intent-preserving rewrite suggestion.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 font-mono text-xs">
            <div className="p-3 bg-[#F4F1E8] brutal-border space-y-2">
              <span className="text-[10px] font-bold uppercase text-[#637367] block">
                WORD-LEVEL COMPARISON:
              </span>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {diffWordsWithSpace(compareFinding.excerpt, compareFinding.suggested_replacement).map(
                  (part: Change, i: number) => {
                    if (part.added) {
                      return (
                        <span key={i} className="bg-[#B7F28B] text-[#17251C] font-bold px-1 py-0.5 rounded-[1px]">
                          {part.value}
                        </span>
                      );
                    }
                    if (part.removed) {
                      return (
                        <span key={i} className="bg-[#D94C4C]/20 text-[#D94C4C] line-through font-bold px-1 py-0.5 rounded-[1px]">
                          {part.value}
                        </span>
                      );
                    }
                    return <span key={i}>{part.value}</span>;
                  }
                )}
              </p>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[#637367]">
              <span>Changes only the necessary span &bull; Preserves original intent</span>
              <Button
                variant="lime"
                size="sm"
                onClick={() => {
                  handleAcceptRewrite(compareFinding);
                  setCompareFinding(null);
                }}
              >
                ACCEPT THIS REWRITE &rarr;
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* MODAL: BRAND MEMORY COURT CHALLENGE */}
      {challengeFinding && (
        <Dialog open={Boolean(challengeFinding)} onOpenChange={() => setChallengeFinding(null)}>
          <DialogHeader>
            <DialogTitle>Brand Memory Court &mdash; Challenge Finding</DialogTitle>
            <DialogDescription>
              Submit an empirical challenge against this compliance finding. Reviewers will formally adjudicate.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleChallengeSubmit} className="space-y-3 font-mono text-xs">
            <div className="p-2.5 bg-[#F4F1E8] brutal-border">
              <span className="text-[10px] text-[#637367] uppercase block font-bold">CHALLENGED FINDING:</span>
              <span className="font-bold text-[#17251C]">{challengeFinding.id} &bull; &ldquo;{challengeFinding.excerpt}&rdquo;</span>
              <p className="text-[11px] text-[#637367] mt-1">{challengeFinding.explanation}</p>
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">
                Challenge Justification * (min 15 chars)
              </label>
              <textarea
                required
                rows={3}
                value={challengeReason}
                onChange={(e) => setChallengeReason(e.target.value)}
                placeholder="Explain why this finding should be reversed, accepted as an exception, or why empirical evidence supports it..."
                className="w-full p-2 bg-white brutal-border text-xs focus:outline-none resize-y"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">
                Campaign Context / Precedent Note (Optional)
              </label>
              <input
                type="text"
                value={challengeContext}
                onChange={(e) => setChallengeContext(e.target.value)}
                placeholder="e.g. Approved under Executive Exception Memo #44"
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>

            {challengeFeedback && (
              <div className="p-2.5 bg-[#DDEBDD] brutal-border text-xs text-[#16834A] font-bold">
                {challengeFeedback}
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                disabled={isSubmittingChallenge}
                variant="lime"
                size="md"
                className="w-full flex items-center justify-center space-x-1"
              >
                {isSubmittingChallenge ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>FILING COURT CHALLENGE...</span>
                  </>
                ) : (
                  <>
                    <Scale className="w-3.5 h-3.5" />
                    <span>SUBMIT TO BRAND MEMORY COURT &rarr;</span>
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
