"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { IdTag } from "@/components/ui/id-tag";
import { reassessClaimAction } from "@/app/actions/provenance";
import {
  GitBranch,
  FileText,
  Database,
  Scale,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  Clock,
  ShieldAlert,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import { HelpTip } from "@/components/guidance/HelpTip";

export interface EvidenceMatchData {
  id: string;
  excerpt?: string | null;
  result: string;
  comparison?: {
    explanation?: string;
    rule?: string;
    variance_percent?: number | null;
    claimed_value?: number;
    approved_value?: number;
    tolerance_pct?: number;
  } | null;
  created_at: string;
  approved_fact?: {
    id: string;
    name: string;
    value: string;
    numeric_value?: number | null;
    unit?: string | null;
    metric?: string | null;
    source_version?: string | null;
    approval_status: string;
    verified_at?: string | null;
    expires_at?: string | null;
    superseded_by?: string | null;
    source?: {
      id: string;
      name: string;
      version?: string | null;
      last_verified_at?: string | null;
      expires_at?: string | null;
    } | null;
  } | null;
  evidence_source?: {
    id: string;
    name: string;
    version?: string | null;
    last_verified_at?: string | null;
    expires_at?: string | null;
  } | null;
}

export interface ClaimProvenanceItem {
  id: string;
  audit_id: string;
  claim_text: string;
  claim_type: string;
  numeric_value?: number | null;
  unit?: string | null;
  metric?: string | null;
  start_offset?: number | null;
  end_offset?: number | null;
  verification_status: string;
  confidence?: string;
  tolerance_variance_percent?: number | null;
  comparison_explanation?: string;
  created_at: string;
  audit?: {
    id: string;
    overall_score?: number | null;
    created_at?: string;
    content_items?: {
      id?: string;
      title?: string;
      platform?: string;
      department?: string;
    } | null;
  } | null;
  evidence_matches?: EvidenceMatchData[];
  matched_fact?: {
    id: string;
    name: string;
    value: string;
    approval_status: string;
    expires_at: string | null;
    source_version?: string | null;
    verified_at?: string | null;
    superseded_by?: string | null;
    source?: {
      id: string;
      name: string;
      version?: string | null;
      last_verified_at?: string | null;
      expires_at?: string | null;
    } | null;
  } | null;
}

export interface AuditOption {
  id: string;
  title: string;
  platform?: string;
  department?: string;
  claimCount: number;
  score?: number | null;
  created_at?: string;
}

export interface FactOption {
  id: string;
  name: string;
  value: string;
  approval_status: string;
  expires_at: string | null;
}

interface ClaimProvenanceChainProps {
  claims: ClaimProvenanceItem[];
  availableFacts: FactOption[];
  audits: AuditOption[];
  initialSelectedClaimId?: string;
  initialSelectedAuditId?: string;
}

export function ClaimProvenanceChain({
  claims,
  availableFacts,
  audits,
  initialSelectedClaimId,
  initialSelectedAuditId,
}: ClaimProvenanceChainProps) {
  const [claimList, setClaimList] = React.useState<ClaimProvenanceItem[]>(claims);
  const [selectedAuditId, setSelectedAuditId] = React.useState<string>(
    initialSelectedAuditId || "ALL"
  );

  // Sync claimList if parent claims prop updates
  React.useEffect(() => {
    setClaimList(claims);
  }, [claims]);

  // Filter claims by chosen audit
  const filteredClaims = React.useMemo(() => {
    if (selectedAuditId === "ALL") {
      return claimList;
    }
    return claimList.filter((c) => c.audit_id === selectedAuditId);
  }, [claimList, selectedAuditId]);

  const [selectedClaimId, setSelectedClaimId] = React.useState<string>(() => {
    if (initialSelectedClaimId && claimList.some((c) => c.id === initialSelectedClaimId)) {
      return initialSelectedClaimId;
    }
    return filteredClaims[0]?.id || claimList[0]?.id || "";
  });

  // Keep selectedClaimId valid when filter changes
  React.useEffect(() => {
    if (filteredClaims.length > 0 && !filteredClaims.some((c) => c.id === selectedClaimId)) {
      setSelectedClaimId(filteredClaims[0].id);
    }
  }, [filteredClaims, selectedClaimId]);

  const [selectedFactToAttach, setSelectedFactToAttach] = React.useState<string>("");
  const [isReassessing, setIsReassessing] = React.useState(false);
  const [reassessFeedback, setReassessFeedback] = React.useState<string | null>(null);

  const selectedClaim = claimList.find((c) => c.id === selectedClaimId);

  // Derive evidence match chain details
  const match = selectedClaim?.evidence_matches?.[0];
  const matchedFact = match?.approved_fact || selectedClaim?.matched_fact;
  const evidenceSource = match?.evidence_source || matchedFact?.source;
  const hasApprovedEvidence = Boolean(matchedFact || evidenceSource);

  // Format Chain Fields
  const submittedClaim = selectedClaim?.claim_text || "";
  const claimType = selectedClaim?.claim_type || "factual";
  const matchedFactName = matchedFact?.name || evidenceSource?.name || null;
  const sourceName = evidenceSource?.name || (matchedFact ? `Fact Vault: ${matchedFact.name}` : null);
  const sourceVersion = matchedFact?.source_version || evidenceSource?.version || (matchedFact ? "v1.0" : "N/A");
  const supportingExcerpt = match?.excerpt || matchedFact?.value || "No supporting excerpt available";
  const evidenceDate = matchedFact?.verified_at || evidenceSource?.last_verified_at || match?.created_at || null;

  // Expiry calculation
  const expiresAt = matchedFact?.expires_at || evidenceSource?.expires_at;
  const isExpired =
    matchedFact?.approval_status === "EXPIRED" ||
    (expiresAt ? new Date(expiresAt) < new Date() : false);

  const expiryStatusText = !hasApprovedEvidence
    ? "N/A"
    : isExpired
    ? `EXPIRED (${expiresAt ? new Date(expiresAt).toLocaleDateString() : "Outdated benchmark"})`
    : expiresAt
    ? `ACTIVE (Valid until ${new Date(expiresAt).toLocaleDateString()})`
    : "PERMANENT / ACTIVE (No expiration)";

  // Comparison explanation
  const comparisonExplanation =
    match?.comparison?.explanation ||
    match?.comparison?.rule ||
    selectedClaim?.comparison_explanation ||
    (hasApprovedEvidence
      ? "Deterministic comparison against approved benchmark fact in the Brand Knowledge Vault."
      : "NO APPROVED EVIDENCE FOUND — This claim has no matching benchmark or source in the Brand Knowledge Vault.");

  const variancePercent =
    match?.comparison?.variance_percent ??
    selectedClaim?.tolerance_variance_percent ??
    null;

  const resultStatus = selectedClaim?.verification_status || match?.result || "UNSUPPORTED";

  async function handleReassess() {
    if (!selectedClaim) return;
    setIsReassessing(true);
    setReassessFeedback(null);

    try {
      const res = await reassessClaimAction({
        claimId: selectedClaim.id,
        selectedFactId: selectedFactToAttach || undefined,
      });

      if (res.success) {
        setReassessFeedback(`Claim reassessed: ${res.status}. ${res.explanation}`);
        setClaimList((prev) =>
          prev.map((c) =>
            c.id === selectedClaim.id
              ? {
                  ...c,
                  verification_status: res.status,
                  comparison_explanation: res.explanation,
                  matched_fact: res.matchedFact || c.matched_fact,
                  evidence_matches: res.matchedFact
                    ? [
                        {
                          id: `match-${Date.now()}`,
                          excerpt: c.claim_text,
                          result: res.status,
                          created_at: new Date().toISOString(),
                          comparison: {
                            explanation: res.explanation,
                            variance_percent: (res as any).variancePercent || null,
                          },
                          approved_fact: res.matchedFact as any,
                        },
                      ]
                    : [],
                }
              : c
          )
        );
      }
    } catch (err: unknown) {
      setReassessFeedback(err instanceof Error ? err.message : "Reassessment failed");
    } finally {
      setIsReassessing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Audit Selector & Filter Console */}
      <div className="brutal-panel bg-white p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#253C2B] pb-3">
          <div className="flex items-center space-x-2">
            <GitBranch className="w-4 h-4 text-[#16834A]" />
            <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
              EXTRACTED PROVENANCE CLAIMS ({filteredClaims.length} OF {claimList.length})
            </h3>
          </div>

          {/* Audit Filter Dropdown */}
          <div className="flex items-center space-x-2 font-mono text-xs">
            <Filter className="w-3.5 h-3.5 text-[#16834A]" />
            <span className="font-bold text-[#17251C] uppercase text-[11px]">AUDIT:</span>
            <select
              value={selectedAuditId}
              onChange={(e) => setSelectedAuditId(e.target.value)}
              className="px-3 py-1.5 bg-[#F4F1E8] brutal-border font-bold text-[#17251C] text-xs focus:outline-none"
            >
              <option value="ALL">ALL AUDITS ({claimList.length} CLAIMS)</option>
              {audits.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.claimCount} claims &bull; {a.score ? `${a.score}/100` : "Audit"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Claims Cards Grid (Newest First) */}
        {filteredClaims.length === 0 ? (
          <div className="p-6 text-center font-mono text-xs text-[#637367]">
            No extracted claims found for the selected audit filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 max-h-[300px] overflow-y-auto p-1">
            {filteredClaims.map((c) => {
              const isSelected = c.id === selectedClaimId;
              const statusColor =
                c.verification_status === "VERIFIED"
                  ? "bg-[#B7F28B] text-[#17251C]"
                  : c.verification_status === "CONTRADICTED"
                  ? "bg-[#D94C4C] text-white"
                  : c.verification_status === "OUTDATED"
                  ? "bg-[#E6A23C] text-[#17251C]"
                  : "bg-[#F4F1E8] text-[#17251C]";

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedClaimId(c.id);
                    setReassessFeedback(null);
                  }}
                  className={`p-3 text-left brutal-border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#16834A] text-white brutal-shadow"
                      : "bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 font-mono">
                    <span className="text-[11px] font-extrabold truncate max-w-[130px]">
                      &ldquo;{c.claim_text}&rdquo;
                    </span>
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.2 brutal-border ${statusColor}`}>
                      {c.verification_status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className={`truncate max-w-[120px] ${isSelected ? "text-white/80" : "text-[#637367]"}`}>
                      {c.audit?.content_items?.title || "Audit"}
                    </span>
                    <span className={`uppercase font-bold ${isSelected ? "text-[#B7F28B]" : "text-[#16834A]"}`}>
                      {c.claim_type}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedClaim ? (
        <div className="space-y-6">
          {/* 2. THE VISUAL CHAIN: 5 STAGES WITH SVG CONNECTORS */}
          <div className="brutal-panel bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-2 font-mono">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#17251C]">
                FIVE-STAGE PROVENANCE TRACEABILITY PIPELINE
              </h3>
              <span className="text-[10px] text-[#637367]">
                Selected Claim ID: <strong className="text-[#17251C]">{selectedClaim.id.slice(0, 8)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
              {/* Node 1: SUBMITTED CLAIM */}
              <div className="p-3.5 bg-[#F4F1E8] brutal-border flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-[10px] font-mono font-extrabold text-[#637367] mb-2 uppercase">
                    <FileText className="w-3.5 h-3.5 text-[#16834A]" />
                    <span>01 SUBMITTED CLAIM</span>
                  </div>
                  <p className="font-mono text-xs font-bold text-[#17251C] bg-white p-2 brutal-border">
                    &ldquo;{submittedClaim}&rdquo;
                  </p>
                </div>
                <span className="font-mono text-[9px] text-[#637367] mt-2 block">
                  Original raw text span
                </span>
              </div>

              {/* Node 2: CLAIM EXTRACTION */}
              <div className="p-3.5 bg-[#F4F1E8] brutal-border flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-[10px] font-mono font-extrabold text-[#637367] mb-2 uppercase">
                    <Search className="w-3.5 h-3.5 text-[#16834A]" />
                    <span>02 EXTRACTION</span>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    <span className="block font-bold text-[#17251C] uppercase">
                      TYPE: {claimType}
                    </span>
                    <span className="block text-[10px] text-[#637367]">
                      Offsets: [{selectedClaim.start_offset ?? 0} &ndash; {selectedClaim.end_offset ?? submittedClaim.length}]
                    </span>
                  </div>
                </div>
                <span className="font-mono text-[9px] text-[#16834A] font-bold mt-2 block">
                  Literal Substring Verified
                </span>
              </div>

              {/* Node 3: SOURCE MATCH */}
              <div className="p-3.5 bg-[#F4F1E8] brutal-border flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-[10px] font-mono font-extrabold text-[#637367] mb-2 uppercase">
                    <Database className="w-3.5 h-3.5 text-[#16834A]" />
                    <span>03 SOURCE MATCH</span>
                  </div>
                  {hasApprovedEvidence ? (
                    <div className="space-y-1 font-mono text-xs">
                      <p className="font-bold text-[#17251C] line-clamp-2">
                        {matchedFactName}
                      </p>
                      <span className="block text-[10px] text-[#16834A] font-bold">
                        Version: {sourceVersion}
                      </span>
                    </div>
                  ) : (
                    <div className="p-2 bg-[#D94C4C]/10 brutal-border font-mono text-[10px] font-extrabold text-[#D94C4C] uppercase text-center flex items-center justify-center gap-1">
                      <span>NO APPROVED EVIDENCE FOUND</span>
                      <HelpTip
                        text="Indicates that no active, approved, unexpired fact in the Knowledge Vault corroborates this statement."
                        articleHash="evidence-matching"
                      />
                    </div>
                  )}
                </div>
                <span className="font-mono text-[9px] text-[#637367] mt-2 block">
                  {hasApprovedEvidence ? "Authoritative Vault Link" : "Unsubstantiated in Vault"}
                </span>
              </div>

              {/* Node 4: EVIDENCE COMPARISON */}
              <div className="p-3.5 bg-[#F4F1E8] brutal-border flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-[10px] font-mono font-extrabold text-[#637367] mb-2 uppercase">
                    <Scale className="w-3.5 h-3.5 text-[#16834A]" />
                    <span>04 COMPARISON</span>
                  </div>
                  <p className="font-mono text-[10px] text-[#17251C] leading-normal line-clamp-3">
                    {comparisonExplanation}
                  </p>
                </div>
                <span className="font-mono text-[9px] text-[#637367] mt-2 block">
                  {variancePercent !== null ? `Variance: ${variancePercent}%` : "Benchmark Gate"}
                </span>
              </div>

              {/* Node 5: VERIFICATION RESULT */}
              <div
                className={`p-3.5 brutal-border flex flex-col justify-between ${
                  resultStatus === "VERIFIED"
                    ? "bg-[#B7F28B] text-[#17251C]"
                    : resultStatus === "CONTRADICTED"
                    ? "bg-[#D94C4C] text-white"
                    : resultStatus === "OUTDATED"
                    ? "bg-[#E6A23C] text-[#17251C]"
                    : "bg-[#F4F1E8] text-[#17251C]"
                }`}
              >
                <div>
                  <div className="flex items-center space-x-1.5 text-[10px] font-mono font-extrabold mb-2 uppercase">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>05 RESULT</span>
                    <HelpTip
                      text={[
                        "VERIFIED: Matches active approved fact with excerpt provenance.",
                        "PARTIALLY_SUPPORTED: Directional match with slight variance.",
                        "CONTRADICTED: Directly conflicts with approved benchmark (CRITICAL).",
                        "OUTDATED: Document expired or superseded.",
                        "HUMAN_VERIFICATION_REQUIRED / UNSUPPORTED: Lacks approved evidence."
                      ]}
                      articleHash="claim-statuses"
                    />
                  </div>
                  <span className="font-mono text-base font-black uppercase tracking-tight block">
                    {resultStatus}
                  </span>
                </div>
                <span className="font-mono text-[9px] font-bold mt-2 block">
                  Deterministic Audit Decision
                </span>
              </div>
            </div>
          </div>

          {/* 3. DETAIL PANEL & EVIDENCE TRACEABILITY CHAIN */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 cols: Complete Chain Specifications */}
            <div className="lg:col-span-7 brutal-panel bg-white p-5 space-y-4 font-mono">
              <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-3">
                <div className="flex items-center space-x-2">
                  <IdTag id={selectedClaim.id.slice(0, 8)} prefix="CLAIM-" />
                  <span className="text-xs font-bold uppercase text-[#17251C]">
                    EMPIRICAL EVIDENCE CHAIN DETAILS
                  </span>
                </div>
                <span
                  className={`text-xs font-black px-2 py-0.5 brutal-border ${
                    resultStatus === "VERIFIED"
                      ? "bg-[#B7F28B] text-[#17251C]"
                      : resultStatus === "CONTRADICTED"
                      ? "bg-[#D94C4C] text-white"
                      : "bg-[#E6A23C] text-[#17251C]"
                  }`}
                >
                  {resultStatus}
                </span>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* 1. Submitted Claim & Claim Type */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-[#637367] uppercase block font-bold">
                      SUBMITTED CLAIM:
                    </span>
                    <p className="font-bold text-sm text-[#17251C] bg-[#F4F1E8] p-2 brutal-border mt-0.5">
                      &ldquo;{submittedClaim}&rdquo;
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#637367] uppercase block font-bold">
                      CLAIM TYPE:
                    </span>
                    <p className="font-bold text-sm text-[#17251C] bg-[#F4F1E8] p-2 brutal-border mt-0.5 uppercase">
                      {claimType}
                    </p>
                  </div>
                </div>

                {/* 2. Matched Approved Fact or Source */}
                <div>
                  <span className="text-[10px] text-[#637367] uppercase block font-bold">
                    MATCHED APPROVED FACT OR SOURCE:
                  </span>
                  {hasApprovedEvidence ? (
                    <div className="p-3 bg-[#DDEBDD] brutal-border mt-1 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-[#16834A] block">
                          {matchedFactName}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-[#16834A] text-white brutal-border">
                          VERSION {sourceVersion}
                        </span>
                      </div>
                      {matchedFact?.value && (
                        <p className="text-[#17251C] font-bold text-xs">
                          Approved Benchmark Value: &ldquo;{matchedFact.value}&rdquo;
                        </p>
                      )}
                      {sourceName && (
                        <span className="text-[10px] text-[#637367] block">
                          Underlying Source: {sourceName}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-[#D94C4C]/10 border-2 border-[#D94C4C] text-[#D94C4C] font-bold mt-1 flex items-center justify-between gap-2">
                      <span>NO APPROVED EVIDENCE FOUND &mdash; This claim has no matching benchmark in the Brand Knowledge Vault.</span>
                      <HelpTip
                        text="No active, approved, unexpired fact in the Knowledge Vault matches this claim."
                        articleHash="evidence-matching"
                      />
                    </div>
                  )}
                </div>

                {/* 3. Supporting Excerpt & Evidence Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-2.5 bg-[#F4F1E8] brutal-border space-y-1">
                    <span className="text-[10px] text-[#637367] uppercase block font-bold">
                      SUPPORTING EXCERPT:
                    </span>
                    <p className="text-[#17251C] font-medium text-[11px] leading-relaxed italic">
                      &ldquo;{supportingExcerpt}&rdquo;
                    </p>
                  </div>

                  <div className="p-2.5 bg-[#F4F1E8] brutal-border space-y-1">
                    <span className="text-[10px] text-[#637367] uppercase block font-bold">
                      EVIDENCE DATE & EXPIRY STATUS:
                    </span>
                    <div className="space-y-0.5 text-[11px]">
                      <p className="font-bold text-[#17251C]">
                        Verified Date: {evidenceDate ? new Date(evidenceDate).toLocaleDateString() : "Permanent"}
                      </p>
                      <p className={`font-bold ${isExpired ? "text-[#D94C4C]" : "text-[#16834A]"}`}>
                        Status: {expiryStatusText}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Comparison Explanation & Result */}
                <div>
                  <span className="text-[10px] text-[#637367] uppercase block font-bold">
                    COMPARISON EXPLANATION & AUDIT RESULT:
                  </span>
                  <div className="p-3 bg-[#F4F1E8] brutal-border mt-1 space-y-1.5">
                    <div className="flex items-center justify-between border-b border-[#253C2B]/10 pb-1">
                      <span className="text-[10px] font-bold text-[#637367]">DETERMINISTIC VERDICT:</span>
                      <span className={`font-extrabold px-1.5 py-0.2 brutal-border ${
                        resultStatus === "VERIFIED"
                          ? "bg-[#B7F28B] text-[#17251C]"
                          : resultStatus === "CONTRADICTED"
                          ? "bg-[#D94C4C] text-white"
                          : "bg-[#E6A23C] text-[#17251C]"
                      }`}>
                        {resultStatus}
                      </span>
                    </div>
                    <p className="text-xs text-[#17251C] leading-relaxed">
                      {comparisonExplanation}
                    </p>
                    {variancePercent !== null && (
                      <span className="text-[10px] text-[#637367] block">
                        Tolerance Variance: {variancePercent > 0 ? "+" : ""}{variancePercent}% (5.0% threshold)
                      </span>
                    )}
                  </div>
                </div>

                {/* Audit Context Link */}
                {selectedClaim.audit && (
                  <div className="pt-2 border-t border-[#253C2B]/10 flex items-center justify-between text-[11px] text-[#637367]">
                    <span>
                      Sourced from Audit: <strong>{selectedClaim.audit.content_items?.title || selectedClaim.audit.id.slice(0, 8)}</strong>
                    </span>
                    <Link
                      href={`/audits/${selectedClaim.audit.id}`}
                      className="font-bold text-[#16834A] hover:underline flex items-center space-x-1"
                    >
                      <span>VIEW FULL AUDIT &rarr;</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Right 5 cols: Reassessment & Evidence Attachment Workbench */}
            <div className="lg:col-span-5 brutal-panel bg-white p-5 space-y-4">
              <div className="border-b-2 border-[#253C2B] pb-3">
                <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
                  ATTACH EVIDENCE & RE-ASSESS
                </h3>
                <p className="text-[11px] text-[#637367] mt-0.5 font-mono">
                  Brand Managers & Reviewers can associate candidate evidence from the vault and trigger deterministic re-evaluation.
                </p>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#17251C] mb-1">
                    SELECT AUTHORITATIVE FACT FROM VAULT:
                  </label>
                  <select
                    value={selectedFactToAttach}
                    onChange={(e) => setSelectedFactToAttach(e.target.value)}
                    className="w-full px-3 py-2 bg-white brutal-border font-mono text-xs text-[#17251C] focus:outline-none"
                  >
                    <option value="">-- Automatically Detect Best Candidate --</option>
                    {availableFacts.map((fact) => (
                      <option key={fact.id} value={fact.id}>
                        {fact.name} &bull; {fact.value}
                      </option>
                    ))}
                  </select>
                </div>

                {reassessFeedback && (
                  <div className="p-2.5 bg-[#DDEBDD] brutal-border text-xs text-[#16834A] font-bold">
                    {reassessFeedback}
                  </div>
                )}

                <Button
                  onClick={handleReassess}
                  disabled={isReassessing}
                  variant="lime"
                  size="md"
                  className="w-full flex items-center justify-center space-x-1.5"
                >
                  {isReassessing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>RE-ASSESSING DETERMINISTIC CHAIN...</span>
                    </>
                  ) : (
                    <>
                      <Scale className="w-3.5 h-3.5" />
                      <span>RE-ASSESS CLAIM PROVENANCE &rarr;</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="brutal-panel bg-white p-8 text-center font-mono text-xs text-[#637367]">
          No claims available for provenance inspection. Submit content in the Content Studio to extract claims.
        </div>
      )}
    </div>
  );
}
