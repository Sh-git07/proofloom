"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createAuditSubmission } from "@/app/actions/audit";
import { Button } from "@/components/ui/button";
import { StatusLED } from "@/components/ui/status-led";
import {
  Upload,
  FileText,
  Sparkles,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Image as ImageIcon,
  X,
} from "lucide-react";

interface SamplePreset {
  id: string;
  label: string;
  badge: string;
  badgeVariant: "critical" | "amber" | "lime" | "default";
  title: string;
  contentType: string;
  platform: string;
  department: string;
  body: string;
}

const PRESET_SAMPLES: SamplePreset[] = [
  {
    id: "scenario-a",
    label: "Scenario A: Overblown Claim",
    badge: "CONTRADICTED",
    badgeVariant: "critical",
    title: "Q3 Productivity Boost Campaign",
    contentType: "Social media post",
    platform: "LinkedIn",
    department: "Product Marketing",
    body: "Our platform increases productivity by 300%. Transform how your enterprise operates and unlock unmatched speed today.",
  },
  {
    id: "scenario-b",
    label: "Scenario B: Aggressive Tone & Hype",
    badge: "VOICE INFRACTION",
    badgeVariant: "amber",
    title: "Aggressive Growth Ad Copy",
    contentType: "Advertisement",
    platform: "LinkedIn",
    department: "Product Marketing",
    body: "Destroy your competition with our revolutionary platform. Crush inefficiency before your rivals do.",
  },
  {
    id: "scenario-c",
    label: "Scenario C: Outdated Benchmark",
    badge: "OUTDATED STAT",
    badgeVariant: "amber",
    title: "Customer Milestone Banner",
    contentType: "Website copy",
    platform: "Website",
    department: "Product Marketing",
    body: "Trusted by 8,000 businesses across the world to power their daily work management pipelines.",
  },
  {
    id: "scenario-d",
    label: "Scenario D: Fully Approved Post",
    badge: "VERIFIED & CLEAN",
    badgeVariant: "lime",
    title: "Q4 Verified Product Announcement",
    contentType: "Social media post",
    platform: "LinkedIn",
    department: "Product Marketing",
    body: "Our AI-powered productivity platform helps teams work smarter. In an internal pilot, teams saw an 18% improvement in task completion time. Results based on an internal pilot; individual results may vary.",
  },
];

const CONTENT_TYPES = [
  "Social media post",
  "Advertisement",
  "Blog article",
  "Website copy",
  "Email campaign",
  "Press release",
  "Product description",
  "Landing page",
  "Internal communication",
  "Other",
];

const PLATFORMS = [
  "LinkedIn",
  "Instagram",
  "Facebook",
  "X",
  "Website",
  "Email",
  "Blog",
  "Print",
  "Other",
];

const DEPARTMENTS = [
  "Product Marketing",
  "Demand Generation",
  "Corporate Communications",
  "Sales Enablement",
  "Legal & Compliance",
  "Executive Leadership",
];

export function ContentStudioForm({ isDemoMode = false }: { isDemoMode?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [title, setTitle] = React.useState("");
  const [contentType, setContentType] = React.useState("Social media post");
  const [platform, setPlatform] = React.useState("LinkedIn");
  const [department, setDepartment] = React.useState("Product Marketing");
  const [campaignContext, setCampaignContext] = React.useState("");
  const [objective, setObjective] = React.useState("");
  const [body, setBody] = React.useState("");
  const [auditMode, setAuditMode] = React.useState<"live_ai" | "demo">(isDemoMode ? "demo" : "live_ai");

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Image attachment state
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [imageAltText, setImageAltText] = React.useState("");
  const [imageInputError, setImageInputError] = React.useState<string | null>(null);
  const imageInputRef = React.useRef<HTMLInputElement | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const charCount = body.length;

  function loadSample(sample: SamplePreset) {
    setTitle(sample.title);
    setContentType(sample.contentType);
    setPlatform(sample.platform);
    setDepartment(sample.department);
    setBody(sample.body);
    setFormError(null);
  }

  React.useEffect(() => {
    const sampleParam = searchParams.get("sample");
    if (sampleParam) {
      const match =
        PRESET_SAMPLES.find((s) => s.id === sampleParam) ||
        (sampleParam === "true"
          ? PRESET_SAMPLES[3]
          : PRESET_SAMPLES.find((s) => s.id === "scenario-d"));
      if (match) {
        loadSample(match);
      }
    }
  }, [searchParams]);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setImageInputError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setImageInputError("Only PNG, JPG and WebP images are accepted.");
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageInputError(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`);
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    setImageAltText("");
    setImageInputError(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse document");
      }

      setBody(data.text);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error parsing file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Content title is required.");
      return;
    }
    if (!body.trim() || body.trim().length < 5) {
      setFormError("Content body must be at least 5 characters.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("contentType", contentType);
    formData.append("platform", platform);
    formData.append("department", department);
    formData.append("campaignContext", campaignContext);
    formData.append("objective", objective);
    formData.append("body", body);
    formData.append("mode", auditMode);
    if (imageFile) {
      formData.append("image", imageFile);
      formData.append("imageAltText", imageAltText);
    }

    try {
      const result = await createAuditSubmission(formData);
      if (result.success && result.auditId) {
        router.push(`/audits/${result.auditId}`);
      } else {
        setFormError(result.error || "Failed to initiate audit");
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to initiate audit");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Pre-filled Benchmark Samples Bar */}
      <div className="brutal-panel bg-white p-4 space-y-3">
        <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-2">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#16834A]" />
            <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
              LOAD VERIFICATION TEST CASES (SCENARIOS A &ndash; D)
            </h3>
          </div>
          <span className="font-mono text-[10px] text-[#637367]">
            Click to auto-populate form
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {PRESET_SAMPLES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => loadSample(sample)}
              className="text-left p-3 brutal-border bg-[#F4F1E8] hover:bg-[#DDEBDD] brutal-shadow-sm hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[9px] font-extrabold px-1.5 py-0.2 bg-[#17251C] text-white">
                  {sample.label.split(":")[0]}
                </span>
                <span
                  className={`font-mono text-[9px] font-extrabold px-1.5 py-0.2 brutal-border ${
                    sample.badgeVariant === "critical"
                      ? "bg-[#D94C4C] text-white"
                      : sample.badgeVariant === "lime"
                      ? "bg-[#B7F28B] text-[#17251C]"
                      : "bg-[#E6A23C] text-[#17251C]"
                  }`}
                >
                  {sample.badge}
                </span>
              </div>
              <p className="text-xs font-bold text-[#17251C] group-hover:text-[#16834A] truncate">
                {sample.title}
              </p>
              <p className="text-[11px] text-[#637367] mt-1 line-clamp-2 font-mono">
                &ldquo;{sample.body}&rdquo;
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Analysis Mode Selector */}
      <div className="brutal-panel bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase block">
            AUDIT ENGINE MODE
          </span>
          <span className="font-mono font-extrabold text-sm text-[#17251C]">
            {auditMode === "live_ai" ? "LIVE AI VERIFICATION" : "DEMO ANALYSIS MODE"}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setAuditMode("live_ai")}
            className={`px-3 py-1.5 text-xs font-mono font-bold brutal-border transition-all flex items-center space-x-1.5 ${
              auditMode === "live_ai"
                ? "bg-[#16834A] text-white brutal-shadow-sm"
                : "bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD]"
            }`}
          >
            <StatusLED status="live" size="sm" />
            <span>LIVE AI (GEMINI)</span>
          </button>

          <button
            type="button"
            onClick={() => setAuditMode("demo")}
            className={`px-3 py-1.5 text-xs font-mono font-bold brutal-border transition-all flex items-center space-x-1.5 ${
              auditMode === "demo"
                ? "bg-[#B7F28B] text-[#17251C] brutal-shadow-sm"
                : "bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD]"
            }`}
          >
            <StatusLED status="demo" size="sm" />
            <span>DEMO (RULE-BASED)</span>
          </button>
        </div>
      </div>

      {auditMode === "demo" && (
        <div className="p-3 bg-[#B7F28B] brutal-border flex items-start space-x-2 text-xs font-mono text-[#17251C]">
          <StatusLED status="demo" />
          <div>
            <span className="font-extrabold uppercase">
              DEMO ANALYSIS MODE &mdash; RULE-BASED, NOT AN LLM.
            </span>
            <p className="text-[11px] mt-0.5 text-[#17251C]/90">
              Evaluates deterministic rules, exact numerical thresholds, and published voice guidelines without sending data to external APIs.
            </p>
          </div>
        </div>
      )}

      {/* 3. Metadata Form Inputs */}
      <div className="brutal-panel bg-white p-5 space-y-4">
        <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C] border-b-2 border-[#253C2B] pb-2">
          SUBMISSION METADATA & CONTEXT
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block font-mono text-xs font-bold uppercase text-[#17251C] mb-1">
              Content Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Cloud Architecture Release Post"
              className="w-full px-3 py-2 bg-white brutal-border font-mono text-xs text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
            />
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase text-[#17251C] mb-1">
              Authoring Department *
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 bg-white brutal-border font-mono text-xs text-[#17251C] focus:outline-none"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase text-[#17251C] mb-1">
              Content Type *
            </label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="w-full px-3 py-2 bg-white brutal-border font-mono text-xs text-[#17251C] focus:outline-none"
            >
              {CONTENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase text-[#17251C] mb-1">
              Distribution Platform *
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 bg-white brutal-border font-mono text-xs text-[#17251C] focus:outline-none"
            >
              {PLATFORMS.map((plat) => (
                <option key={plat} value={plat}>
                  {plat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase text-[#17251C] mb-1">
              Campaign Context (Optional)
            </label>
            <input
              type="text"
              value={campaignContext}
              onChange={(e) => setCampaignContext(e.target.value)}
              placeholder="e.g. Enterprise pilot announcement"
              className="w-full px-3 py-2 bg-white brutal-border font-mono text-xs text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
            />
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase text-[#17251C] mb-1">
              Primary Objective (Optional)
            </label>
            <input
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Drive registration for enterprise summit"
              className="w-full px-3 py-2 bg-white brutal-border font-mono text-xs text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
            />
          </div>
        </div>
      </div>

      {/* 4. Text Editor & File Ingestion Module */}
      <div className="brutal-panel bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-[#253C2B] pb-3">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-[#16834A]" />
            <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
              CONTENT BODY FOR AUDIT *
            </h3>
          </div>

          {/* Document Upload Button */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="brutal-btn brutal-btn-secondary px-3 py-1.5 text-xs flex items-center space-x-1.5"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>EXTRACTING DOCUMENT...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 text-[#16834A]" />
                  <span>UPLOAD FILE (PDF, DOCX, TXT)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {uploadError && (
          <div className="p-2.5 bg-[#F4F1E8] border-2 border-[#D94C4C] text-[#D94C4C] text-xs font-mono flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        <textarea
          required
          rows={7}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste or draft marketing copy, website statements, press releases, or social captions here..."
          className="w-full p-3 bg-[#F4F1E8] brutal-border font-mono text-xs text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A] leading-relaxed resize-y"
        />

        <div className="flex items-center justify-between font-mono text-[11px] text-[#637367]">
          <span>
            {wordCount} words &bull; {charCount} characters
          </span>
          <span className="uppercase">
            Original submission is permanently preserved as Version 1
          </span>
        </div>
      </div>

      {formError && (
        <div className="p-3 bg-[#F4F1E8] border-2 border-[#D94C4C] text-[#D94C4C] text-xs font-mono flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* 5. Image Attachment (Optional — triggers Visual Consistency stage) */}
      <div className="brutal-panel bg-white p-5 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-3">
          <div className="flex items-center space-x-2">
            <ImageIcon className="w-4 h-4 text-[#16834A]" />
            <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
              IMAGE ATTACHMENT (Optional)
            </h3>
          </div>
          <span className="font-mono text-[10px] text-[#637367]">PNG · JPG · WebP · max 5 MB</span>
        </div>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleImageSelect}
          className="hidden"
        />

        {!imageFile ? (
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="w-full border-2 border-dashed border-[#253C2B]/30 hover:border-[#16834A] bg-[#F4F1E8] hover:bg-[#DDEBDD] p-6 text-center transition-colors cursor-pointer"
          >
            <ImageIcon className="w-6 h-6 text-[#637367] mx-auto mb-2" />
            <p className="font-mono text-xs text-[#637367]">
              Click to attach an image — adds <strong>VISUAL CONSISTENCY</strong> stage to the audit
            </p>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start space-x-3 p-3 bg-[#F4F1E8] brutal-border">
              {imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-20 h-20 object-cover brutal-border shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs font-bold text-[#17251C] truncate">{imageFile.name}</p>
                <p className="font-mono text-[10px] text-[#637367]">
                  {(imageFile.size / 1024).toFixed(0)} KB · {imageFile.type}
                </p>
              </div>
              <button
                type="button"
                onClick={removeImage}
                className="text-[#D94C4C] hover:text-[#A33]"
                title="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block font-mono text-xs font-bold uppercase text-[#17251C] mb-1">
                Alt Text <span className="text-[#D94C4C]">*</span>
              </label>
              <input
                type="text"
                value={imageAltText}
                onChange={(e) => setImageAltText(e.target.value)}
                placeholder="Describe the image for screen readers and accessibility compliance"
                className="w-full px-3 py-2 bg-white brutal-border font-mono text-xs text-[#17251C] focus:outline-none focus:ring-2 focus:ring-[#16834A]"
              />
            </div>
          </div>
        )}

        {imageInputError && (
          <div className="p-2 bg-[#F4F1E8] border-2 border-[#D94C4C] text-[#D94C4C] text-xs font-mono flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{imageInputError}</span>
          </div>
        )}

        <p className="font-mono text-[10px] text-[#637367]">
          Attaching an image adds the <strong>VISUAL CONSISTENCY</strong> stage: logo verification (dHash),
          colour palette compliance (ΔE), resolution and aspect-ratio checks.
          AI is not used for this stage.
        </p>
      </div>

      {/* 5. Submit CTA Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <p className="font-mono text-[10px] text-[#637367] uppercase">
          Tagline: Where every brand claim has a thread of proof.
        </p>

        <Button
          type="submit"
          data-tour="tour-run-audit"
          disabled={isSubmitting}
          variant="lime"
          size="lg"
          className="w-full sm:w-auto px-8 py-3.5 text-sm flex items-center justify-center space-x-2"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-[#17251C]" />
              <span>INITIALIZING AUDIT SEQUENCE...</span>
            </>
          ) : (
            <>
              <span>RUN BRAND AUDIT</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
