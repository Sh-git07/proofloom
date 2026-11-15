import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatusLEDProps extends React.HTMLAttributes<HTMLDivElement> {
  status: "live" | "demo" | "processing" | "critical" | "idle";
  label?: string;
  size?: "sm" | "md" | "lg";
}

export function StatusLED({ status, label, size = "md", className, ...props }: StatusLEDProps) {
  const sizeMap = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
    lg: "w-3 h-3",
  };

  const ledClass = {
    live: "status-led status-led-live",
    demo: "status-led status-led-demo",
    processing: "status-led bg-[#16834A] animate-pulse shadow-[0_0_6px_#16834A]",
    critical: "status-led status-led-critical",
    idle: "status-led bg-[#637367]",
  };

  const textClass = {
    live: "text-[#16834A]",
    demo: "text-[#E6A23C]",
    processing: "text-[#16834A]",
    critical: "text-[#D94C4C]",
    idle: "text-[#637367]",
  };

  return (
    <div className={cn("inline-flex items-center space-x-2 font-mono text-xs font-bold", className)} {...props}>
      <span className={cn(sizeMap[size], ledClass[status])} />
      {label && <span className={textClass[status]}>{label}</span>}
    </div>
  );
}
