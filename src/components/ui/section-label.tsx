import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  number?: string;
  title: string;
}

export function SectionLabel({ number, title, className, ...props }: SectionLabelProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center space-x-1.5 font-mono text-xs font-bold text-[#16834A] uppercase tracking-wider",
        className
      )}
      {...props}
    >
      {number && <span>{number} &mdash;</span>}
      <span>{title}</span>
    </div>
  );
}
