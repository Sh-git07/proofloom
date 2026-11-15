import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "lime" | "primary" | "critical" | "amber" | "muted" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "bg-[#17251C] text-white",
    lime: "bg-[#B7F28B] text-[#17251C]",
    primary: "bg-[#16834A] text-white",
    critical: "bg-[#D94C4C] text-white",
    amber: "bg-[#E6A23C] text-[#17251C]",
    muted: "bg-[#DDEBDD] text-[#17251C]",
    outline: "bg-transparent text-[#17251C]",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-[2px] brutal-border px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wider",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
