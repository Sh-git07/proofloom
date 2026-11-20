"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  createApprovedFactAction,
  updateApprovedFactAction,
  archiveApprovedFactAction,
  createTerminologyRuleAction,
  updateTerminologyRuleAction,
  deleteTerminologyRuleAction,
  createGuidelineAction,
  updateGuidelineAction,
  versionGuidelineAction,
  archiveGuidelineAction,
  createApprovedAssetAction,
  updateApprovedAssetAction,
  deleteApprovedAssetAction,
  createApprovedExampleAction,
  updateApprovedExampleAction,
  deleteApprovedExampleAction,
  createBrandDisclaimerAction,
  updateBrandDisclaimerAction,
  deleteBrandDisclaimerAction,
} from "@/app/actions/knowledge";
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Plus,
  FileCheck,
  Shield,
  Layers,
  Sparkles,
  Edit2,
  Archive,
  Trash2,
  GitBranch,
  ExternalLink,
  Clock,
  Check,
  FileText,
} from "lucide-react";

export interface FactItem {
  id: string;
  name: string;
  value: string;
  numeric_value: number | null;
  unit: string | null;
  approval_status: string;
  expires_at: string | null;
  verified_at: string | null;
  source_citation?: string | null;
  owner?: string | null;
  source_version?: string | null;
}

export interface TermItem {
  id: string;
  disallowed_term: string;
  approved_term: string;
  category?: string;
  severity?: string;
  reason?: string | null;
  context?: string | null;
}

export interface GuidelineItem {
  id: string;
  title: string;
  category: string;
  body?: string | null;
  status: string;
  version?: string | null;
  published_at?: string | null;
  rules?: string[] | any;
  tone_attributes?: string[] | any;
}

export interface AssetItem {
  id: string;
  name: string;
  asset_type: string;
  storage_path?: string | null;
  file_size_bytes?: number | null;
  metadata?: any;
}

export interface ExampleItem {
  id: string;
  title: string;
  category: string;
  content: string;
  why_it_works: string;
}

export interface DisclaimerItem {
  id: string;
  title: string;
  trigger: string;
  disclaimer_text: string;
  is_mandatory?: boolean;
}

export function KnowledgeVaultTabs({
  facts,
  terms,
  guidelines,
  assets,
  examples,
  disclaimers,
  userRole,
}: {
  facts: FactItem[];
  terms: TermItem[];
  guidelines: GuidelineItem[];
  assets: AssetItem[];
  examples: ExampleItem[];
  disclaimers: DisclaimerItem[];
  userRole: string;
}) {
  const [activeTab, setActiveTab] = React.useState<
    "facts" | "terms" | "guidelines" | "assets" | "examples" | "disclaimers"
  >("facts");

  // Modals state
  const [addFactModalOpen, setAddFactModalOpen] = React.useState(false);
  const [editFactItem, setEditFactItem] = React.useState<FactItem | null>(null);

  const [addTermModalOpen, setAddTermModalOpen] = React.useState(false);
  const [editTermItem, setEditTermItem] = React.useState<TermItem | null>(null);

  const [addGuidelineModalOpen, setAddGuidelineModalOpen] = React.useState(false);
  const [editGuidelineItem, setEditGuidelineItem] = React.useState<GuidelineItem | null>(null);
  const [versionGuidelineItem, setVersionGuidelineItem] = React.useState<GuidelineItem | null>(null);

  const [addAssetModalOpen, setAddAssetModalOpen] = React.useState(false);
  const [editAssetItem, setEditAssetItem] = React.useState<AssetItem | null>(null);

  const [addExampleModalOpen, setAddExampleModalOpen] = React.useState(false);
  const [editExampleItem, setEditExampleItem] = React.useState<ExampleItem | null>(null);

  const [addDisclaimerModalOpen, setAddDisclaimerModalOpen] = React.useState(false);
  const [editDisclaimerItem, setEditDisclaimerItem] = React.useState<DisclaimerItem | null>(null);

  const [actionError, setActionError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const canEdit = userRole === "admin" || userRole === "brand_manager";
  const now = new Date();

  return (
    <div className="space-y-6">
      {/* 1. Tab Navigation Strip */}
      <div className="brutal-panel bg-white p-2 flex flex-wrap gap-1.5 font-mono text-xs">
        {[
          { key: "facts", label: "01 APPROVED FACTS", icon: CheckCircle2, count: facts.length },
          { key: "terms", label: "02 TERMINOLOGY", icon: Shield, count: terms.length },
          { key: "guidelines", label: "03 BRAND GUIDELINES", icon: BookOpen, count: guidelines.length },
          { key: "assets", label: "04 APPROVED ASSETS", icon: Layers, count: assets.length },
          { key: "examples", label: "05 APPROVED EXAMPLES", icon: Sparkles, count: examples.length },
          { key: "disclaimers", label: "06 DISCLAIMERS & POLICIES", icon: FileCheck, count: disclaimers.length },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-3 py-2 brutal-border font-bold uppercase transition-all flex items-center space-x-2 cursor-pointer ${
                isActive
                  ? "bg-[#16834A] text-white brutal-shadow-sm translate-x-[-1px] translate-y-[-1px]"
                  : "bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1 rounded-[1px] font-bold ${
                  isActive ? "bg-white text-[#16834A]" : "bg-white text-[#637367]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Source Documents shortcut — additive, separate page */}
      <div className="brutal-panel bg-[#F4F1E8] p-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-mono text-[#637367]">
          <FileText className="w-3.5 h-3.5" />
          <span>07 SOURCE DOCUMENTS — Upload evidence PDFs, DOCXs, TXTs and review extracted facts</span>
        </div>
        <Link href="/knowledge/documents">
          <button
            type="button"
            className="px-3 py-2 brutal-border font-mono font-bold text-xs uppercase bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD] flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            OPEN →
          </button>
        </Link>
      </div>

      {actionError && (
        <div className="p-3 bg-[#F4F1E8] border-2 border-[#D94C4C] text-[#D94C4C] text-xs font-mono flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* 2. TAB CONTENT: FACTS */}
      {activeTab === "facts" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
                AUTHORITATIVE BENCHMARKS & EMPIRICAL METRICS ({facts.length})
              </h3>
              <p className="text-[11px] text-[#637367] font-mono mt-0.5">
                Only approved, active, unexpired facts are used as authoritative evidence in verification audits.
              </p>
            </div>
            {canEdit && (
              <Button
                variant="lime"
                size="sm"
                onClick={() => setAddFactModalOpen(true)}
                className="flex items-center space-x-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>REGISTER APPROVED FACT</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {facts.map((fact) => {
              const expiresDate = fact.expires_at ? new Date(fact.expires_at) : null;
              const isExpired = fact.approval_status === "EXPIRED" || (expiresDate && expiresDate < now);
              const daysRemaining = expiresDate
                ? Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                : 999;
              const isExpiringSoon = !isExpired && daysRemaining <= 20 && daysRemaining > 0;
              const isPending =
                fact.approval_status === "PENDING" || fact.approval_status === "PENDING_APPROVAL";
              const isRejected = fact.approval_status === "REJECTED";
              const isArchived = fact.approval_status === "ARCHIVED";

              let statusBadge = (
                <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-[#B7F28B] text-[#17251C] brutal-border">
                  APPROVED & ACTIVE
                </span>
              );

              if (isRejected) {
                statusBadge = (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-[#D94C4C] text-white brutal-border">
                    REJECTED (NOT AUTHORITATIVE)
                  </span>
                );
              } else if (isPending) {
                statusBadge = (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-[#E6A23C] text-[#17251C] brutal-border">
                    PENDING APPROVAL
                  </span>
                );
              } else if (isArchived) {
                statusBadge = (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-[#F4F1E8] text-[#637367] brutal-border">
                    ARCHIVED
                  </span>
                );
              } else if (isExpired) {
                statusBadge = (
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-[#D94C4C] text-white brutal-border">
                    EXPIRED
                  </span>
                );
              }

              return (
                <div key={fact.id} className="brutal-panel bg-white p-4 space-y-2.5 font-mono text-xs flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between border-b border-[#253C2B]/15 pb-2">
                      <div className="pr-2">
                        <span className="font-bold text-[#17251C] text-sm block">
                          {fact.name}
                        </span>
                        <span className="text-[10px] text-[#637367]">
                          Verified by {fact.owner || "Brand Governance"}
                        </span>
                      </div>

                      <div className="flex flex-col items-end space-y-1 shrink-0">
                        {statusBadge}
                        {isExpiringSoon && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-[#E6A23C] text-[#17251C] brutal-border flex items-center space-x-1">
                            <Clock className="w-2.5 h-2.5" />
                            <span>EXPIRES IN {daysRemaining}D</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-2.5 bg-[#F4F1E8] brutal-border">
                      <span className="text-[10px] text-[#637367] block uppercase font-bold">
                        APPROVED TEXT / VALUE:
                      </span>
                      <p className="font-extrabold text-sm text-[#17251C] mt-0.5">
                        {fact.value}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-[#637367]">
                      <div>
                        <span className="block uppercase text-[9px] font-bold">Numeric Benchmark:</span>
                        <span className="font-bold text-[#17251C]">
                          {fact.numeric_value !== null ? `${fact.numeric_value} ${fact.unit || ""}` : "Categorical"}
                        </span>
                      </div>
                      <div>
                        <span className="block uppercase text-[9px] font-bold">Expiry Date:</span>
                        <span className={`font-bold ${isExpired ? "text-[#D94C4C]" : isExpiringSoon ? "text-[#E6A23C]" : "text-[#17251C]"}`}>
                          {expiresDate ? expiresDate.toLocaleDateString() : "Indefinite"}
                        </span>
                      </div>
                    </div>

                    {fact.source_citation && (
                      <div className="text-[10px] text-[#16834A] pt-1 font-bold">
                        &bull; Citation: {fact.source_citation}
                      </div>
                    )}
                  </div>

                  {canEdit && (
                    <div className="pt-2 border-t border-[#253C2B]/10 flex items-center justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setEditFactItem(fact)}
                        className="brutal-btn brutal-btn-secondary px-2.5 py-1 text-[11px] flex items-center space-x-1"
                      >
                        <Edit2 className="w-3 h-3 text-[#16834A]" />
                        <span>EDIT</span>
                      </button>
                      {!isArchived && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`Archive fact "${fact.name}"?`)) {
                              await archiveApprovedFactAction(fact.id);
                            }
                          }}
                          className="brutal-btn brutal-btn-secondary px-2.5 py-1 text-[11px] flex items-center space-x-1 text-[#637367] hover:text-[#D94C4C]"
                        >
                          <Archive className="w-3 h-3" />
                          <span>ARCHIVE</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. TAB CONTENT: TERMINOLOGY */}
      {activeTab === "terms" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
                CORPORATE TERMINOLOGY STANDARDS ({terms.length})
              </h3>
              <p className="text-[11px] text-[#637367] font-mono mt-0.5">
                Every term check is deterministic and enforced across all content audit stages.
              </p>
            </div>
            {canEdit && (
              <Button
                variant="lime"
                size="sm"
                onClick={() => setAddTermModalOpen(true)}
                className="flex items-center space-x-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>NEW TERMINOLOGY RULE</span>
              </Button>
            )}
          </div>

          <div className="brutal-panel bg-white p-4 space-y-3">
            <div className="grid grid-cols-1 divide-y-2 divide-[#253C2B]/15">
              {terms.map((term) => {
                const severity = term.severity || "MEDIUM";
                const sevColor =
                  severity === "CRITICAL"
                    ? "bg-[#D94C4C] text-white"
                    : severity === "HIGH"
                    ? "bg-[#E6A23C] text-[#17251C]"
                    : severity === "LOW"
                    ? "bg-[#F4F1E8] text-[#637367]"
                    : "bg-[#B7F28B] text-[#17251C]";

                return (
                  <div
                    key={term.id}
                    className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-extrabold text-[#D94C4C] line-through bg-[#D94C4C]/10 px-2 py-0.5 brutal-border">
                          {term.disallowed_term}
                        </span>
                        <span className="font-bold text-[#17251C]">&rarr;</span>
                        <span className="font-extrabold text-[#16834A] bg-[#DDEBDD] px-2 py-0.5 brutal-border">
                          {term.approved_term}
                        </span>
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.2 brutal-border ${sevColor}`}>
                          {severity}
                        </span>
                        <span className="text-[10px] font-bold text-[#637367] uppercase bg-[#F4F1E8] px-1.5 py-0.2 brutal-border">
                          {term.category || "brand_standard"}
                        </span>
                      </div>
                      {(term.reason || term.context) && (
                        <p className="text-[11px] text-[#637367] leading-relaxed">
                          Rationale: {term.reason || term.context}
                        </p>
                      )}
                    </div>

                    {canEdit && (
                      <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => setEditTermItem(term)}
                          className="brutal-btn brutal-btn-secondary px-2 py-1 text-[10px] flex items-center space-x-1"
                        >
                          <Edit2 className="w-2.5 h-2.5 text-[#16834A]" />
                          <span>EDIT</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`Delete rule for "${term.disallowed_term}"?`)) {
                              await deleteTerminologyRuleAction(term.id);
                            }
                          }}
                          className="brutal-btn brutal-btn-secondary px-2 py-1 text-[10px] text-[#D94C4C]"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB CONTENT: GUIDELINES */}
      {activeTab === "guidelines" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
                PUBLISHED BRAND GUIDELINES ({guidelines.length})
              </h3>
              <p className="text-[11px] text-[#637367] font-mono mt-0.5">
                Versioned policies covering voice, messaging principles, audience rules, and accessibility.
              </p>
            </div>
            {canEdit && (
              <Button
                variant="lime"
                size="sm"
                onClick={() => setAddGuidelineModalOpen(true)}
                className="flex items-center space-x-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>PUBLISH GUIDELINE</span>
              </Button>
            )}
          </div>

          <div className="space-y-3 font-mono">
            {guidelines.map((g) => {
              const statusLower = (g.status || "published").toLowerCase();
              const isArchived = statusLower === "archived";
              const isDraft = statusLower === "draft";
              const badgeStyle = isArchived
                ? "bg-[#F4F1E8] text-[#637367]"
                : isDraft
                ? "bg-[#E6A23C] text-[#17251C]"
                : "bg-[#B7F28B] text-[#17251C]";

              return (
                <div key={g.id} className="brutal-panel bg-white p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#253C2B]/15 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-sm text-[#17251C]">{g.title}</h4>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-[#F4F1E8] brutal-border text-[#17251C]">
                        v{g.version || "1.0"}
                      </span>
                      <span className="text-[10px] font-bold text-[#637367] uppercase">
                        [{g.category}]
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 brutal-border uppercase ${badgeStyle}`}>
                        {g.status}
                      </span>
                    </div>
                  </div>

                  {g.body && (
                    <p className="text-xs text-[#17251C] whitespace-pre-wrap leading-relaxed">
                      {g.body}
                    </p>
                  )}

                  {Array.isArray(g.rules) && g.rules.length > 0 && (
                    <div className="p-3 bg-[#F4F1E8] brutal-border space-y-1.5 text-xs">
                      <span className="text-[10px] font-bold text-[#637367] uppercase block">
                        ENFORCED RULES:
                      </span>
                      <ul className="list-disc pl-4 space-y-0.5 text-[#17251C]">
                        {g.rules.map((r: string, idx: number) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {canEdit && (
                    <div className="pt-2 border-t border-[#253C2B]/10 flex items-center justify-end space-x-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setEditGuidelineItem(g)}
                        className="brutal-btn brutal-btn-secondary px-2.5 py-1 text-[11px] flex items-center space-x-1"
                      >
                        <Edit2 className="w-3 h-3 text-[#16834A]" />
                        <span>EDIT</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setVersionGuidelineItem(g)}
                        className="brutal-btn brutal-btn-secondary px-2.5 py-1 text-[11px] flex items-center space-x-1 text-[#16834A]"
                      >
                        <GitBranch className="w-3 h-3" />
                        <span>NEW VERSION</span>
                      </button>
                      {!isArchived && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`Archive guideline "${g.title}"?`)) {
                              await archiveGuidelineAction(g.id);
                            }
                          }}
                          className="brutal-btn brutal-btn-secondary px-2.5 py-1 text-[11px] flex items-center space-x-1 text-[#637367]"
                        >
                          <Archive className="w-3 h-3" />
                          <span>ARCHIVE</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. TAB CONTENT: ASSETS */}
      {activeTab === "assets" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
                APPROVED BRAND ASSETS & SPECIFICATIONS ({assets.length})
              </h3>
              <p className="text-[11px] text-[#637367] font-mono mt-0.5">
                Canonical vector emblems, palette definitions, and social post templates stored in private storage.
              </p>
            </div>
            {canEdit && (
              <Button
                variant="lime"
                size="sm"
                onClick={() => setAddAssetModalOpen(true)}
                className="flex items-center space-x-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>REGISTER ASSET</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
            {assets.map((asset) => (
              <div key={asset.id} className="brutal-panel bg-white p-4 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between border-b border-[#253C2B]/15 pb-2">
                    <div>
                      <span className="font-bold text-[#17251C] text-sm block">{asset.name}</span>
                      <span className="text-[10px] text-[#637367] uppercase">TYPE: {asset.asset_type}</span>
                    </div>
                    <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-[#B7F28B] text-[#17251C] brutal-border">
                      VERIFIED
                    </span>
                  </div>

                  <div className="mt-2.5 p-4 bg-[#F4F1E8] brutal-border flex items-center justify-center min-h-[90px] text-center">
                    {asset.asset_type === "logo" ? (
                      <div className="p-3 bg-[#16834A] text-[#B7F28B] font-extrabold text-lg brutal-border">
                        PROOFLOOM &bull; PL
                      </div>
                    ) : asset.asset_type === "color_palette" ? (
                      <div className="flex space-x-1">
                        <div className="w-6 h-6 bg-[#16834A] brutal-border" title="#16834A" />
                        <div className="w-6 h-6 bg-[#B7F28B] brutal-border" title="#B7F28B" />
                        <div className="w-6 h-6 bg-[#17251C] brutal-border" title="#17251C" />
                        <div className="w-6 h-6 bg-[#F4F1E8] brutal-border" title="#F4F1E8" />
                        <div className="w-6 h-6 bg-[#253C2B] brutal-border" title="#253C2B" />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Layers className="w-6 h-6 text-[#16834A] mx-auto" />
                        <span className="text-[10px] text-[#637367] font-bold block">
                          {asset.storage_path ? asset.storage_path.split("/").pop() : "Asset Vector Package"}
                        </span>
                      </div>
                    )}
                  </div>

                  {asset.metadata?.description && (
                    <p className="text-[11px] text-[#637367] mt-2">
                      {asset.metadata.description}
                    </p>
                  )}
                  {asset.storage_path && (
                    <span className="text-[10px] text-[#16834A] block mt-1 break-all">
                      Path: {asset.storage_path}
                    </span>
                  )}
                </div>

                {canEdit && (
                  <div className="pt-2 border-t border-[#253C2B]/10 flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setEditAssetItem(asset)}
                      className="brutal-btn brutal-btn-secondary px-2 py-1 text-[10px] flex items-center space-x-1"
                    >
                      <Edit2 className="w-2.5 h-2.5 text-[#16834A]" />
                      <span>EDIT</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Delete asset "${asset.name}"?`)) {
                          await deleteApprovedAssetAction(asset.id);
                        }
                      }}
                      className="brutal-btn brutal-btn-secondary px-2 py-1 text-[10px] text-[#D94C4C]"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. TAB CONTENT: EXAMPLES */}
      {activeTab === "examples" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
                GOLD-STANDARD APPROVED COPY EXAMPLES ({examples.length})
              </h3>
              <p className="text-[11px] text-[#637367] font-mono mt-0.5">
                Exemplary approved content snippets demonstrating voice, disclaimer placement, and customer-first framing.
              </p>
            </div>
            {canEdit && (
              <Button
                variant="lime"
                size="sm"
                onClick={() => setAddExampleModalOpen(true)}
                className="flex items-center space-x-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ADD APPROVED EXAMPLE</span>
              </Button>
            )}
          </div>

          <div className="space-y-3 font-mono text-xs">
            {examples.map((ex) => (
              <div key={ex.id} className="brutal-panel bg-white p-4 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#253C2B]/15 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-extrabold text-[#16834A] uppercase bg-[#DDEBDD] px-2 py-0.5 brutal-border">
                      {ex.category}
                    </span>
                    <span className="font-bold text-sm text-[#17251C]">{ex.title}</span>
                  </div>

                  {canEdit && (
                    <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setEditExampleItem(ex)}
                        className="brutal-btn brutal-btn-secondary px-2 py-1 text-[10px] flex items-center space-x-1"
                      >
                        <Edit2 className="w-2.5 h-2.5 text-[#16834A]" />
                        <span>EDIT</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Delete example "${ex.title}"?`)) {
                            await deleteApprovedExampleAction(ex.id);
                          }
                        }}
                        className="brutal-btn brutal-btn-secondary px-2 py-1 text-[10px] text-[#D94C4C]"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="font-bold text-[#17251C] bg-[#F4F1E8] p-3 brutal-border whitespace-pre-wrap leading-relaxed">
                  &ldquo;{ex.content}&rdquo;
                </p>

                <div className="flex items-start space-x-2 pt-1 text-[11px] text-[#637367]">
                  <Check className="w-3.5 h-3.5 text-[#16834A] shrink-0 mt-0.5" />
                  <p>
                    <span className="font-bold text-[#17251C]">Why this works: </span>
                    {ex.why_it_works}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. TAB CONTENT: DISCLAIMERS */}
      {activeTab === "disclaimers" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
                MANDATORY LEGAL DISCLAIMERS & POLICIES ({disclaimers.length})
              </h3>
              <p className="text-[11px] text-[#637367] font-mono mt-0.5">
                Statutory disclaimers, forward-looking statements, and AI disclosures automatically checked during audits.
              </p>
            </div>
            {canEdit && (
              <Button
                variant="lime"
                size="sm"
                onClick={() => setAddDisclaimerModalOpen(true)}
                className="flex items-center space-x-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>ADD LEGAL DISCLAIMER</span>
              </Button>
            )}
          </div>

          <div className="space-y-3 font-mono text-xs">
            {disclaimers.map((d) => (
              <div key={d.id} className="brutal-panel bg-white p-4 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#253C2B]/15 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-[#17251C]">{d.title}</span>
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.2 brutal-border ${
                        d.is_mandatory !== false
                          ? "bg-[#D94C4C] text-white"
                          : "bg-[#F4F1E8] text-[#637367]"
                      }`}
                    >
                      {d.is_mandatory !== false ? "MANDATORY REQUIREMENT" : "ADVISORY"}
                    </span>
                  </div>

                  {canEdit && (
                    <div className="flex items-center space-x-1.5 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setEditDisclaimerItem(d)}
                        className="brutal-btn brutal-btn-secondary px-2 py-1 text-[10px] flex items-center space-x-1"
                      >
                        <Edit2 className="w-2.5 h-2.5 text-[#16834A]" />
                        <span>EDIT</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Delete disclaimer "${d.title}"?`)) {
                            await deleteBrandDisclaimerAction(d.id);
                          }
                        }}
                        className="brutal-btn brutal-btn-secondary px-2 py-1 text-[10px] text-[#D94C4C]"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="font-extrabold text-[#16834A] bg-[#DDEBDD] p-3 brutal-border whitespace-pre-wrap leading-relaxed">
                  &ldquo;{d.disclaimer_text}&rdquo;
                </p>

                <p className="text-[11px] text-[#637367]">
                  <span className="font-bold text-[#17251C]">Trigger Condition: </span>
                  {d.trigger}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          MODALS: REGISTER & EDIT FACTS
         ======================================================== */}
      <Dialog open={addFactModalOpen} onOpenChange={setAddFactModalOpen}>
        <DialogHeader>
          <DialogTitle>Register Authoritative Fact</DialogTitle>
          <DialogDescription>
            Add an approved empirical benchmark into the Brand Knowledge Vault.
          </DialogDescription>
        </DialogHeader>

        <form
          action={async (fd) => {
            try {
              setIsSubmitting(true);
              setActionError(null);
              await createApprovedFactAction(fd);
              setAddFactModalOpen(false);
            } catch (err: unknown) {
              setActionError(err instanceof Error ? err.message : "Error saving fact");
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="space-y-3 font-mono text-xs"
        >
          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Fact Name *</label>
            <input
              name="name"
              required
              placeholder="e.g. Enterprise Customer Metric Q1 2026"
              className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Approved Value / Phrasing *</label>
            <input
              name="value"
              required
              placeholder="e.g. 12,400 verified enterprise teams"
              className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Numeric Value (Optional)</label>
              <input
                name="numericValue"
                type="number"
                step="any"
                placeholder="e.g. 12400"
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Unit (Optional)</label>
              <input
                name="unit"
                placeholder="e.g. % or businesses"
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Status</label>
              <select
                name="status"
                defaultValue="APPROVED"
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              >
                <option value="APPROVED">APPROVED</option>
                <option value="PENDING">PENDING APPROVAL</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Validity (Days)</label>
              <input
                name="expiryDays"
                type="number"
                defaultValue={180}
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Source Citation Document</label>
            <input
              name="sourceCitation"
              placeholder="e.g. Q1 Global Growth Report v3"
              className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
            />
          </div>

          <div className="pt-3">
            <Button type="submit" variant="lime" size="md" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "COMMITTING..." : "COMMIT FACT TO VAULT \u2192"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* EDIT FACT MODAL */}
      <Dialog open={Boolean(editFactItem)} onOpenChange={(open) => !open && setEditFactItem(null)}>
        <DialogHeader>
          <DialogTitle>Edit Approved Fact</DialogTitle>
          <DialogDescription>Update empirical benchmark values or approval status.</DialogDescription>
        </DialogHeader>

        {editFactItem && (
          <form
            action={async (fd) => {
              try {
                setIsSubmitting(true);
                setActionError(null);
                await updateApprovedFactAction(fd);
                setEditFactItem(null);
              } catch (err: unknown) {
                setActionError(err instanceof Error ? err.message : "Error updating fact");
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="space-y-3 font-mono text-xs"
          >
            <input type="hidden" name="id" value={editFactItem.id} />

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Fact Name *</label>
              <input
                name="name"
                required
                defaultValue={editFactItem.name}
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Approved Value *</label>
              <input
                name="value"
                required
                defaultValue={editFactItem.value}
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold uppercase text-[#17251C] mb-1">Numeric Value</label>
                <input
                  name="numericValue"
                  type="number"
                  step="any"
                  defaultValue={editFactItem.numeric_value ?? ""}
                  className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold uppercase text-[#17251C] mb-1">Unit</label>
                <input
                  name="unit"
                  defaultValue={editFactItem.unit ?? ""}
                  className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold uppercase text-[#17251C] mb-1">Status</label>
                <select
                  name="status"
                  defaultValue={editFactItem.approval_status}
                  className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
                >
                  <option value="APPROVED">APPROVED</option>
                  <option value="PENDING">PENDING APPROVAL</option>
                  <option value="EXPIRED">EXPIRED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
              <div>
                <label className="block font-bold uppercase text-[#17251C] mb-1">Source Citation</label>
                <input
                  name="sourceCitation"
                  defaultValue={editFactItem.source_citation ?? ""}
                  className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3">
              <Button type="submit" variant="lime" size="md" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "SAVING..." : "SAVE FACT CHANGES \u2192"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* ========================================================
          MODALS: REGISTER & EDIT TERMINOLOGY RULES
         ======================================================== */}
      <Dialog open={addTermModalOpen} onOpenChange={setAddTermModalOpen}>
        <DialogHeader>
          <DialogTitle>Add Terminology Rule</DialogTitle>
          <DialogDescription>
            Register disallowed phrasing and its approved brand alternative.
          </DialogDescription>
        </DialogHeader>

        <form
          action={async (fd) => {
            try {
              setIsSubmitting(true);
              setActionError(null);
              await createTerminologyRuleAction(fd);
              setAddTermModalOpen(false);
            } catch (err: unknown) {
              setActionError(err instanceof Error ? err.message : "Error saving rule");
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="space-y-3 font-mono text-xs"
        >
          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Disallowed Term *</label>
            <input
              name="disallowedTerm"
              required
              placeholder="e.g. revolutionary"
              className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Approved Replacement *</label>
            <input
              name="approvedTerm"
              required
              placeholder="e.g. purpose-built"
              className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Severity</label>
              <select
                name="severity"
                defaultValue="MEDIUM"
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Category</label>
              <input
                name="category"
                defaultValue="brand_standard"
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Rationale</label>
            <input
              name="reason"
              placeholder="e.g. Avoid unquantifiable hyperbole."
              className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
            />
          </div>

          <div className="pt-3">
            <Button type="submit" variant="lime" size="md" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "REGISTERING..." : "REGISTER RULE \u2192"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* EDIT TERMINOLOGY RULE MODAL */}
      <Dialog open={Boolean(editTermItem)} onOpenChange={(open) => !open && setEditTermItem(null)}>
        <DialogHeader>
          <DialogTitle>Edit Terminology Rule</DialogTitle>
          <DialogDescription>Modify phrasing rules and severity classifications.</DialogDescription>
        </DialogHeader>

        {editTermItem && (
          <form
            action={async (fd) => {
              try {
                setIsSubmitting(true);
                setActionError(null);
                await updateTerminologyRuleAction(fd);
                setEditTermItem(null);
              } catch (err: unknown) {
                setActionError(err instanceof Error ? err.message : "Error updating rule");
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="space-y-3 font-mono text-xs"
          >
            <input type="hidden" name="id" value={editTermItem.id} />

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Disallowed Term *</label>
              <input
                name="disallowedTerm"
                required
                defaultValue={editTermItem.disallowed_term}
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Approved Replacement *</label>
              <input
                name="approvedTerm"
                required
                defaultValue={editTermItem.approved_term}
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold uppercase text-[#17251C] mb-1">Severity</label>
                <select
                  name="severity"
                  defaultValue={editTermItem.severity || "MEDIUM"}
                  className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
                >
                  <option value="CRITICAL">CRITICAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="LOW">LOW</option>
                </select>
              </div>
              <div>
                <label className="block font-bold uppercase text-[#17251C] mb-1">Category</label>
                <input
                  name="category"
                  defaultValue={editTermItem.category || "brand_standard"}
                  className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Rationale</label>
              <input
                name="reason"
                defaultValue={editTermItem.reason || editTermItem.context || ""}
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>

            <div className="pt-3">
              <Button type="submit" variant="lime" size="md" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "SAVING..." : "SAVE RULE CHANGES \u2192"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* ========================================================
          MODALS: PUBLISH, EDIT & VERSION GUIDELINES
         ======================================================== */}
      <Dialog open={addGuidelineModalOpen} onOpenChange={setAddGuidelineModalOpen}>
        <DialogHeader>
          <DialogTitle>Publish Brand Guideline</DialogTitle>
          <DialogDescription>
            Publish active guidance for copywriters and content creators.
          </DialogDescription>
        </DialogHeader>

        <form
          action={async (fd) => {
            try {
              setIsSubmitting(true);
              setActionError(null);
              await createGuidelineAction(fd);
              setAddGuidelineModalOpen(false);
            } catch (err: unknown) {
              setActionError(err instanceof Error ? err.message : "Error publishing guideline");
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="space-y-3 font-mono text-xs"
        >
          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Guideline Title *</label>
            <input
              name="title"
              required
              placeholder="e.g. Tone of Voice: Professional yet Approachable"
              className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Category</label>
              <input
                name="category"
                defaultValue="voice"
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Version</label>
              <input
                name="version"
                defaultValue="1.0"
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Guideline Body & Rules *</label>
            <textarea
              name="body"
              required
              rows={5}
              placeholder="Enumerate rules, allowed tone traits, and audience expectations..."
              className="w-full p-2.5 bg-white brutal-border text-xs focus:outline-none resize-y"
            />
          </div>

          <div className="pt-3">
            <Button type="submit" variant="lime" size="md" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "PUBLISHING..." : "PUBLISH GUIDELINE \u2192"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* EDIT GUIDELINE MODAL */}
      <Dialog open={Boolean(editGuidelineItem)} onOpenChange={(open) => !open && setEditGuidelineItem(null)}>
        <DialogHeader>
          <DialogTitle>Edit Brand Guideline</DialogTitle>
          <DialogDescription>Update guideline body, category, or status.</DialogDescription>
        </DialogHeader>

        {editGuidelineItem && (
          <form
            action={async (fd) => {
              try {
                setIsSubmitting(true);
                setActionError(null);
                await updateGuidelineAction(fd);
                setEditGuidelineItem(null);
              } catch (err: unknown) {
                setActionError(err instanceof Error ? err.message : "Error updating guideline");
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="space-y-3 font-mono text-xs"
          >
            <input type="hidden" name="id" value={editGuidelineItem.id} />

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Guideline Title *</label>
              <input
                name="title"
                required
                defaultValue={editGuidelineItem.title}
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold uppercase text-[#17251C] mb-1">Category</label>
                <input
                  name="category"
                  defaultValue={editGuidelineItem.category}
                  className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold uppercase text-[#17251C] mb-1">Status</label>
                <select
                  name="status"
                  defaultValue={editGuidelineItem.status.toLowerCase()}
                  className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
                >
                  <option value="published">PUBLISHED</option>
                  <option value="draft">DRAFT</option>
                  <option value="archived">ARCHIVED</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Guideline Body & Rules *</label>
              <textarea
                name="body"
                required
                rows={5}
                defaultValue={editGuidelineItem.body || (Array.isArray(editGuidelineItem.rules) ? editGuidelineItem.rules.join("\n") : "")}
                className="w-full p-2.5 bg-white brutal-border text-xs focus:outline-none resize-y"
              />
            </div>

            <div className="pt-3">
              <Button type="submit" variant="lime" size="md" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "SAVING..." : "SAVE GUIDELINE \u2192"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* VERSION GUIDELINE MODAL */}
      <Dialog open={Boolean(versionGuidelineItem)} onOpenChange={(open) => !open && setVersionGuidelineItem(null)}>
        <DialogHeader>
          <DialogTitle>Bump Guideline Version</DialogTitle>
          <DialogDescription>
            Release a new official version of &ldquo;{versionGuidelineItem?.title}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        {versionGuidelineItem && (
          <form
            action={async (fd) => {
              try {
                setIsSubmitting(true);
                setActionError(null);
                await versionGuidelineAction(fd);
                setVersionGuidelineItem(null);
              } catch (err: unknown) {
                setActionError(err instanceof Error ? err.message : "Error versioning guideline");
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="space-y-3 font-mono text-xs"
          >
            <input type="hidden" name="id" value={versionGuidelineItem.id} />

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Current Version</label>
              <input
                disabled
                value={`v${versionGuidelineItem.version || "1.0"}`}
                className="w-full px-3 py-2 bg-[#F4F1E8] brutal-border text-xs focus:outline-none cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">New Version Tag *</label>
              <input
                name="version"
                required
                placeholder="e.g. 2.2 or 3.0"
                defaultValue={
                  versionGuidelineItem.version
                    ? `${(parseFloat(versionGuidelineItem.version) + 0.1).toFixed(1)}`
                    : "1.1"
                }
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Updated Body / Amendments (Optional)</label>
              <textarea
                name="body"
                rows={4}
                defaultValue={versionGuidelineItem.body || (Array.isArray(versionGuidelineItem.rules) ? versionGuidelineItem.rules.join("\n") : "")}
                className="w-full p-2.5 bg-white brutal-border text-xs focus:outline-none resize-y"
              />
            </div>

            <div className="pt-3">
              <Button type="submit" variant="lime" size="md" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "PUBLISHING VERSION..." : "PUBLISH NEW VERSION \u2192"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* ========================================================
          MODALS: REGISTER & EDIT ASSETS
         ======================================================== */}
      <Dialog open={addAssetModalOpen} onOpenChange={setAddAssetModalOpen}>
        <DialogHeader>
          <DialogTitle>Register Approved Asset</DialogTitle>
          <DialogDescription>Catalog brand emblems, templates, and palette standards.</DialogDescription>
        </DialogHeader>

        <form
          action={async (fd) => {
            try {
              setIsSubmitting(true);
              setActionError(null);
              await createApprovedAssetAction(fd);
              setAddAssetModalOpen(false);
            } catch (err: unknown) {
              setActionError(err instanceof Error ? err.message : "Error registering asset");
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="space-y-3 font-mono text-xs"
        >
          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Asset Name *</label>
            <input
              name="name"
              required
              placeholder="e.g. Primary Horizontal Vector Emblem"
              className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Asset Type</label>
              <select
                name="assetType"
                defaultValue="logo"
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              >
                <option value="logo">Logo & Monogram</option>
                <option value="color_palette">Color Palette</option>
                <option value="template">Template</option>
                <option value="typography">Typography</option>
                <option value="imagery">Imagery / Banner</option>
              </select>
            </div>
            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Storage Path</label>
              <input
                name="storagePath"
                placeholder="e.g. brand-assets/logo.svg"
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Usage Rules & Metadata</label>
            <input
              name="description"
              placeholder="e.g. 24px clear space required. Minimum size 120px."
              className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
            />
          </div>

          <div className="pt-3">
            <Button type="submit" variant="lime" size="md" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "REGISTERING..." : "REGISTER ASSET \u2192"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={Boolean(editAssetItem)} onOpenChange={(open) => !open && setEditAssetItem(null)}>
        <DialogHeader>
          <DialogTitle>Edit Brand Asset</DialogTitle>
          <DialogDescription>Modify metadata and usage specifications.</DialogDescription>
        </DialogHeader>

        {editAssetItem && (
          <form
            action={async (fd) => {
              try {
                setIsSubmitting(true);
                setActionError(null);
                await updateApprovedAssetAction(fd);
                setEditAssetItem(null);
              } catch (err: unknown) {
                setActionError(err instanceof Error ? err.message : "Error updating asset");
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="space-y-3 font-mono text-xs"
          >
            <input type="hidden" name="id" value={editAssetItem.id} />

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Asset Name *</label>
              <input
                name="name"
                required
                defaultValue={editAssetItem.name}
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Asset Type</label>
              <select
                name="assetType"
                defaultValue={editAssetItem.asset_type}
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              >
                <option value="logo">Logo & Monogram</option>
                <option value="color_palette">Color Palette</option>
                <option value="template">Template</option>
                <option value="typography">Typography</option>
                <option value="imagery">Imagery / Banner</option>
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Usage Rules & Metadata</label>
              <input
                name="description"
                defaultValue={editAssetItem.metadata?.description || ""}
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>

            <div className="pt-3">
              <Button type="submit" variant="lime" size="md" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "SAVING..." : "SAVE ASSET CHANGES \u2192"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* ========================================================
          MODALS: REGISTER & EDIT EXAMPLES
         ======================================================== */}
      <Dialog open={addExampleModalOpen} onOpenChange={setAddExampleModalOpen}>
        <DialogHeader>
          <DialogTitle>Add Approved Copy Example</DialogTitle>
          <DialogDescription>Provide gold-standard copy benchmarks for teams.</DialogDescription>
        </DialogHeader>

        <form
          action={async (fd) => {
            try {
              setIsSubmitting(true);
              setActionError(null);
              await createApprovedExampleAction(fd);
              setAddExampleModalOpen(false);
            } catch (err: unknown) {
              setActionError(err instanceof Error ? err.message : "Error saving example");
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="space-y-3 font-mono text-xs"
        >
          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Example Title *</label>
            <input
              name="title"
              required
              placeholder="e.g. Enterprise Milestone Announcement"
              className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Channel / Category *</label>
            <input
              name="category"
              required
              defaultValue="LinkedIn Post"
              placeholder="e.g. LinkedIn Post, Email Subject Line, Website Headline"
              className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Approved Copy Text *</label>
            <textarea
              name="content"
              required
              rows={4}
              placeholder="Exact approved phrasing..."
              className="w-full p-2.5 bg-white brutal-border text-xs focus:outline-none resize-y"
            />
          </div>

          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Why This Works *</label>
            <input
              name="whyItWorks"
              required
              placeholder="e.g. Pairs empirical pilot benchmark with required legal disclaimer."
              className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
            />
          </div>

          <div className="pt-3">
            <Button type="submit" variant="lime" size="md" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "SAVING..." : "SAVE APPROVED EXAMPLE \u2192"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={Boolean(editExampleItem)} onOpenChange={(open) => !open && setEditExampleItem(null)}>
        <DialogHeader>
          <DialogTitle>Edit Copy Example</DialogTitle>
          <DialogDescription>Modify copy text or guidance rationale.</DialogDescription>
        </DialogHeader>

        {editExampleItem && (
          <form
            action={async (fd) => {
              try {
                setIsSubmitting(true);
                setActionError(null);
                await updateApprovedExampleAction(fd);
                setEditExampleItem(null);
              } catch (err: unknown) {
                setActionError(err instanceof Error ? err.message : "Error updating example");
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="space-y-3 font-mono text-xs"
          >
            <input type="hidden" name="id" value={editExampleItem.id} />

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Example Title *</label>
              <input
                name="title"
                required
                defaultValue={editExampleItem.title}
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Channel / Category *</label>
              <input
                name="category"
                required
                defaultValue={editExampleItem.category}
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Approved Copy Text *</label>
              <textarea
                name="content"
                required
                rows={4}
                defaultValue={editExampleItem.content}
                className="w-full p-2.5 bg-white brutal-border text-xs focus:outline-none resize-y"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Why This Works *</label>
              <input
                name="whyItWorks"
                required
                defaultValue={editExampleItem.why_it_works}
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>

            <div className="pt-3">
              <Button type="submit" variant="lime" size="md" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "SAVING..." : "SAVE EXAMPLE CHANGES \u2192"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* ========================================================
          MODALS: REGISTER & EDIT DISCLAIMERS
         ======================================================== */}
      <Dialog open={addDisclaimerModalOpen} onOpenChange={setAddDisclaimerModalOpen}>
        <DialogHeader>
          <DialogTitle>Add Legal Disclaimer or Policy</DialogTitle>
          <DialogDescription>Define statutory notices and their enforcement triggers.</DialogDescription>
        </DialogHeader>

        <form
          action={async (fd) => {
            try {
              setIsSubmitting(true);
              setActionError(null);
              await createBrandDisclaimerAction(fd);
              setAddDisclaimerModalOpen(false);
            } catch (err: unknown) {
              setActionError(err instanceof Error ? err.message : "Error saving disclaimer");
            } finally {
              setIsSubmitting(false);
            }
          }}
          className="space-y-3 font-mono text-xs"
        >
          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Disclaimer Title *</label>
            <input
              name="title"
              required
              placeholder="e.g. Pilot Performance Metric Disclaimer"
              className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Enforcement Trigger *</label>
            <input
              name="trigger"
              required
              placeholder="e.g. Enforced whenever numeric speed or productivity percentages are cited."
              className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Exact Disclaimer Phrasing *</label>
            <textarea
              name="disclaimerText"
              required
              rows={3}
              placeholder="e.g. Results based on an internal pilot; individual results may vary."
              className="w-full p-2.5 bg-white brutal-border text-xs focus:outline-none resize-y"
            />
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="isMandatory"
              name="isMandatory"
              defaultChecked
              className="w-4 h-4 accent-[#16834A]"
            />
            <label htmlFor="isMandatory" className="font-bold text-[#17251C] cursor-pointer">
              Strictly Mandatory (Flags High Severity Violation if Missing)
            </label>
          </div>

          <div className="pt-3">
            <Button type="submit" variant="lime" size="md" disabled={isSubmitting} className="w-full">
              {isSubmitting ? "SAVING..." : "COMMIT DISCLAIMER TO VAULT \u2192"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={Boolean(editDisclaimerItem)} onOpenChange={(open) => !open && setEditDisclaimerItem(null)}>
        <DialogHeader>
          <DialogTitle>Edit Legal Disclaimer</DialogTitle>
          <DialogDescription>Modify mandatory wording or trigger conditions.</DialogDescription>
        </DialogHeader>

        {editDisclaimerItem && (
          <form
            action={async (fd) => {
              try {
                setIsSubmitting(true);
                setActionError(null);
                await updateBrandDisclaimerAction(fd);
                setEditDisclaimerItem(null);
              } catch (err: unknown) {
                setActionError(err instanceof Error ? err.message : "Error updating disclaimer");
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="space-y-3 font-mono text-xs"
          >
            <input type="hidden" name="id" value={editDisclaimerItem.id} />

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Disclaimer Title *</label>
              <input
                name="title"
                required
                defaultValue={editDisclaimerItem.title}
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Enforcement Trigger *</label>
              <input
                name="trigger"
                required
                defaultValue={editDisclaimerItem.trigger}
                className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold uppercase text-[#17251C] mb-1">Exact Disclaimer Phrasing *</label>
              <textarea
                name="disclaimerText"
                required
                rows={3}
                defaultValue={editDisclaimerItem.disclaimer_text}
                className="w-full p-2.5 bg-white brutal-border text-xs focus:outline-none resize-y"
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="editIsMandatory"
                name="isMandatory"
                defaultChecked={editDisclaimerItem.is_mandatory !== false}
                className="w-4 h-4 accent-[#16834A]"
              />
              <label htmlFor="editIsMandatory" className="font-bold text-[#17251C] cursor-pointer">
                Strictly Mandatory (Flags High Severity Violation if Missing)
              </label>
            </div>

            <div className="pt-3">
              <Button type="submit" variant="lime" size="md" disabled={isSubmitting} className="w-full">
                {isSubmitting ? "SAVING..." : "SAVE DISCLAIMER CHANGES \u2192"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
