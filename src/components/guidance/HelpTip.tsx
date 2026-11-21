"use client";

import * as React from "react";
import Link from "next/link";
import { HelpCircle, X } from "lucide-react";

interface HelpTipProps {
  text: string | string[];
  articleHash?: string;
  articleLabel?: string;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

export function HelpTip({
  text,
  articleHash,
  articleLabel = "Learn more in Help Centre",
  className = "",
  side = "top",
}: HelpTipProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const lines = Array.isArray(text) ? text : [text];

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const popoverPosition =
    side === "bottom"
      ? "top-full mt-2 left-1/2 -translate-x-1/2"
      : side === "left"
      ? "right-full mr-2 top-1/2 -translate-y-1/2"
      : side === "right"
      ? "left-full ml-2 top-1/2 -translate-y-1/2"
      : "bottom-full mb-2 left-1/2 -translate-x-1/2";

  return (
    <div ref={containerRef} className={`relative inline-flex items-center align-middle ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="Contextual Help Tip"
        className="w-4 h-4 rounded-none bg-[#F4F1E8] hover:bg-[#DDEBDD] text-[#17251C] hover:text-[#16834A] border border-[#253C2B] inline-flex items-center justify-center font-mono text-[10px] font-bold focus:outline-none focus:ring-1 focus:ring-[#16834A] cursor-pointer transition-colors"
      >
        <HelpCircle className="w-3 h-3" />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          className={`absolute ${popoverPosition} z-50 w-72 max-w-[90vw] p-3 bg-white brutal-border brutal-shadow text-left font-mono text-xs`}
        >
          <div className="flex items-start justify-between gap-2 mb-2 pb-1.5 border-b border-[#253C2B]">
            <span className="font-extrabold text-[10px] text-[#16834A] uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-[#16834A] inline-block" />
              GUIDANCE NOTE
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-0.5 hover:bg-[#F4F1E8] text-[#17251C] focus:outline-none"
              aria-label="Close help tip"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 text-[11px] leading-relaxed text-[#17251C]">
            {lines.map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </div>

          {articleHash && (
            <div className="mt-2.5 pt-2 border-t border-[#E5E2D9] flex justify-end">
              <Link
                href={`/help#${articleHash}`}
                onClick={() => setIsOpen(false)}
                className="text-[10px] font-bold text-[#16834A] hover:underline flex items-center gap-1"
              >
                <span>{articleLabel}</span>
                <span>&rarr;</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
