"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X, Sparkles, CheckCircle2 } from "lucide-react";
import { OrgRole } from "@/lib/permissions";
import { updateOnboardingAction } from "@/app/actions/onboarding";

export interface TourStep {
  target: string; // selector e.g. '[data-tour="nav-studio"]'
  title: string;
  description: string;
  actionUrl?: string; // Optional destination page if user needs to navigate
  isNavStep?: boolean;
}

const CREATOR_STEPS: TourStep[] = [
  {
    target: '[data-tour="nav-studio"]',
    title: "Content Studio",
    description: "Your primary creative workspace. Draft, upload, or paste commercial copy across LinkedIn, Web, and Social channels.",
    actionUrl: "/studio",
    isNavStep: true,
  },
  {
    target: '[data-tour="tour-run-audit"]',
    title: "Run Brand Audit",
    description: "Launch multi-stage automated verification against approved facts, tone rules, and banned vocabulary in seconds.",
  },
  {
    target: '[data-tour="tour-score-findings"]',
    title: "Brand Integrity Score & Findings",
    description: "Inspect your composite 0-100 score with dimensional breakdowns across factual accuracy, voice, and terminology.",
  },
  {
    target: '[data-tour="nav-provenance"]',
    title: "Claim Provenance",
    description: "Examine every extracted statement traced directly to approved corporate source documents and page numbers.",
    actionUrl: "/provenance",
    isNavStep: true,
  },
  {
    target: '[data-tour="tour-accept-rewrite"]',
    title: "Accept Suggested Rewrites",
    description: "Apply one-click AI or rule-guided corrections to instantly resolve compliance findings and create clean versions.",
  },
  {
    target: '[data-tour="tour-submit-review"]',
    title: "Submit for Review",
    description: "Handoff compliant, audit-ready content to designated reviewers for publication sign-off.",
  },
];

const REVIEWER_STEPS: TourStep[] = [
  {
    target: '[data-tour="nav-reviews"]',
    title: "Review Queue",
    description: "Centralized editorial dashboard of all team content items awaiting formal brand sign-off.",
    actionUrl: "/reviews",
    isNavStep: true,
  },
  {
    target: '[data-tour="tour-review-evidence"]',
    title: "Inspect Evidence Citations",
    description: "Review side-by-side claim verification with primary document excerpts and publication dates.",
  },
  {
    target: '[data-tour="tour-review-actions"]',
    title: "Approve or Reject Submissions",
    description: "Record formal approval decisions or return drafts with itemized remediation guidance.",
  },
  {
    target: '[data-tour="tour-critical-block"]',
    title: "Critical-Finding Safety Lock",
    description: "Automated guardrail: approvals are strictly blocked at the database level while unresolved CRITICAL findings remain.",
  },
  {
    target: '[data-tour="nav-audits"]',
    title: "Audit History & Provenance Trail",
    description: "Inspect historical audit runs, timestamped changes, and complete organizational compliance logs.",
    actionUrl: "/audits",
    isNavStep: true,
  },
];

const MANAGER_STEPS: TourStep[] = [
  {
    target: '[data-tour="nav-knowledge"]',
    title: "Brand Knowledge Vault",
    description: "Manage your organization's single source of truth: approved facts, tone guidelines, and banned terms.",
    actionUrl: "/knowledge",
    isNavStep: true,
  },
  {
    target: '[data-tour="tour-assign-reviewers"]',
    title: "Assign Reviewers",
    description: "Distribute review workloads across team members to maintain rapid publishing velocity.",
  },
  {
    target: '[data-tour="tour-challenges"]',
    title: "Brand Memory Court (Challenges)",
    description: "Adjudicate creator appeals against automated findings and establish official brand precedent.",
  },
  {
    target: '[data-tour="nav-drift"]',
    title: "Brand Drift & Guideline Clarity",
    description: "Identify recurring compliance violations, review appeal telemetry, and refine guideline wording.",
    actionUrl: "/drift",
    isNavStep: true,
  },
  {
    target: '[data-tour="tour-source-documents"]',
    title: "Source Document Verification",
    description: "Upload and verify corporate PDF/DOCX whitepapers to feed candidate facts into the knowledge base.",
  },
];

const ADMIN_STEPS: TourStep[] = [
  {
    target: '[data-tour="nav-team"]',
    title: "Team & Role Access",
    description: "Manage organization memberships, provision Creator / Reviewer / Manager roles, and departments.",
    actionUrl: "/team",
    isNavStep: true,
  },
  {
    target: '[data-tour="nav-settings"]',
    title: "Settings & AI Control",
    description: "Configure Gemini primary and fallback models, test live latency, and toggle rules-only mode.",
    actionUrl: "/settings",
    isNavStep: true,
  },
  {
    target: '[data-tour="tour-admin-override"]',
    title: "Executive Override with Accountability",
    description: "Admins can override critical finding blocks in emergencies by providing an immutable written justification.",
  },
  {
    target: '[data-tour="nav-insights"]',
    title: "Governance Insights",
    description: "Monitor cross-departmental pass rates, turnaround velocity, and audit volume metrics.",
    actionUrl: "/insights",
    isNavStep: true,
  },
];

export function getRoleTourSteps(role: OrgRole): TourStep[] {
  switch (role) {
    case "creator":
      return CREATOR_STEPS;
    case "reviewer":
      return REVIEWER_STEPS;
    case "brand_manager":
      return MANAGER_STEPS;
    case "admin":
      return ADMIN_STEPS;
    default:
      return CREATOR_STEPS;
  }
}

interface TourGuideProps {
  role: OrgRole;
  isActive: boolean;
  onClose: () => void;
  onOpenMobileDrawer?: () => void;
}

export function TourGuide({
  role,
  isActive,
  onClose,
  onOpenMobileDrawer,
}: TourGuideProps) {
  const router = useRouter();
  const [currentStepIndex, setCurrentStepIndex] = React.useState(0);
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);

  const steps = getRoleTourSteps(role);
  const currentStep = steps[currentStepIndex];

  // Focus trap and Escape handling
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isActive) return;
      if (e.key === "Escape") {
        handleSkip();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handleBack();
      }
    }

    if (isActive) {
      document.addEventListener("keydown", handleKeyDown);
      cardRef.current?.focus();
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, currentStepIndex]);

  // Locate and scroll to current target element
  React.useEffect(() => {
    if (!isActive || !currentStep) return;

    // Check if target is in mobile drawer and viewport is small
    const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
    if (isMobile && currentStep.isNavStep && onOpenMobileDrawer) {
      onOpenMobileDrawer();
    }

    const timer = setTimeout(() => {
      const el = document.querySelector(currentStep.target);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        // Reduced motion check
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "nearest",
        });
      } else {
        setTargetRect(null);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isActive, currentStepIndex, currentStep, onOpenMobileDrawer]);

  if (!isActive || !currentStep) return null;

  async function handleFinish() {
    await updateOnboardingAction({
      tours_completed: [role],
    });
    onClose();
    setCurrentStepIndex(0);
  }

  async function handleSkip() {
    await updateOnboardingAction({
      tours_completed: [role],
    });
    onClose();
    setCurrentStepIndex(0);
  }

  function handleNext() {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleFinish();
    }
  }

  function handleBack() {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }

  function handleTrySampleAudit() {
    handleFinish();
    router.push("/studio?sample=scenario-d");
  }

  const isLastStep = currentStepIndex === steps.length - 1;
  const isCreatorLastStep = isLastStep && role === "creator";

  return (
    <div
      role="region"
      aria-label="Interactive Product Tour"
      className="fixed inset-0 z-50 pointer-events-none"
    >
      {/* Target element highlight ring if element is found */}
      {targetRect && (
        <div
          className="fixed pointer-events-none transition-all duration-200 border-2 border-[#16834A] bg-[#B7F28B]/10 z-40"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: "0 0 0 9999px rgba(23, 37, 28, 0.45)",
          }}
        />
      )}

      {/* Tour Card */}
      <div
        ref={cardRef}
        tabIndex={-1}
        className="pointer-events-auto fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 w-84 sm:w-96 max-w-[92vw] bg-[#F4F1E8] brutal-border brutal-shadow p-5 font-mono text-xs focus:outline-none"
      >
        {/* Step indicator header */}
        <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-2 mb-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-[#16834A] inline-block" />
            <span className="font-extrabold text-[10px] text-[#16834A] uppercase tracking-wider">
              {role.replace("_", " ")} TOUR &bull; STEP {currentStepIndex + 1} OF {steps.length}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="p-1 hover:bg-[#D94C4C] hover:text-white transition-colors cursor-pointer"
            aria-label="Skip tour"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-2 mb-4">
          <h3 className="font-extrabold text-sm sm:text-base text-[#17251C] leading-snug">
            {currentStep.title}
          </h3>
          <p className="text-[11px] leading-relaxed text-[#17251C]">
            {currentStep.description}
          </p>
        </div>

        {/* Navigation & Action Buttons */}
        <div className="pt-2 border-t border-[#253C2B] flex items-center justify-between gap-2">
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStepIndex === 0}
              className={`p-1.5 brutal-border text-xs ${
                currentStepIndex === 0
                  ? "opacity-40 cursor-not-allowed bg-gray-100"
                  : "bg-white hover:bg-[#DDEBDD] cursor-pointer"
              }`}
              aria-label="Previous step"
            >
              <ChevronLeft className="w-4 h-4 text-[#17251C]" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 brutal-border bg-white hover:bg-[#DDEBDD] cursor-pointer"
              aria-label="Next step"
            >
              <ChevronRight className="w-4 h-4 text-[#17251C]" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {isCreatorLastStep ? (
              <button
                type="button"
                onClick={handleTrySampleAudit}
                className="px-3 py-1.5 bg-[#16834A] text-white brutal-border font-bold text-[11px] hover:bg-[#126b3c] flex items-center space-x-1 cursor-pointer brutal-shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#B7F28B]" />
                <span>Try a sample audit</span>
              </button>
            ) : isLastStep ? (
              <button
                type="button"
                onClick={handleFinish}
                className="px-3 py-1.5 bg-[#16834A] text-white brutal-border font-bold text-[11px] hover:bg-[#126b3c] flex items-center space-x-1 cursor-pointer brutal-shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#B7F28B]" />
                <span>Done</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="px-3 py-1.5 bg-[#17251C] text-[#B7F28B] brutal-border font-bold text-[11px] hover:bg-black cursor-pointer"
              >
                Next &rarr;
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
