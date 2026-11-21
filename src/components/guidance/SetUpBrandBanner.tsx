"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, Sparkles, ArrowRight, RefreshCw, CheckCircle2 } from "lucide-react";
import { loadSampleBrandDataAction } from "@/app/actions/auth";

interface SetUpBrandBannerProps {
  className?: string;
}

export function SetUpBrandBanner({ className = "" }: SetUpBrandBannerProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleLoadSample() {
    setIsLoading(true);
    setError(null);
    setFeedback(null);

    const res = await loadSampleBrandDataAction();
    setIsLoading(false);

    if (res.success) {
      setFeedback(res.message || "Sample brand data loaded into your organisation!");
    } else {
      setError(res.error || "Failed to load sample brand data.");
    }
  }

  if (feedback) {
    return (
      <div className={`p-4 bg-[#DDEBDD] brutal-border brutal-shadow-sm font-mono text-xs flex items-center justify-between gap-3 ${className}`}>
        <div className="flex items-center space-x-2.5 text-[#16834A]">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="font-bold">{feedback}</span>
        </div>
        <Link
          href="/knowledge"
          className="brutal-btn brutal-btn-primary px-3 py-1 text-[11px] font-bold"
        >
          VIEW IN BRAND KNOWLEDGE &rarr;
        </Link>
      </div>
    );
  }

  return (
    <div className={`brutal-panel bg-white p-5 brutal-shadow font-mono border-2 border-[#253C2B] ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-[#E6A23C] inline-block" />
            <span className="font-extrabold text-[10px] text-[#E6A23C] uppercase tracking-wider">
              ACTION REQUIRED
            </span>
          </div>
          <h2 className="font-extrabold text-base sm:text-lg text-[#17251C] leading-snug">
            SET UP YOUR BRAND FIRST
          </h2>
          <p className="text-xs text-[#637367] max-w-2xl leading-relaxed">
            Your organisation does not have any active brand knowledge or approved benchmark facts yet. Add your brand rules to enable verification, or load a sample brand dataset into your organisation.
          </p>
          {error && <p className="text-xs text-[#D94C4C] font-bold">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Link
            href="/knowledge"
            className="brutal-btn brutal-btn-secondary px-3.5 py-2 text-xs font-bold flex items-center space-x-1.5"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#16834A]" />
            <span>GO TO BRAND KNOWLEDGE &rarr;</span>
          </Link>

          <button
            type="button"
            onClick={handleLoadSample}
            disabled={isLoading}
            className="brutal-btn brutal-btn-lime px-3.5 py-2 text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>LOADING SAMPLE DATA...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#16834A]" />
                <span>LOAD SAMPLE BRAND DATA</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
