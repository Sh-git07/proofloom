"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ArrowRight, X, Sparkles } from "lucide-react";
import { ChecklistItem } from "@/lib/guidance/checklist";
import { updateOnboardingAction } from "@/app/actions/onboarding";
import { OrgRole } from "@/lib/permissions";

interface OverviewChecklistProps {
  role: OrgRole;
  items: ChecklistItem[];
  isDismissed?: boolean;
}

export function OverviewChecklist({
  role,
  items,
  isDismissed = false,
}: OverviewChecklistProps) {
  const [dismissed, setDismissed] = React.useState(isDismissed);
  const [isUpdating, setIsUpdating] = React.useState(false);

  if (dismissed || items.length === 0) return null;

  const completedCount = items.filter((i) => i.isCompleted).length;
  const progressPercent = Math.round((completedCount / items.length) * 100);

  async function handleDismiss() {
    setIsUpdating(true);
    setDismissed(true);
    await updateOnboardingAction({ checklist_dismissed: true });
    setIsUpdating(false);
  }

  return (
    <div className="brutal-panel bg-white p-5 space-y-4 font-mono brutal-shadow mb-6">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-[#253C2B] pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 bg-[#B7F28B] text-[#17251C] brutal-border flex items-center justify-center font-bold text-xs">
            <Sparkles className="w-4 h-4 text-[#16834A]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-sm text-[#17251C] uppercase tracking-wide">
                GETTING STARTED &bull; {role.replace("_", " ").toUpperCase()} CHECKLIST
              </span>
              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-[#F4F1E8] text-[#16834A] brutal-border">
                {completedCount}/{items.length} COMPLETED
              </span>
            </div>
            <p className="text-[11px] text-[#637367]">
              Complete key workflow milestones computed directly from live platform activity.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          disabled={isUpdating}
          className="p-1 brutal-border bg-[#F4F1E8] hover:bg-[#D94C4C] hover:text-white transition-colors cursor-pointer"
          title="Dismiss Getting Started"
          aria-label="Dismiss Getting Started card"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-bold text-[#637367] uppercase">
          <span>PROGRESS</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="w-full h-2.5 bg-[#F4F1E8] brutal-border overflow-hidden">
          <div
            className="h-full bg-[#16834A] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Checklist Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`p-3 brutal-border flex items-start justify-between gap-2 transition-all ${
              item.isCompleted
                ? "bg-[#DDEBDD]/50 border-[#16834A] hover:bg-[#DDEBDD]"
                : "bg-[#F4F1E8] hover:bg-white hover:translate-x-[-1px] hover:translate-y-[-1px] brutal-shadow-sm"
            }`}
          >
            <div className="flex items-start space-x-2.5">
              {item.isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-[#16834A] shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-4 h-4 text-[#637367] shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <span
                  className={`text-xs font-bold block ${
                    item.isCompleted ? "text-[#16834A] line-through decoration-[#16834A]" : "text-[#17251C]"
                  }`}
                >
                  {item.label}
                </span>
                <span className="text-[10px] text-[#637367] block leading-snug">
                  {item.description}
                </span>
              </div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[#17251C] shrink-0 mt-1 opacity-70" />
          </Link>
        ))}
      </div>
    </div>
  );
}
