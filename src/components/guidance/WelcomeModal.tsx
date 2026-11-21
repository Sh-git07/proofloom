"use client";

import * as React from "react";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { OrgRole } from "@/lib/permissions";
import { updateOnboardingAction } from "@/app/actions/onboarding";

interface WelcomeModalProps {
  role: OrgRole;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
  onStartTour: () => void;
}

export function WelcomeModal({
  role,
  userName,
  isOpen,
  onClose,
  onStartTour,
}: WelcomeModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const modalRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !isSubmitting) {
        handleSkip();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      modalRef.current?.focus();
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSubmitting]);

  if (!isOpen) return null;

  async function handleSkip() {
    setIsSubmitting(true);
    await updateOnboardingAction({ welcome_dismissed: true });
    setIsSubmitting(false);
    onClose();
  }

  async function handleTakeTour() {
    setIsSubmitting(true);
    await updateOnboardingAction({ welcome_dismissed: true });
    setIsSubmitting(false);
    onClose();
    onStartTour();
  }

  const roleDisplay = role.replace("_", " ").toUpperCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#17251C]/75 backdrop-blur-[2px]"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-lg bg-[#F4F1E8] brutal-border brutal-shadow p-6 sm:p-8 space-y-6 focus:outline-none"
      >
        {/* Header with Title and Close */}
        <div className="flex items-start justify-between border-b-2 border-[#253C2B] pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#16834A] text-[#B7F28B] brutal-border flex items-center justify-center font-mono font-black text-lg">
              PL
            </div>
            <div>
              <span className="font-mono text-[10px] font-bold text-[#16834A] uppercase tracking-wider block">
                WELCOME TO PROOFLOOM
              </span>
              <h2
                id="welcome-modal-title"
                className="font-mono font-extrabold text-xl sm:text-2xl text-[#17251C] leading-none tracking-tight"
              >
                BRAND INTEGRITY ENGINE
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="p-1 brutal-border bg-white hover:bg-[#D94C4C] hover:text-white transition-colors cursor-pointer"
            aria-label="Skip welcome"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Role Card */}
        <div className="flex items-center justify-between p-3 bg-white brutal-border font-mono text-xs">
          <span className="text-[#637367] font-bold">SIGNED IN AS:</span>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[#17251C]">{userName}</span>
            <span className="px-2 py-0.5 bg-[#17251C] text-[#B7F28B] font-extrabold text-[10px] uppercase brutal-border">
              {roleDisplay}
            </span>
          </div>
        </div>

        {/* What PROOFLOOM does in 3 lines */}
        <div className="space-y-3 font-mono text-xs text-[#17251C]">
          <span className="text-[10px] font-bold text-[#637367] uppercase tracking-wider block">
            HOW THE PLATFORM WORKS:
          </span>
          <div className="p-4 bg-white brutal-border space-y-2.5 leading-relaxed">
            <div className="flex items-start space-x-2.5">
              <span className="w-5 h-5 bg-[#16834A] text-white shrink-0 brutal-border flex items-center justify-center text-[10px] font-bold font-mono">
                1
              </span>
              <p>
                <strong>Automates brand governance</strong> by verifying commercial copy against approved facts, tone rules, and banned terminology.
              </p>
            </div>
            <div className="flex items-start space-x-2.5">
              <span className="w-5 h-5 bg-[#16834A] text-white shrink-0 brutal-border flex items-center justify-center text-[10px] font-bold font-mono">
                2
              </span>
              <p>
                <strong>Extracts factual claims</strong> and connects them directly to approved source documents with immutable provenance chains.
              </p>
            </div>
            <div className="flex items-start space-x-2.5">
              <span className="w-5 h-5 bg-[#16834A] text-white shrink-0 brutal-border flex items-center justify-center text-[10px] font-bold font-mono">
                3
              </span>
              <p>
                <strong>Empowers cross-functional teams</strong> to resolve findings, detect brand drift, and ensure continuous brand integrity.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2 bg-white brutal-border text-xs font-mono font-bold text-[#17251C] hover:bg-[#F4F1E8] transition-colors cursor-pointer"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleTakeTour}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-5 py-2 bg-[#16834A] text-white brutal-border text-xs font-mono font-bold hover:bg-[#126b3c] brutal-shadow-sm flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#B7F28B]" />
            <span>Take the 60-second tour</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
