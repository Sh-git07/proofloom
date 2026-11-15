import * as React from "react";
import { cn } from "@/lib/utils";

export interface MetricPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  status?: "normal" | "warning" | "critical" | "success";
  badge?: string;
  interactive?: boolean;
}

export function MetricPanel({
  label,
  value,
  unit,
  subtext,
  status = "normal",
  badge,
  interactive = false,
  className,
  ...props
}: MetricPanelProps) {
  const valueColor = {
    normal: "text-[#17251C]",
    success: "text-[#16834A]",
    warning: "text-[#E6A23C]",
    critical: "text-[#D94C4C]",
  };

  return (
    <div
      className={cn(
        "brutal-panel bg-white p-4 flex flex-col justify-between",
        interactive && "brutal-interactive cursor-pointer",
        className
      )}
      {...props}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#253C2B]/15 pb-2 mb-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#637367]">
          {label}
        </span>
        {badge && (
          <span className="font-mono text-[9px] font-extrabold px-1.5 py-0.2 bg-[#F4F1E8] border border-[#253C2B] text-[#17251C]">
            {badge}
          </span>
        )}
      </div>

      {/* Main Metric Value */}
      <div className="my-1 flex items-baseline space-x-1.5">
        <span
          className={cn(
            "font-mono font-extrabold text-3xl sm:text-4xl tracking-tight",
            valueColor[status]
          )}
        >
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs font-bold text-[#637367]">
            {unit}
          </span>
        )}
      </div>

      {/* Subtext */}
      {subtext && (
        <div className="pt-2 mt-auto border-t border-[#253C2B]/10 font-mono text-[10px] text-[#637367] flex items-center justify-between">
          <span>{subtext}</span>
        </div>
      )}
    </div>
  );
}
