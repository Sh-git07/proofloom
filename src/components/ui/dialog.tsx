"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Neo-brutalist Solid Backdrop (No glassmorphism, no blur) */}
      <div
        className="fixed inset-0 bg-[#17251C]/60"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-50 w-full max-w-lg bg-white brutal-border brutal-shadow-lg rounded-[2px] p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 p-1 brutal-border bg-[#F4F1E8] hover:bg-[#D94C4C] hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 border-b-2 border-[#253C2B] pb-3 mb-4", className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("font-mono font-extrabold text-base uppercase text-[#17251C]", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-[#637367]", className)} {...props} />;
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-end space-x-2 border-t-2 border-[#253C2B] pt-4 mt-6", className)}
      {...props}
    />
  );
}
