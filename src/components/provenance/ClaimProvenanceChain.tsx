"use client";

import * as React from "react";
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
} from "lucide-react";

export interface ClaimProvenanceItem {
  id: string;
  claim_text: string;
  claim_type: string;
  start_index: number;
  end_index: number;
  verification_status: string;
  tolerance_variance_percent: number | null;
  comparison_explanation: string;
  created_at: string;
  matched_fact?: {
    id: string;
    name: string;
    value: string;
    approval_status: string;
    expires_at: string | null;
    superseded_by: string | null;
  } | null;
  audit?: {
    id: string;
    content_items?: {
      title: string;
      platform: string;
      department: string;
    } | null;
  } | null;
}

interface FactOption {
  id: string;
  name: string;
  value: string;
  approval_status: string;
  expires_at: string | null;
}

export function ClaimProvenanceChain({
  claims,
  availableFacts,
  initialSelectedClaimId,
}: {
  claims: ClaimProvenanceItem[];
  availableFacts: FactOption[];
  initialSelectedClaimId?: string;
}) {
  const [claimList, setClaimList] = React.useState<ClaimProvenanceItem[]>(claims);
  const [selectedClaimId, setSelectedClaimId] = React.useState<string>(
    initialSelectedClaimId || claims[0]?.id || ""
  );
  const [selectedFactToAttach, setSelectedFactToAttach] = React.useState<string>("");
  const [isReassessing, setIsReassessing] = React.useState(false);
  const [reassessFeedback, setReassessFeedback] = React.useState<string | null>(null);

  const selectedClaim = claimList.find((c) => c.id === selectedClaimId);

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
      {/* 1. Selector Bar */}
      <div className="brutal-panel bg-white p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#253C2B] pb-3 mb-3">
          <div className="flex items-center space-x-2">
            <GitBranch className="w-4 h-4 text-[#16834A]" />
            <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
              EXTRACTED PROVENANCE CLAIMS ({claimList.length})
            </h3>
          </div>
          <span className="font-mono text-[10px] text-[#637367]">
            Select a claim to trace the empirical verification chain
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {claimList.map((c) => {
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
                  <span className="text-[10px] font-extrabold truncate max-w-[120px]">
                    {c.claim_text}
                  </span>
                  <span className={`text-[9px] font-extrabold px-1.5 py-0.2 brutal-border ${statusColor}`}>
                    {c.verification_status}
                  </span>
                </div>
                <p className={`text-[10px] font-mono truncate ${isSelected ? "text-white/80" : "text-[#637367]"}`}>
                  {c.audit?.content_items?.title || "Submission Draft"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {selectedClaim ? (
        <div className="space-y-6">
          {/* 2. THE VISUAL CHAIN: 5 STAGES WITH SVG CONNECTORS */}
          <div className="brutal-panel bg-white p-5 space-y-4">
            <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C] border-b-2 border-[#253C2B] pb-2">
              FIVE-STAGE PROVENANCE TRACEABILITY PIPELINE
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
              {/* Node 1: SUBMITTED CLAIM */}
              <div className="p-3.5 bg-[#F4F1E8] brutal-border flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-[10px] font-mono font-extrabold text-[#637367] mb-2 uppercase">
                    <FileText className="w-3.5 h-3.5 text-[#16834A]" />
                    <span>01 SUBMITTED CLAIM</span>
                  </div>
                  <p className="font-mono text-xs font-bold text-[#17251C] bg-white p-2 brutal-border">
                    &ldquo;{selectedClaim.claim_text}&rdquo;
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
                      TYPE: {selectedClaim.claim_type}
                    </span>
                    <span className="block text-[10px] text-[#637367]">
                      Offsets: [{selectedClaim.start_index} &ndash; {selectedClaim.end_index}]
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
                  {selectedClaim.matched_fact ? (
                    <div className="space-y-1 font-mono text-xs">
                      <p className="font-bold text-[#17251C] line-clamp-2">
                        {selectedClaim.matched_fact.name}
                      </p>
                      <span className="block text-[10px] text-[#16834A] font-bold">
                        {selectedClaim.matched_fact.value}
                      </span>
                    </div>
                  ) : (
                    <div className="p-1.5 bg-[#D94C4C]/10 brutal-border font-mono text-[10px] font-bold text-[#D94C4C]">
                      NO APPROVED EVIDENCE FOUND
                    </div>
                  )}
                </div>
                <span className="font-mono text-[9px] text-[#637367] mt-2 block">
                  Authoritative Vault Link
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
                    {selectedClaim.comparison_explanation}
                  </p>
                </div>
                <span className="font-mono text-[9px] text-[#637367] mt-2 block">
                  5.0% Variance Gate
                </span>
              </div>

              {/* Node 5: VERIFICATION RESULT */}
              <div
                className={`p-3.5 brutal-border flex flex-col justify-between ${
                  selectedClaim.verification_status === "VERIFIED"
                    ? "bg-[#B7F28B] text-[#17251C]"
                    : selectedClaim.verification_status === "CONTRADICTED"
                    ? "bg-[#D94C4C] text-white"
                    : selectedClaim.verification_status === "OUTDATED"
                    ? "bg-[#E6A23C] text-[#17251C]"
                    : "bg-[#F4F1E8] text-[#17251C]"
                }`}
              >
                <div>
                  <div className="flex items-center space-x-1.5 text-[10px] font-mono font-extrabold mb-2 uppercase">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>05 RESULT</span>
                  </div>
                  <span className="font-mono text-base font-black uppercase tracking-tight block">
                    {selectedClaim.verification_status}
                  </span>
                </div>
                <span className="font-mono text-[9px] font-bold mt-2 block">
                  Deterministic Audit Decision
                </span>
              </div>
            </div>
          </div>

          {/* 3. DETAIL PANEL & REASSESSMENT WORKBENCH */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 cols: Evidence Detail Card */}
            <div className="lg:col-span-7 brutal-panel bg-white p-5 space-y-4 font-mono">
              <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-3">
                <div className="flex items-center space-x-2">
                  <IdTag id={selectedClaim.id.slice(0, 8)} prefix="CLAIM-" />
                  <span className="text-xs font-bold uppercase text-[#17251C]">
                    EMPIRICAL VERIFICATION AUDIT TRAIL
                  </span>
                </div>
                <span
                  className={`text-xs font-black px-2 py-0.5 brutal-border ${
                    selectedClaim.verification_status === "VERIFIED"
                      ? "bg-[#B7F28B] text-[#17251C]"
                      : selectedClaim.verification_status === "CONTRADICTED"
                      ? "bg-[#D94C4C] text-white"
                      : "bg-[#E6A23C] text-[#17251C]"
                  }`}
                >
                  {selectedClaim.verification_status}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] text-[#637367] uppercase block font-bold">
                    SUBMITTED CLAIM STATEMENT:
                  </span>
                  <p className="font-bold text-sm text-[#17251C] bg-[#F4F1E8] p-2 brutal-border mt-1">
                    &ldquo;{selectedClaim.claim_text}&rdquo;
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 bg-[#F4F1E8] brutal-border">
                    <span className="text-[10px] text-[#637367] uppercase block">CLAIM TYPE:</span>
                    <span className="font-bold text-[#17251C] uppercase">{selectedClaim.claim_type}</span>
                  </div>

                  <div className="p-2.5 bg-[#F4F1E8] brutal-border">
                    <span className="text-[10px] text-[#637367] uppercase block">VARIANCE TOLERANCE:</span>
                    <span className="font-bold text-[#17251C]">
                      {selectedClaim.tolerance_variance_percent !== null
                        ? `${selectedClaim.tolerance_variance_percent > 0 ? "+" : ""}${selectedClaim.tolerance_variance_percent}%`
                        : "N/A (Categorical / Outdated)"}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-[#637367] uppercase block font-bold">
                    AUTHORITATIVE BENCHMARK MATCH:
                  </span>
                  {selectedClaim.matched_fact ? (
                    <div className="p-2.5 bg-[#DDEBDD] brutal-border mt-1 space-y-1">
                      <span className="font-bold text-sm text-[#16834A] block">
                        {selectedClaim.matched_fact.name}
                      </span>
                      <p className="text-[#17251C] font-extrabold text-xs">
                        Benchmark Value: {selectedClaim.matched_fact.value}
                      </p>
                      <span className="text-[10px] text-[#637367] block">
                        Status: {selectedClaim.matched_fact.approval_status} &bull; Expiry:{" "}
                        {selectedClaim.matched_fact.expires_at
                          ? new Date(selectedClaim.matched_fact.expires_at).toLocaleDateString()
                          : "Permanent"}
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-[#D94C4C]/10 border-2 border-[#D94C4C] text-[#D94C4C] font-bold mt-1">
                      NO APPROVED EVIDENCE FOUND &mdash; This claim has no matching benchmark in the Brand Knowledge Vault.
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-[#637367] uppercase block font-bold">
                    COMPARISON RATIONALE:
                  </span>
                  <p className="text-xs text-[#17251C] leading-relaxed p-2.5 bg-[#F4F1E8] brutal-border mt-1">
                    {selectedClaim.comparison_explanation}
                  </p>
                </div>
              </div>
            </div>

            {/* Right 5 cols: Reassessment & Evidence Attachment Workbench */}
            <div className="lg:col-span-5 brutal-panel bg-white p-5 space-y-4">
              <div className="border-b-2 border-[#253C2B] pb-3">
                <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
                  ATTACH EVIDENCE & RE-ASSESS
                </h3>
                <p className="text-[11px] text-[#637367] mt-0.5 font-mono">
                  Brand Managers & Reviewers can associate candidate evidence and trigger deterministic re-evaluation.
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
