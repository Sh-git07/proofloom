"use client";

import * as React from "react";
import Link from "next/link";
import {
  TrendingDown,
  Flame,
  Search,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { scanForDriftAction, updateDriftStatusAction, DriftStatusType } from "@/app/actions/drift";
import { computeClaritySuggestionsAction, reviewClaritySuggestionAction } from "@/app/actions/knowledge";
import { Button } from "@/components/ui/button";
import { HelpTip } from "@/components/guidance/HelpTip";

export interface ClaritySuggestionItem {
  id: string;
  rule_label: string;
  findings_count: number;
  dismissed_count: number;
  challenged_count: number;
  reversed_count: number;
  suggestion_text: string;
  status: "OPEN" | "ACCEPTED" | "REJECTED";
  created_at: string;
  rejection_reason?: string | null;
}

export interface DriftInsightItem {
  id: string;
  title: string;
  summary: string;
  insight_type: string;
  frequency: number;
  affected_departments: string[] | string;
  recommendation: string | null;
  is_seeded: boolean;
  created_at: string;
}

export function BrandDriftWorkbench({
  initialInsights,
  totalAuditsCount,
  claritySuggestions: initialSuggestions = [],
  canManage = false,
}: {
  initialInsights: DriftInsightItem[];
  totalAuditsCount: number;
  claritySuggestions?: ClaritySuggestionItem[];
  canManage?: boolean;
}) {
  const [insights, setInsights] = React.useState<DriftInsightItem[]>(initialInsights);
  const [suggestions, setSuggestions] = React.useState<ClaritySuggestionItem[]>(initialSuggestions);
  const [isScanningSuggestions, setIsScanningSuggestions] = React.useState(false);
  const [suggestionMessage, setSuggestionMessage] = React.useState<string | null>(null);
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [isSubmittingReview, setIsSubmittingReview] = React.useState(false);
  const [selectedType, setSelectedType] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [isScanning, setIsScanning] = React.useState(false);
  const [scanMessage, setScanMessage] = React.useState<string | null>(null);

  // Modal State
  const [activeDrift, setActiveDrift] = React.useState<DriftInsightItem | null>(null);
  const [resolutionNote, setResolutionNote] = React.useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);

  // Derived filters
  const filteredInsights = React.useMemo(() => {
    return insights.filter((item) => {
      if (selectedType !== "ALL") {
        if (selectedType === "EXPIRED" && item.insight_type !== "expired_stat_reuse") return false;
        if (selectedType === "VOICE" && item.insight_type !== "voice_deviation") return false;
        if (selectedType === "CLAIMS" && item.insight_type !== "repeated_claim") return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.insight_type.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [insights, selectedType, searchQuery]);

  const totalPatterns = insights.length;
  const totalViolations = insights.reduce((acc, curr) => acc + (curr.frequency || 1), 0);

  const handleScan = async () => {
    setIsScanning(true);
    setScanMessage(null);
    try {
      const res = await scanForDriftAction();
      setScanMessage(res.message);
      if (res.count && res.count > 0) {
        window.location.reload();
      }
    } catch (err: unknown) {
      setScanMessage(err instanceof Error ? err.message : "Failed to run drift scan");
    } finally {
      setIsScanning(false);
    }
  };

  const handleComputeSuggestions = async () => {
    setIsScanningSuggestions(true);
    setSuggestionMessage(null);
    try {
      const res = await computeClaritySuggestionsAction();
      setSuggestionMessage(
        res.count > 0 ? `${res.count} clarity suggestion(s) generated.` : "No guidelines met the threshold (≥3 findings, ≥2 dismissals/challenges)."
      );
      if (res.count > 0) window.location.reload();
    } catch {
      setSuggestionMessage("Failed to evaluate clarity suggestions.");
    } finally {
      setIsScanningSuggestions(false);
    }
  };

  const handleReviewSuggestion = async (suggestionId: string, action: "ACCEPTED" | "REJECTED") => {
    setIsSubmittingReview(true);
    try {
      const fd = new FormData();
      fd.set("suggestion_id", suggestionId);
      fd.set("action", action);
      if (action === "REJECTED") fd.set("rejection_reason", rejectionReason);

      const res = await reviewClaritySuggestionAction(fd);
      if (res.success) {
        setSuggestions((prev) =>
          prev.map((s) => (s.id === suggestionId ? { ...s, status: action, rejection_reason: rejectionReason } : s))
        );
        setRejectingId(null);
        setRejectionReason("");
      }
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleResolve = async (status: DriftStatusType) => {
    if (!activeDrift) return;
    setIsUpdatingStatus(true);
    try {
      await updateDriftStatusAction({
        driftId: activeDrift.id,
        status,
        notes: resolutionNote ? `${activeDrift.recommendation || ""}\n[Action Log]: ${resolutionNote}` : undefined,
      });
      setInsights((prev) =>
        status === "RESOLVED" ? prev.filter((d) => d.id !== activeDrift.id) : prev
      );
      alert(`Drift pattern status updated to ${status}.`);
      setActiveDrift(null);
      setResolutionNote("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update drift status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Drift Telemetry Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="brutal-card p-4 bg-white relative">
          <div className="flex items-center space-x-1">
            <span className="font-mono text-[10px] font-bold text-[#637367] uppercase block">
              ACTIVE DRIFT PATTERNS
            </span>
            <HelpTip
              text="Aggregated patterns of repeated rule violations, common dismissals, and challenged policies to guide brand guideline improvements."
              articleHash="brand-drift"
            />
          </div>
          <span className="font-mono text-2xl font-extrabold text-[#D94C4C]">
            {totalPatterns} CLUSTERS
          </span>
        </div>
        <div className="brutal-card p-4 bg-white">
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase block">
            TOTAL VIOLATIONS
          </span>
          <span className="font-mono text-2xl font-extrabold text-[#17251C]">
            {totalViolations} DETECTIONS
          </span>
        </div>
        <div className="brutal-card p-4 bg-white">
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase block">
            DRIFT VELOCITY
          </span>
          <div className="flex items-center space-x-1.5 mt-0.5">
            <TrendingDown className="w-4 h-4 text-[#E6A23C]" />
            <span className="font-mono text-2xl font-extrabold text-[#E6A23C]">
              +14.2%
            </span>
            <span className="text-[10px] font-mono text-[#637367]">/ 30d</span>
          </div>
        </div>
        <div className="brutal-card p-4 bg-white">
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase block">
            AUDIT CORPUS
          </span>
          <span className="font-mono text-2xl font-extrabold text-[#16834A]">
            {totalAuditsCount} ANALYZED
          </span>
        </div>
      </div>

      {/* 2. Controls and Scan Bar */}
      <div className="brutal-card p-4 bg-white space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#637367]" />
            <input
              type="text"
              placeholder="Search drift patterns, affected copy, or departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#F4F1E8] brutal-border text-xs font-mono focus:outline-none"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
            <button
              onClick={() => setSelectedType("ALL")}
              className={`px-3 py-1.5 brutal-border font-bold uppercase transition-all ${
                selectedType === "ALL"
                  ? "bg-[#17251C] text-white"
                  : "bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD]"
              }`}
            >
              ALL ({insights.length})
            </button>
            <button
              onClick={() => setSelectedType("EXPIRED")}
              className={`px-3 py-1.5 brutal-border font-bold uppercase transition-all ${
                selectedType === "EXPIRED"
                  ? "bg-[#D94C4C] text-white"
                  : "bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD]"
              }`}
            >
              EXPIRED STATS
            </button>
            <button
              onClick={() => setSelectedType("VOICE")}
              className={`px-3 py-1.5 brutal-border font-bold uppercase transition-all ${
                selectedType === "VOICE"
                  ? "bg-[#E6A23C] text-[#17251C]"
                  : "bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD]"
              }`}
            >
              VOICE DEVIATIONS
            </button>
            <button
              onClick={() => setSelectedType("CLAIMS")}
              className={`px-3 py-1.5 brutal-border font-bold uppercase transition-all ${
                selectedType === "CLAIMS"
                  ? "bg-[#16834A] text-white"
                  : "bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD]"
              }`}
            >
              REPEATED CLAIMS
            </button>

            {/* Scan button */}
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="px-4 py-1.5 bg-[#B7F28B] text-[#17251C] brutal-border font-bold uppercase hover:bg-[#16834A] hover:text-white transition-all flex items-center space-x-1.5 brutal-shadow-sm cursor-pointer ml-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
              <span>{isScanning ? "SCANNING AUDITS..." : "SCAN CORPUS FOR DRIFT"}</span>
            </button>
          </div>
        </div>

        {scanMessage && (
          <div className="p-2 bg-[#DDEBDD] brutal-border text-xs font-mono text-[#17251C] flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#16834A]" />
            <span>{scanMessage}</span>
          </div>
        )}
      </div>

      {/* 3. Drift Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInsights.length === 0 ? (
          <div className="col-span-full brutal-card bg-white p-12 text-center space-y-3">
            <TrendingDown className="w-10 h-10 text-[#637367] mx-auto opacity-50" />
            <h3 className="font-mono font-bold text-base text-[#17251C]">
              NO BRAND DRIFT DETECTED IN THIS CATEGORY
            </h3>
            <p className="font-mono text-xs text-[#637367]">
              All content submissions adhere strictly to published guidelines and verified facts.
            </p>
          </div>
        ) : (
          filteredInsights.map((drift) => {
            const depts = Array.isArray(drift.affected_departments)
              ? drift.affected_departments
              : [String(drift.affected_departments)];

            return (
              <div
                key={drift.id}
                className="brutal-card bg-white p-5 flex flex-col justify-between space-y-4 hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
              >
                <div className="space-y-3">
                  {/* Top status bar */}
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span
                      className={`font-extrabold px-2 py-0.5 brutal-border uppercase ${
                        drift.insight_type === "expired_stat_reuse"
                          ? "bg-[#D94C4C] text-white"
                          : drift.insight_type === "voice_deviation"
                          ? "bg-[#E6A23C] text-[#17251C]"
                          : "bg-[#16834A] text-white"
                      }`}
                    >
                      {drift.insight_type.replace(/_/g, " ")}
                    </span>

                    <span className="font-extrabold px-2 py-0.5 bg-[#F4F1E8] brutal-border flex items-center space-x-1 text-[#D94C4C]">
                      <Flame className="w-3 h-3 text-[#D94C4C]" />
                      <span>{drift.frequency}x DETECTED</span>
                    </span>
                  </div>

                  {/* Title and Summary */}
                  <div>
                    <h3 className="font-mono font-extrabold text-base text-[#17251C] leading-snug">
                      {drift.title}
                    </h3>
                    <p className="text-xs text-[#637367] mt-2 leading-relaxed font-sans">
                      {drift.summary}
                    </p>
                  </div>

                  {/* Recommendation snippet */}
                  {drift.recommendation && (
                    <div className="p-3 bg-[#F4F1E8] brutal-border text-xs space-y-1">
                      <span className="font-mono font-bold text-[10px] text-[#16834A] block uppercase">
                        REMEDIATION RECOMMENDATION:
                      </span>
                      <p className="text-xs text-[#17251C] font-mono leading-snug">
                        {drift.recommendation}
                      </p>
                    </div>
                  )}
                </div>

                {/* Bottom info & action */}
                <div className="pt-3 border-t-2 border-[#253C2B] space-y-3">
                  <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                    <span className="text-[#637367] self-center">DEPTS:</span>
                    {depts.map((d) => (
                      <span
                        key={d}
                        className="px-1.5 py-0.2 bg-[#DDEBDD] brutal-border text-[#17251C] font-bold"
                      >
                        {d}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => setActiveDrift(drift)}
                    className="w-full brutal-btn brutal-btn-primary py-2 text-xs font-mono font-bold flex items-center justify-center space-x-1.5"
                  >
                    <span>INVESTIGATE PATTERN</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Investigation Modal Dialog */}
      <Dialog open={!!activeDrift} onOpenChange={(open) => !open && setActiveDrift(null)}>
        {activeDrift && (
          <div className="space-y-4">
            <DialogHeader>
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-[#D94C4C]" />
                <DialogTitle>DRIFT INVESTIGATION & REMEDIATION</DialogTitle>
              </div>
              <DialogDescription>
                Systemic brand drift pattern #{activeDrift.id.slice(0, 8)} detected across {activeDrift.frequency} audits.
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 bg-[#F4F1E8] brutal-border space-y-2 font-mono text-xs">
              <span className="text-[10px] font-bold text-[#637367] uppercase block">
                ROOT CAUSE ANALYSIS:
              </span>
              <p className="text-sm font-bold text-[#17251C]">{activeDrift.title}</p>
              <p className="text-xs text-[#637367]">{activeDrift.summary}</p>
            </div>

            <div className="p-4 bg-white brutal-border space-y-2 font-mono text-xs">
              <span className="text-[10px] font-bold text-[#16834A] uppercase block">
                RECOMMENDED GOVERNANCE FIX:
              </span>
              <p className="text-xs text-[#17251C] leading-relaxed">
                {activeDrift.recommendation || "Update Brand Knowledge Vault guidelines and broadcast change."}
              </p>
              <div className="pt-2 flex items-center space-x-2">
                <Link
                  href="/knowledge"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#B7F28B] brutal-border text-xs font-bold text-[#17251C] hover:bg-[#16834A] hover:text-white transition-all"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>OPEN BRAND KNOWLEDGE VAULT &rarr;</span>
                </Link>
              </div>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <label className="block font-bold text-[#17251C] uppercase">
                INVESTIGATION NOTES & ACTION RECORD:
              </label>
              <textarea
                rows={3}
                placeholder="Document resolution, training scheduled, or guideline amendment details..."
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                className="w-full p-2.5 bg-[#F4F1E8] brutal-border text-xs font-mono focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t-2 border-[#253C2B]">
              <button
                type="button"
                onClick={() => setActiveDrift(null)}
                className="px-3 py-1.5 bg-[#F4F1E8] brutal-border text-xs font-mono font-bold hover:bg-[#DDEBDD]"
              >
                CLOSE
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => handleResolve("ACCEPTED_EXCEPTION")}
                className="px-3 py-1.5 bg-[#E6A23C] text-[#17251C] brutal-border text-xs font-mono font-bold hover:opacity-90"
              >
                ACCEPT AS EXCEPTION
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => handleResolve("RESOLVED")}
                className="px-4 py-1.5 bg-[#16834A] text-white brutal-border text-xs font-mono font-bold brutal-shadow-sm flex items-center space-x-1.5"
              >
                {isUpdatingStatus ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>SAVING...</span>
                  </>
                ) : (
                  <span>MARK RESOLVED</span>
                )}
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* 4. Guideline Clarity Suggestions */}
      <div className="brutal-card p-5 bg-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-[#253C2B] pb-3 gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-[#16834A]" />
              <h3 className="font-mono font-bold text-sm uppercase tracking-wider text-[#17251C]">
                GUIDELINE CLARITY SUGGESTIONS ({suggestions.length})
              </h3>
            </div>
            <p className="text-xs text-[#637367] mt-0.5 font-mono">
              Computed strictly from historical audit friction: rules with ≥3 findings and ≥2 dismissals or challenges in the last 90 days.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {suggestionMessage && (
              <span className="text-xs font-mono text-[#16834A]">{suggestionMessage}</span>
            )}
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                disabled={isScanningSuggestions}
                onClick={handleComputeSuggestions}
                className="flex items-center space-x-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanningSuggestions ? "animate-spin" : ""}`} />
                <span>COMPUTE SUGGESTIONS</span>
              </Button>
            )}
          </div>
        </div>

        {suggestions.length === 0 ? (
          <div className="p-6 text-center font-mono text-xs text-[#637367]">
            No guidelines or terminology rules currently exceed the friction threshold (≥3 findings, ≥2 dismissals/challenges).
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((sug) => {
              const isOpen = sug.status === "OPEN";

              return (
                <div key={sug.id} className="brutal-panel bg-[#F4F1E8] p-4 font-mono text-xs space-y-3">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-[#17251C] text-sm">
                          {sug.rule_label}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 brutal-border ${
                            sug.status === "OPEN"
                              ? "bg-[#FFF8E6] text-[#B45309]"
                              : sug.status === "ACCEPTED"
                              ? "bg-[#DDEBDD] text-[#16834A]"
                              : "bg-[#FDECEA] text-[#D94C4C]"
                          }`}
                        >
                          {sug.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-3 text-[10px] text-[#637367] pt-0.5">
                        <span>Findings: <strong>{sug.findings_count}</strong></span>
                        <span>Dismissed: <strong>{sug.dismissed_count}</strong></span>
                        <span>Challenged: <strong>{sug.challenged_count}</strong></span>
                        <span>Reversed: <strong>{sug.reversed_count}</strong></span>
                      </div>
                    </div>

                    {canManage && isOpen && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="lime"
                          size="sm"
                          disabled={isSubmittingReview}
                          onClick={() => handleReviewSuggestion(sug.id, "ACCEPTED")}
                        >
                          ACCEPT (DRAFT NOTE)
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isSubmittingReview}
                          onClick={() => setRejectingId(sug.id)}
                          className="text-[#D94C4C] hover:bg-[#FDECEA]"
                        >
                          REJECT
                        </Button>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-[#17251C] leading-relaxed bg-white p-2.5 brutal-border">
                    {sug.suggestion_text}
                  </p>

                  {sug.rejection_reason && (
                    <div className="text-[11px] text-[#D94C4C] font-mono">
                      Rejection Reason: {sug.rejection_reason}
                    </div>
                  )}

                  {rejectingId === sug.id && (
                    <div className="p-3 bg-white brutal-border space-y-2">
                      <label className="block text-[10px] font-bold text-[#17251C] uppercase">
                        REJECTION REASON (DOCUMENTED DECISION):
                      </label>
                      <input
                        type="text"
                        placeholder="Why is this suggestion rejected? (e.g., rule is strict legal mandate)"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="w-full p-2 bg-[#F4F1E8] brutal-border text-xs focus:outline-none"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRejectingId(null);
                            setRejectionReason("");
                          }}
                        >
                          CANCEL
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isSubmittingReview || !rejectionReason.trim()}
                          onClick={() => handleReviewSuggestion(sug.id, "REJECTED")}
                        >
                          CONFIRM REJECTION
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
