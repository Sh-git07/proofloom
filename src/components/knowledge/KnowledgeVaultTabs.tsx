"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  createApprovedFactAction,
  createTerminologyRuleAction,
  createGuidelineAction,
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
} from "lucide-react";

interface FactItem {
  id: string;
  name: string;
  value: string;
  numeric_value: number | null;
  unit: string | null;
  approval_status: string;
  expires_at: string | null;
  verified_at: string | null;
  source_citation?: string | null;
  owner: string;
}

interface TermItem {
  id: string;
  disallowed_term: string;
  approved_term: string;
  category: string;
  severity: string;
  reason?: string | null;
}

interface GuidelineItem {
  id: string;
  title: string;
  category: string;
  body: string;
  status: string;
  published_at?: string | null;
}

export function KnowledgeVaultTabs({
  facts,
  terms,
  guidelines,
  userRole,
}: {
  facts: FactItem[];
  terms: TermItem[];
  guidelines: GuidelineItem[];
  userRole: string;
}) {
  const [activeTab, setActiveTab] = React.useState<
    "guidelines" | "facts" | "terms" | "assets" | "examples" | "disclaimers"
  >("facts");

  const [addFactModalOpen, setAddFactModalOpen] = React.useState(false);
  const [addTermModalOpen, setAddTermModalOpen] = React.useState(false);
  const [addGuidelineModalOpen, setAddGuidelineModalOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

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
          { key: "assets", label: "04 APPROVED ASSETS", icon: Layers, count: 4 },
          { key: "examples", label: "05 APPROVED EXAMPLES", icon: Sparkles, count: 3 },
          { key: "disclaimers", label: "06 DISCLAIMERS & POLICIES", icon: FileCheck, count: 2 },
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
              <span className={`text-[10px] px-1 rounded-[1px] ${isActive ? "bg-white text-[#16834A]" : "bg-white text-[#637367]"}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
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
          <div className="flex items-center justify-between">
            <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
              AUTHORITATIVE BENCHMARKS & EMPIRICAL METRICS ({facts.length})
            </h3>
            {canEdit && (
              <Button
                variant="lime"
                size="sm"
                onClick={() => setAddFactModalOpen(true)}
                className="flex items-center space-x-1"
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
              const isExpiringSoon = !isExpired && daysRemaining <= 30;

              return (
                <div key={fact.id} className="brutal-panel bg-white p-4 space-y-2.5 font-mono text-xs">
                  <div className="flex items-start justify-between border-b border-[#253C2B]/15 pb-2">
                    <div>
                      <span className="font-bold text-[#17251C] text-sm block">
                        {fact.name}
                      </span>
                      <span className="text-[10px] text-[#637367]">
                        Verified by {fact.owner || "Brand Governance"}
                      </span>
                    </div>

                    <div className="flex flex-col items-end space-y-1">
                      <span
                        className={`text-[9px] font-extrabold px-1.5 py-0.2 brutal-border ${
                          isExpired
                            ? "bg-[#D94C4C] text-white"
                            : "bg-[#B7F28B] text-[#17251C]"
                        }`}
                      >
                        {isExpired ? "EXPIRED" : "APPROVED & ACTIVE"}
                      </span>
                      {isExpiringSoon && (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-[#E6A23C] text-[#17251C] brutal-border">
                          EXPIRES IN {daysRemaining}D
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-2.5 bg-[#F4F1E8] brutal-border">
                    <span className="text-[10px] text-[#637367] block uppercase">APPROVED TEXT / VALUE:</span>
                    <p className="font-extrabold text-sm text-[#17251C] mt-0.5">
                      {fact.value}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-[#637367]">
                    <div>
                      <span className="block uppercase text-[9px]">Numeric Benchmark:</span>
                      <span className="font-bold text-[#17251C]">
                        {fact.numeric_value !== null ? `${fact.numeric_value} ${fact.unit || ""}` : "Categorical"}
                      </span>
                    </div>
                    <div>
                      <span className="block uppercase text-[9px]">Expiry Date:</span>
                      <span className="font-bold text-[#17251C]">
                        {expiresDate ? expiresDate.toLocaleDateString() : "Indefinite"}
                      </span>
                    </div>
                  </div>

                  {fact.source_citation && (
                    <div className="text-[10px] text-[#16834A] pt-1">
                      &bull; Source: {fact.source_citation}
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
          <div className="flex items-center justify-between">
            <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
              CORPORATE TERMINOLOGY STANDARDS ({terms.length})
            </h3>
            {canEdit && (
              <Button
                variant="lime"
                size="sm"
                onClick={() => setAddTermModalOpen(true)}
                className="flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>NEW TERMINOLOGY RULE</span>
              </Button>
            )}
          </div>

          <div className="brutal-panel bg-white p-4 space-y-3">
            <div className="grid grid-cols-1 divide-y-2 divide-[#253C2B]/15">
              {terms.map((term) => (
                <div key={term.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-[#D94C4C] line-through bg-[#D94C4C]/10 px-2 py-0.5 brutal-border">
                        {term.disallowed_term}
                      </span>
                      <span>&rarr;</span>
                      <span className="font-extrabold text-[#16834A] bg-[#DDEBDD] px-2 py-0.5 brutal-border">
                        {term.approved_term}
                      </span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-[#F4F1E8] brutal-border">
                        {term.severity}
                      </span>
                    </div>
                    {term.reason && (
                      <p className="text-[11px] text-[#637367]">
                        Rationale: {term.reason}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-[#637367] uppercase font-bold">
                    {term.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB CONTENT: GUIDELINES */}
      {activeTab === "guidelines" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
              PUBLISHED BRAND GUIDELINES ({guidelines.length})
            </h3>
            {canEdit && (
              <Button
                variant="lime"
                size="sm"
                onClick={() => setAddGuidelineModalOpen(true)}
                className="flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>PUBLISH GUIDELINE</span>
              </Button>
            )}
          </div>

          <div className="space-y-3 font-mono">
            {guidelines.map((g) => (
              <div key={g.id} className="brutal-panel bg-white p-5 space-y-2">
                <div className="flex items-center justify-between border-b border-[#253C2B]/15 pb-2">
                  <h4 className="font-bold text-sm text-[#17251C]">{g.title}</h4>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-[#B7F28B] text-[#17251C] brutal-border">
                    {g.status}
                  </span>
                </div>
                <p className="text-xs text-[#17251C] whitespace-pre-wrap leading-relaxed">
                  {g.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. TAB CONTENT: ASSETS */}
      {activeTab === "assets" && (
        <div className="space-y-4">
          <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
            APPROVED ASSETS & VISUAL STANDARDS
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
            <div className="brutal-panel bg-white p-4 space-y-2">
              <span className="font-bold text-[#17251C] block">Primary Mark</span>
              <div className="h-20 bg-[#16834A] text-white flex items-center justify-center font-bold font-mono text-xl brutal-border">
                PL LOGO
              </div>
              <span className="text-[10px] text-[#637367] block">Vector SVG &bull; High Res</span>
            </div>

            <div className="brutal-panel bg-white p-4 space-y-2">
              <span className="font-bold text-[#17251C] block">Color: Blueprint Paper</span>
              <div className="h-20 bg-[#F4F1E8] brutal-border flex items-center justify-center font-bold text-[#17251C]">
                #F4F1E8
              </div>
              <span className="text-[10px] text-[#637367] block">Primary Canvas Token</span>
            </div>

            <div className="brutal-panel bg-white p-4 space-y-2">
              <span className="font-bold text-[#17251C] block">Color: Machine Black</span>
              <div className="h-20 bg-[#17251C] brutal-border flex items-center justify-center font-bold text-white">
                #17251C
              </div>
              <span className="text-[10px] text-[#637367] block">Primary Ink Token</span>
            </div>

            <div className="brutal-panel bg-white p-4 space-y-2">
              <span className="font-bold text-[#17251C] block">Color: Signal Lime</span>
              <div className="h-20 bg-[#B7F28B] brutal-border flex items-center justify-center font-bold text-[#17251C]">
                #B7F28B
              </div>
              <span className="text-[10px] text-[#637367] block">Active Highlight Token</span>
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB CONTENT: EXAMPLES */}
      {activeTab === "examples" && (
        <div className="space-y-4">
          <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
            GOLD-STANDARD APPROVED COPY EXAMPLES
          </h3>
          <div className="space-y-3 font-mono text-xs">
            <div className="brutal-panel bg-white p-4 space-y-1.5">
              <span className="text-[10px] font-extrabold text-[#16834A] uppercase">
                EXCELLENCE BENCHMARK &bull; LINKEDIN ANNOUNCEMENT
              </span>
              <p className="font-bold text-[#17251C] bg-[#F4F1E8] p-3 brutal-border">
                &ldquo;Our AI-powered productivity platform helps teams work smarter. In an internal pilot, teams saw an 18% improvement in task completion time. Results based on an internal pilot; individual results may vary.&rdquo;
              </p>
              <span className="text-[10px] text-[#637367] block">
                Demonstrates: active empirical disclaimer, approved product naming, approachable professional tone.
              </span>
            </div>

            <div className="brutal-panel bg-white p-4 space-y-1.5">
              <span className="text-[10px] font-extrabold text-[#16834A] uppercase">
                EXCELLENCE BENCHMARK &bull; HOMEPAGE HEADER COPY
              </span>
              <p className="font-bold text-[#17251C] bg-[#F4F1E8] p-3 brutal-border">
                &ldquo;Trusted by over 12,400 forward-thinking organizations to protect and govern brand communication.&rdquo;
              </p>
              <span className="text-[10px] text-[#637367] block">
                Demonstrates: current active customer benchmark with no hyperbole.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 7. TAB CONTENT: DISCLAIMERS */}
      {activeTab === "disclaimers" && (
        <div className="space-y-4">
          <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#17251C]">
            MANDATORY LEGAL DISCLAIMERS & POLICIES
          </h3>
          <div className="space-y-3 font-mono text-xs">
            <div className="brutal-panel bg-white p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-[#253C2B]/15 pb-2">
                <span className="font-bold text-[#17251C]">Pilot Performance Disclaimer (Mandatory)</span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-[#D94C4C] text-white brutal-border">
                  LEGAL REQUIREMENT
                </span>
              </div>
              <p className="font-extrabold text-[#16834A] bg-[#DDEBDD] p-3 brutal-border">
                &ldquo;Results based on an internal pilot; individual results may vary.&rdquo;
              </p>
              <p className="text-[11px] text-[#637367]">
                Trigger: Automatically enforced whenever percentage productivity metrics or task completion acceleration is cited.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD APPROVED FACT */}
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
              setActionError(null);
              await createApprovedFactAction(fd);
              setAddFactModalOpen(false);
            } catch (err: unknown) {
              setActionError(err instanceof Error ? err.message : "Error saving fact");
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

          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Validity Duration (Days)</label>
            <input
              name="expiryDays"
              type="number"
              defaultValue={180}
              className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
            />
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
            <Button type="submit" variant="lime" size="md" className="w-full">
              COMMIT FACT TO VAULT &rarr;
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL: ADD TERMINOLOGY RULE */}
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
              setActionError(null);
              await createTerminologyRuleAction(fd);
              setAddTermModalOpen(false);
            } catch (err: unknown) {
              setActionError(err instanceof Error ? err.message : "Error saving rule");
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
            <Button type="submit" variant="lime" size="md" className="w-full">
              REGISTER RULE &rarr;
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MODAL: PUBLISH GUIDELINE */}
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
              setActionError(null);
              await createGuidelineAction(fd);
              setAddGuidelineModalOpen(false);
            } catch (err: unknown) {
              setActionError(err instanceof Error ? err.message : "Error publishing guideline");
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

          <div>
            <label className="block font-bold uppercase text-[#17251C] mb-1">Category</label>
            <input
              name="category"
              defaultValue="voice"
              className="w-full px-3 py-2 bg-white brutal-border text-xs focus:outline-none"
            />
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
            <Button type="submit" variant="lime" size="md" className="w-full">
              PUBLISH GUIDELINE &rarr;
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
