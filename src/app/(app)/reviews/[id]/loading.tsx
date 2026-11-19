import { RefreshCw } from "lucide-react";

export default function ReviewDetailLoading() {
  return (
    <div className="min-h-[500px] flex flex-col items-center justify-center p-8 space-y-4 font-mono text-center">
      <RefreshCw className="w-8 h-8 text-[#16834A] animate-spin" />
      <span className="text-sm font-bold text-[#17251C] uppercase tracking-wider">
        LOADING REVIEW WORKBENCH & FINDINGS...
      </span>
      <p className="text-xs text-[#637367]">
        Retrieving version history, audit evidence, reviewer assignments, and decision history.
      </p>
    </div>
  );
}
