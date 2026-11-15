import * as React from "react";
import { cn } from "@/lib/utils";

export interface IdTagProps extends React.HTMLAttributes<HTMLSpanElement> {
  id: string;
  prefix?: string;
}

export function IdTag({ id, prefix, className, ...props }: IdTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-tight bg-[#F4F1E8] text-[#17251C] brutal-border rounded-[2px]",
        className
      )}
      {...props}
    >
      {prefix && <span className="text-[#637367] mr-0.5">{prefix}</span>}
      <span>{id}</span>
    </span>
  );
}
