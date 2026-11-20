"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { reviewCandidateAction, reviewDocumentAction } from "@/app/actions/documents";

export interface DocumentCandidate {
  id: string;
  metric_name: string;
  value: string;
  numeric_value: number | null;
  unit: string | null;
  excerpt: string;
  page_number: number | null;
  review_status: "PENDING" | "APPROVED" | "REJECTED";
  reviewed_at: string | null;
  approved_fact_id: string | null;
}

export interface SourceDocumentDetail {
  id: string;
  name: string;
  version: string;
  category: string;
  owner: string | null;
  status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  mime_type: string;
  file_size_bytes: number;
  page_count: number | null;
  expiry_date: string | null;
  created_at: string;
  rejection_reason: string | null;
  document_candidates: DocumentCandidate[];
}

function CandidateRow({
  candidate,
  canEdit,
}: {
  candidate: DocumentCandidate;
  canEdit: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [metricName, setMetricName] = React.useState(candidate.metric_name);
  const [value, setValue] = React.useState(candidate.value);
  const [unit, setUnit] = React.useState(candidate.unit || "");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [localStatus, setLocalStatus] = React.useState(candidate.review_status);
  const [error, setError] = React.useState<string | null>(null);

  async function handleAction(action: "APPROVED" | "REJECTED") {
    setIsSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("candidate_id", candidate.id);
      fd.set("action", action);
      fd.set("metric_name", metricName);
      fd.set("value", value);
      fd.set("unit", unit);
      if (expiryDate) fd.set("expiry_date", expiryDate);
      const result = await reviewCandidateAction(fd);
      if (result.success) {
        setLocalStatus(action);
        setEditing(false);
      } else {
        setError(result.error || "Action failed.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const statusColor =
    localStatus === "APPROVED"
      ? "border-[#16834A] bg-[#F0FAF4]"
      : localStatus === "REJECTED"
      ? "border-[#D94C4C] bg-[#FEF2F2] opacity-60"
      : "border-[#17251C] bg-white";

  return (
    <div className={`border-2 p-4 ${statusColor} space-y-3`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          {/* Status */}
          <div className="flex items-center gap-2 mb-2">
            {localStatus === "APPROVED" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#16834A]">
                <CheckCircle2 className="w-3 h-3" /> APPROVED → Fact created
              </span>
            )}
            {localStatus === "REJECTED" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#D94C4C]">
                <XCircle className="w-3 h-3" /> REJECTED
              </span>
            )}
            {localStatus === "PENDING" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-[#B45309]">
                <Clock className="w-3 h-3" /> PENDING REVIEW
              </span>
            )}
            {candidate.page_number && (
              <span className="text-[10px] font-mono text-[#637367]">
                p.{candidate.page_number}
              </span>
            )}
          </div>

          {/* Excerpt */}
          <blockquote className="border-l-4 border-[#DDEBDD] pl-3 text-xs text-[#637367] font-mono italic mb-3 leading-relaxed">
            &ldquo;{candidate.excerpt}&rdquo;
          </blockquote>

          {/* Editable fields */}
          {editing && localStatus === "PENDING" ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#17251C] mb-0.5">
                  METRIC NAME
                </label>
                <input
                  value={metricName}
                  onChange={(e) => setMetricName(e.target.value)}
                  className="w-full px-2 py-1 border-2 border-[#17251C] text-xs font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#17251C] mb-0.5">
                  VALUE
                </label>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full px-2 py-1 border-2 border-[#17251C] text-xs font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold text-[#17251C] mb-0.5">
                  UNIT
                </label>
                <input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-2 py-1 border-2 border-[#17251C] text-xs font-mono focus:outline-none"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[10px] font-mono font-bold text-[#17251C] mb-0.5">
                  EXPIRY DATE (optional)
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-2 py-1 border-2 border-[#17251C] text-xs font-mono focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 text-xs font-mono text-[#17251C]">
              <span>
                <span className="text-[#637367]">Metric:</span> {metricName}
              </span>
              <span>
                <span className="text-[#637367]">Value:</span> {value}
              </span>
              {unit && (
                <span>
                  <span className="text-[#637367]">Unit:</span> {unit}
                </span>
              )}
            </div>
          )}

          {error && (
            <div className="mt-2 text-[10px] font-mono text-[#D94C4C] flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {error}
            </div>
          )}
        </div>

        {/* Actions */}
        {canEdit && localStatus === "PENDING" && (
          <div className="flex flex-col gap-1 shrink-0">
            {!editing && (
              <Button
                type="button"
                onClick={() => setEditing(true)}
                className="bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD] font-mono text-[10px] font-bold brutal-border px-2 py-1 h-auto"
              >
                EDIT
              </Button>
            )}
            <Button
              type="button"
              onClick={() => handleAction("APPROVED")}
              disabled={isSubmitting}
              className="bg-[#16834A] text-white hover:bg-[#17251C] font-mono text-[10px] font-bold brutal-border px-2 py-1 h-auto"
            >
              APPROVE
            </Button>
            <Button
              type="button"
              onClick={() => handleAction("REJECTED")}
              disabled={isSubmitting}
              className="bg-[#D94C4C] text-white hover:bg-[#17251C] font-mono text-[10px] font-bold brutal-border px-2 py-1 h-auto"
            >
              REJECT
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function DocumentReviewPanel({
  document: doc,
  canEdit,
}: {
  document: SourceDocumentDetail;
  canEdit: boolean;
}) {
  const [docAction, setDocAction] = React.useState<"" | "APPROVED" | "REJECTED">("");
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [isSubmittingDoc, setIsSubmittingDoc] = React.useState(false);
  const [docError, setDocError] = React.useState<string | null>(null);
  const [docStatus, setDocStatus] = React.useState(doc.status);

  const pendingCount = doc.document_candidates.filter((c) => c.review_status === "PENDING").length;
  const approvedCount = doc.document_candidates.filter(
    (c) => c.review_status === "APPROVED"
  ).length;
  const rejectedCount = doc.document_candidates.filter(
    (c) => c.review_status === "REJECTED"
  ).length;

  async function handleDocumentAction() {
    if (!docAction) return;
    setIsSubmittingDoc(true);
    setDocError(null);
    try {
      const fd = new FormData();
      fd.set("document_id", doc.id);
      fd.set("action", docAction);
      if (docAction === "REJECTED") fd.set("rejection_reason", rejectionReason);
      const result = await reviewDocumentAction(fd);
      if (result.success) {
        setDocStatus(docAction);
        setDocAction("");
      } else {
        setDocError(result.error || "Action failed.");
      }
    } finally {
      setIsSubmittingDoc(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Document Header */}
      <div className="brutal-panel bg-white p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <FileText className="w-6 h-6 text-[#637367] mt-0.5 shrink-0" />
            <div>
              <h1 className="font-mono font-extrabold text-xl text-[#17251C]">
                {doc.name}
                <span className="text-sm font-normal text-[#637367] ml-2">v{doc.version}</span>
              </h1>
              <div className="text-xs font-mono text-[#637367] mt-1 flex flex-wrap gap-3">
                <span>Category: {doc.category}</span>
                {doc.owner && <span>Owner: {doc.owner}</span>}
                {doc.page_count && <span>Pages: {doc.page_count}</span>}
                {doc.expiry_date && (
                  <span>
                    Expires: {new Date(doc.expiry_date).toLocaleDateString()}
                    {new Date(doc.expiry_date) < new Date() && (
                      <span className="text-[#D94C4C] ml-1">EXPIRED</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {docStatus === "PENDING_APPROVAL" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold border border-[#B45309] bg-[#FFF8E6] text-[#B45309]">
                <Clock className="w-3 h-3" /> PENDING DOCUMENT APPROVAL
              </span>
            )}
            {docStatus === "APPROVED" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold border border-[#16834A] bg-[#DDEBDD] text-[#16834A]">
                <CheckCircle2 className="w-3 h-3" /> DOCUMENT APPROVED
              </span>
            )}
            {docStatus === "REJECTED" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold border border-[#D94C4C] bg-[#FDECEA] text-[#D94C4C]">
                <XCircle className="w-3 h-3" /> DOCUMENT REJECTED
              </span>
            )}
          </div>
        </div>

        {doc.rejection_reason && (
          <div className="mt-3 p-2 bg-[#FDECEA] border border-[#D94C4C] text-[#D94C4C] text-xs font-mono">
            Rejection reason: {doc.rejection_reason}
          </div>
        )}

        {/* Candidate summary */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs font-mono">
          <span className="text-[#B45309]">⏳ {pendingCount} pending</span>
          <span className="text-[#16834A]">✓ {approvedCount} approved</span>
          <span className="text-[#D94C4C]">✗ {rejectedCount} rejected</span>
        </div>
      </div>

      {/* Warning: document still pending */}
      {docStatus === "PENDING_APPROVAL" && (
        <div className="p-3 bg-[#FFF8E6] border border-[#B45309] text-[#B45309] text-xs font-mono">
          ⚠ This document is PENDING APPROVAL. Facts approved from it will NOT be used as evidence
          until the document itself is approved.
        </div>
      )}

      {/* Candidates */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono font-bold text-sm text-[#17251C] uppercase">
            Extracted Candidates ({doc.document_candidates.length})
          </h2>
        </div>
        <div className="p-3 bg-[#F4F1E8] border border-[#17251C] text-xs font-mono text-[#637367]">
          Pattern-based extraction; a manager must review every candidate. Edit the metric name,
          value, unit, and expiry date before approving.
        </div>
        {doc.document_candidates.length === 0 ? (
          <div className="brutal-panel bg-white p-6 text-center text-sm font-mono text-[#637367]">
            No candidates were extracted. The document may not contain numeric facts.
          </div>
        ) : (
          <div className="space-y-3">
            {doc.document_candidates.map((c) => (
              <CandidateRow key={c.id} candidate={c} canEdit={canEdit} />
            ))}
          </div>
        )}
      </div>

      {/* Document-level approval */}
      {canEdit && docStatus === "PENDING_APPROVAL" && (
        <div className="brutal-panel bg-white p-5">
          <h3 className="font-mono font-bold text-sm text-[#17251C] uppercase mb-3">
            Approve or Reject Document
          </h3>
          <p className="text-xs font-mono text-[#637367] mb-4">
            Approving the document means its approved candidate facts will be eligible as evidence in
            audit runs. This action is logged with your name and timestamp.
          </p>
          {docAction === "REJECTED" && (
            <div className="mb-3">
              <label className="block text-xs font-mono font-bold text-[#17251C] mb-1">
                REJECTION REASON
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={2}
                placeholder="Explain why this document is rejected..."
                className="w-full px-3 py-2 border-2 border-[#17251C] text-xs font-mono focus:outline-none resize-none"
              />
            </div>
          )}
          {docError && (
            <div className="mb-3 text-xs font-mono text-[#D94C4C] flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {docError}
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              onClick={() => {
                setDocAction("APPROVED");
                setTimeout(handleDocumentAction, 0);
              }}
              disabled={isSubmittingDoc}
              className="bg-[#16834A] text-white hover:bg-[#17251C] font-mono text-xs font-bold brutal-border"
            >
              ✓ APPROVE DOCUMENT
            </Button>
            {docAction !== "REJECTED" ? (
              <Button
                type="button"
                onClick={() => setDocAction("REJECTED")}
                className="bg-[#D94C4C] text-white hover:bg-[#17251C] font-mono text-xs font-bold brutal-border"
              >
                ✗ REJECT DOCUMENT
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleDocumentAction}
                disabled={isSubmittingDoc}
                className="bg-[#D94C4C] text-white hover:bg-[#17251C] font-mono text-xs font-bold brutal-border"
              >
                {isSubmittingDoc ? "REJECTING…" : "CONFIRM REJECTION"}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
