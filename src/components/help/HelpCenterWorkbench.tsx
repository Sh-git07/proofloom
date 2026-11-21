"use client";

import * as React from "react";
import {
  Search,
  BookOpen,
  Sparkles,
  RotateCcw,
  ExternalLink,
  Tag,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { HELP_ARTICLES, searchHelpArticles, HelpArticle } from "@/lib/guidance/help-articles";
import { OrgRole } from "@/lib/permissions";
import { TourGuide } from "@/components/guidance/TourGuide";

interface HelpCenterWorkbenchProps {
  currentRole: OrgRole;
}

const CATEGORIES = [
  "All",
  "Getting Started",
  "Role Guides",
  "Audits & Evidence",
  "Governance & Review",
  "System & AI",
] as const;

export function HelpCenterWorkbench({ currentRole }: HelpCenterWorkbenchProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("All");
  const [activeTourRole, setActiveTourRole] = React.useState<OrgRole | null>(null);
  const [copiedHash, setCopiedHash] = React.useState<string | null>(null);
  const [activeHash, setActiveHash] = React.useState<string>("");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        setActiveHash(hash);
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }
  }, []);

  const filteredArticles = React.useMemo(() => {
    return searchHelpArticles(searchQuery, selectedCategory);
  }, [searchQuery, selectedCategory]);

  function copyAnchor(hash: string) {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/help#${hash}`;
      navigator.clipboard.writeText(url);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    }
  }

  return (
    <div className="space-y-6 font-mono text-xs text-[#17251C]">
      {/* 1. Header Banner */}
      <div className="brutal-panel bg-white p-6 brutal-shadow space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#253C2B] pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 bg-[#16834A] inline-block" />
              <span className="font-extrabold text-[10px] text-[#16834A] uppercase tracking-wider">
                DOCUMENTATION & GUIDANCE REPOSITORY
              </span>
            </div>
            <h1 className="font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C]">
              HELP CENTRE
            </h1>
            <p className="text-[11px] text-[#637367]">
              Authoritative guides, stage specifications, scoring rules, and governance workflows.
            </p>
          </div>

          {/* Quick Stat */}
          <div className="flex items-center space-x-3 px-3 py-2 bg-[#F4F1E8] brutal-border">
            <BookOpen className="w-5 h-5 text-[#16834A]" />
            <div>
              <span className="font-bold text-base block leading-none">{HELP_ARTICLES.length}</span>
              <span className="text-[9px] text-[#637367] uppercase font-bold">ARTICLES CATALOGUED</span>
            </div>
          </div>
        </div>

        {/* Replay Tours Row */}
        <div className="pt-1">
          <div className="flex items-center space-x-2 mb-2.5">
            <RotateCcw className="w-3.5 h-3.5 text-[#16834A]" />
            <span className="font-extrabold text-[10px] text-[#637367] uppercase tracking-wider">
              REPLAY ROLE ONBOARDING TOURS:
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { role: "creator", label: "Creator Tour" },
                { role: "reviewer", label: "Reviewer Tour" },
                { role: "brand_manager", label: "Brand Manager Tour" },
                { role: "admin", label: "Admin Tour" },
              ] as const
            ).map((t) => (
              <button
                key={t.role}
                type="button"
                onClick={() => setActiveTourRole(t.role)}
                className={`px-3 py-1.5 brutal-border text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  currentRole === t.role
                    ? "bg-[#16834A] text-white hover:bg-[#126b3c] brutal-shadow-sm"
                    : "bg-[#F4F1E8] text-[#17251C] hover:bg-white"
                }`}
              >
                <Sparkles className="w-3 h-3 text-[#B7F28B]" />
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Search & Category Filters */}
      <div className="brutal-panel bg-white p-4 brutal-shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#637367]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search help articles by topic, stage, status, or keyword..."
              className="w-full pl-9 pr-4 py-2 bg-[#F4F1E8] brutal-border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#16834A]"
            />
          </div>

          {/* Quick Clear */}
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="px-3 py-2 brutal-border bg-[#F4F1E8] hover:bg-[#D94C4C] hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              CLEAR SEARCH
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[#E5E2D9]">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 text-[11px] font-bold uppercase transition-all brutal-border cursor-pointer ${
                selectedCategory === cat
                  ? "bg-[#17251C] text-[#B7F28B]"
                  : "bg-white text-[#637367] hover:bg-[#F4F1E8] hover:text-[#17251C]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Articles Grid */}
      {filteredArticles.length === 0 ? (
        <div className="brutal-panel bg-white p-8 text-center space-y-2">
          <p className="font-bold text-sm text-[#17251C]">No articles matched your search query.</p>
          <p className="text-[11px] text-[#637367]">
            Try adjusting your search terms or clearing the category filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredArticles.map((article) => {
            const isTargeted = activeHash === article.hash;

            return (
              <div
                key={article.id}
                id={article.hash}
                className={`brutal-panel p-5 space-y-3 transition-all ${
                  isTargeted
                    ? "bg-[#DDEBDD]/40 border-2 border-[#16834A] ring-2 ring-[#16834A]/50 brutal-shadow"
                    : "bg-white brutal-shadow-sm"
                }`}
              >
                {/* Article Header */}
                <div className="flex items-start justify-between gap-2 border-b border-[#253C2B] pb-2">
                  <div className="space-y-1">
                    <span className="px-1.5 py-0.5 bg-[#F4F1E8] brutal-border text-[9px] font-bold text-[#16834A] uppercase inline-block">
                      {article.category}
                    </span>
                    <h2 className="font-extrabold text-sm sm:text-base text-[#17251C] leading-snug">
                      {article.title}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyAnchor(article.hash)}
                    title="Copy direct anchor link"
                    className="p-1 brutal-border bg-[#F4F1E8] hover:bg-[#DDEBDD] transition-colors cursor-pointer"
                  >
                    {copiedHash === article.hash ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#16834A]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[#637367]" />
                    )}
                  </button>
                </div>

                {/* Summary */}
                <p className="font-bold text-[11px] text-[#17251C]">
                  {article.summary}
                </p>

                {/* Body Paragraphs / Bullets */}
                <div className="space-y-1.5 text-[11px] text-[#637367] leading-relaxed">
                  {article.content.map((paragraph, idx) => (
                    <p key={idx} className="text-[#17251C]">
                      {paragraph}
                    </p>
                  ))}
                </div>

                {/* Tags */}
                <div className="pt-2 border-t border-[#E5E2D9] flex flex-wrap items-center gap-1">
                  <Tag className="w-3 h-3 text-[#637367]" />
                  {article.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] text-[#637367] bg-[#F4F1E8] px-1 py-0.5"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Role Tour Overlay */}
      {activeTourRole && (
        <TourGuide
          role={activeTourRole}
          isActive={Boolean(activeTourRole)}
          onClose={() => setActiveTourRole(null)}
        />
      )}
    </div>
  );
}
