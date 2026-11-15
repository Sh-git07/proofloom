import * as React from "react";
import { cn } from "@/lib/utils";

export type SeverityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface SeverityChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  severity: SeverityLevel;
  count?: number;
}

export function SeverityChip({ severity, count, className, ...props }: SeverityChipProps) {
  const styles = {
    CRITICAL: "bg-[#D94C4C] text-white border-2 border-[#253C2B] font-extrabold",
    HIGH: "bg-[#E6A23C] text-[#17251C] border-2 border-[#253C2B] font-extrabold",
    MEDIUM: "bg-white text-[#16834A] border-2 border-[#16834A] font-extrabold",
    LOW: "bg-[#DDEBDD] text-[#17251C] border-2 border-[#253C2B] font-bold",
    INFO: "bg-white text-[#637367] border-2 border-[#637367] font-bold",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center space-x-1 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider rounded-[2px]",
        styles[severity],
        className
      )}
      {...props}
    >
      <span>{severity}</span>
      {count !== undefined && (
        <span className="ml-1 px-1 py-0.2 bg-black/10 rounded-[1px] font-mono">
          {count}
        </span>
      )}
    </span>
  );
}
