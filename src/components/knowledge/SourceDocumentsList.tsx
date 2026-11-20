"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { uploadSourceDocumentAction } from "@/app/actions/documents";
import Link from "next/link";

export interface SourceDocument {
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
  approved_at: string | null;
  rejected_at: string | null;
}

function StatusBadge({ status }: { status: SourceDocument["status"] }) {
  if (status === "APPROVED")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#DDEBDD] text-[#16834A] text-[10px] font-mono font-bold border border-[#16834A]">
        <CheckCircle2 className="w-3 h-3" /> APPROVED
      </span>
    );
  if (status === "REJECTED")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FDECEA] text-[#D94C4C] text-[10px] font-mono font-bold border border-[#D94C4C]">
        <XCircle className="w-3 h-3" /> REJECTED
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FFF8E6] text-[#B45309] text-[10px] font-mono font-bold border border-[#B45309]">
      <Clock className="w-3 h-3" /> PENDING APPROVAL
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeLabel(mime: string): string {
  if (mime.includes("pdf")) return "PDF";
  if (mime.includes("wordprocessingml")) return "DOCX";
  return "TXT";
}

export function SourceDocumentsList({
  documents,
  canEdit,
}: {
  documents: SourceDocument[];
  canEdit: boolean;
}) {
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      const result = await uploadSourceDocumentAction(fd);
      if (result.success) {
        setSuccess("Document uploaded. Candidates extracted — open it to review.");
        setUploadOpen(false);
        formRef.current?.reset();
      } else {
        setError(result.error || "Upload failed.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="brutal-panel bg-white p-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono text-xs text-[#637367] font-bold uppercase tracking-widest">
            07 SOURCE DOCUMENTS
          </div>
          <h2 className="font-mono font-extrabold text-lg text-[#17251C] mt-0.5">
            Approved Evidence Documents
          </h2>
          <p className="text-xs text-[#637367] mt-1 max-w-xl">
            Upload PDF, DOCX, or TXT files (max 10 MB). The system extracts candidate facts using
            pattern matching — a manager must review every candidate before it becomes evidence.
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => setUploadOpen((o) => !o)}
            className="bg-[#17251C] text-white hover:bg-[#16834A] font-mono text-xs font-bold flex items-center gap-2 brutal-border brutal-shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            UPLOAD DOCUMENT
          </Button>
        )}
      </div>

      {/* Upload Form */}
      {uploadOpen && canEdit && (
        <div className="brutal-panel bg-[#F4F1E8] p-4 border-2 border-[#17251C]">
          <h3 className="font-mono font-bold text-sm text-[#17251C] mb-3 uppercase">
            Upload New Document
          </h3>
          <form ref={formRef} onSubmit={handleUpload} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono font-bold text-[#17251C] mb-1">
                  DOCUMENT NAME *
                </label>
                <input
                  name="name"
                  required
                  placeholder="e.g. Pilot Program Report"
                  className="w-full px-3 py-2 border-2 border-[#17251C] bg-white text-sm font-mono focus:outline-none focus:border-[#16834A]"
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-bold text-[#17251C] mb-1">
                  VERSION
                </label>
                <input
                  name="version"
                  defaultValue="1.0"
                  placeholder="1.0"
                  className="w-full px-3 py-2 border-2 border-[#17251C] bg-white text-sm font-mono focus:outline-none focus:border-[#16834A]"
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-bold text-[#17251C] mb-1">
                  CATEGORY
                </label>
                <input
                  name="category"
                  placeholder="General"
                  className="w-full px-3 py-2 border-2 border-[#17251C] bg-white text-sm font-mono focus:outline-none focus:border-[#16834A]"
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-bold text-[#17251C] mb-1">
                  OWNER
                </label>
                <input
                  name="owner"
                  placeholder="e.g. Marketing Team"
                  className="w-full px-3 py-2 border-2 border-[#17251C] bg-white text-sm font-mono focus:outline-none focus:border-[#16834A]"
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-bold text-[#17251C] mb-1">
                  EXPIRY DATE
                </label>
                <input
                  name="expiry_date"
                  type="date"
                  className="w-full px-3 py-2 border-2 border-[#17251C] bg-white text-sm font-mono focus:outline-none focus:border-[#16834A]"
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-bold text-[#17251C] mb-1">
                  LAST VERIFIED DATE
                </label>
                <input
                  name="last_verified_date"
                  type="date"
                  className="w-full px-3 py-2 border-2 border-[#17251C] bg-white text-sm font-mono focus:outline-none focus:border-[#16834A]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono font-bold text-[#17251C] mb-1">
                FILE * (PDF, DOCX, TXT — max 10 MB)
              </label>
              <input
                name="file"
                type="file"
                required
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="w-full px-3 py-2 border-2 border-[#17251C] bg-white text-sm font-mono focus:outline-none"
              />
            </div>
            {error && (
              <div className="p-2 bg-[#FDECEA] border border-[#D94C4C] text-[#D94C4C] text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[#16834A] text-white hover:bg-[#17251C] font-mono text-xs font-bold brutal-border"
              >
                {isSubmitting ? "UPLOADING…" : "UPLOAD & EXTRACT"}
              </Button>
              <Button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="bg-white text-[#17251C] hover:bg-[#DDEBDD] font-mono text-xs font-bold brutal-border"
              >
                CANCEL
              </Button>
            </div>
          </form>
        </div>
      )}

      {success && (
        <div className="p-3 bg-[#DDEBDD] border-2 border-[#16834A] text-[#16834A] text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {/* Notice */}
      <div className="p-3 bg-[#FFF8E6] border border-[#B45309] text-[#B45309] text-xs font-mono">
        ⚠ Pattern-based extraction; a manager must review every candidate. Only approved facts from
        APPROVED, unexpired documents count as evidence.
      </div>

      {/* Document List */}
      {documents.length === 0 ? (
        <div className="brutal-panel bg-white p-8 text-center">
          <FileText className="w-8 h-8 text-[#637367] mx-auto mb-2" />
          <p className="text-sm font-mono text-[#637367]">No source documents uploaded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="brutal-panel bg-white p-4 flex items-start justify-between gap-4 flex-wrap"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <FileText className="w-5 h-5 text-[#637367] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm text-[#17251C]">{doc.name}</span>
                    <span className="text-xs text-[#637367] font-mono">v{doc.version}</span>
                    <span className="text-[10px] text-[#637367] font-mono px-1 border border-[#DDEBDD] bg-[#F4F1E8]">
                      {mimeLabel(doc.mime_type)}
                    </span>
                    <StatusBadge status={doc.status} />
                  </div>
                  <div className="text-xs text-[#637367] font-mono mt-1 flex flex-wrap gap-3">
                    <span>Category: {doc.category}</span>
                    {doc.owner && <span>Owner: {doc.owner}</span>}
                    <span>Size: {formatBytes(doc.file_size_bytes)}</span>
                    {doc.page_count && <span>Pages: {doc.page_count}</span>}
                    {doc.expiry_date && (
                      <span>
                        Expires:{" "}
                        {new Date(doc.expiry_date) < new Date() ? (
                          <span className="text-[#D94C4C]">
                            EXPIRED ({new Date(doc.expiry_date).toLocaleDateString()})
                          </span>
                        ) : (
                          new Date(doc.expiry_date).toLocaleDateString()
                        )}
                      </span>
                    )}
                    <span>Uploaded: {new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <Link href={`/knowledge/documents/${doc.id}/review`}>
                <Button className="bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD] font-mono text-xs font-bold brutal-border flex items-center gap-1 shrink-0">
                  REVIEW <ExternalLink className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
