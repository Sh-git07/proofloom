import { Sliders, Cpu } from "lucide-react";

export default async function SettingsPage() {
  const aiProvider = process.env.AI_PROVIDER || "gemini";
  const aiModel = process.env.AI_MODEL || "gemini-2.5-flash";
  const isAiLive = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="border-b-2 border-[#253C2B] pb-4">
        <span className="font-mono text-xs font-bold text-[#16834A] uppercase tracking-wider">
          10 &mdash; GOVERNANCE SETTINGS
        </span>
        <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
          ORGANISATION & ENGINE SETTINGS
        </h1>
        <p className="text-xs sm:text-sm text-[#637367]">
          Audit thresholds, scoring weights, external AI data disclosure, and retention policies.
        </p>
      </div>

      {/* AI Engine Status Card */}
      <div className="brutal-card p-6 bg-white space-y-4">
        <div className="flex items-center justify-between border-b border-[#253C2B] pb-2">
          <span className="font-mono text-xs font-bold text-[#17251C] uppercase flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-[#16834A]" />
            <span>AI ANALYSIS ENGINE CONFIGURATION</span>
          </span>
          <span
            className={`font-mono text-[10px] font-bold px-2 py-0.5 brutal-border ${
              isAiLive ? "bg-[#B7F28B] text-[#17251C]" : "bg-[#E6A23C] text-[#17251C]"
            }`}
          >
            {isAiLive ? "LIVE AI CONNECTED" : "DEMO RULE-BASED MODE"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
          <div className="p-3 bg-[#F4F1E8] brutal-border">
            <span className="text-[#637367] block">ACTIVE PROVIDER:</span>
            <span className="font-bold text-[#17251C] text-sm uppercase">{aiProvider}</span>
          </div>
          <div className="p-3 bg-[#F4F1E8] brutal-border">
            <span className="text-[#637367] block">MODEL ID:</span>
            <span className="font-bold text-[#17251C] text-sm">{aiModel}</span>
          </div>
        </div>

        {/* AI External Disclosure Notice */}
        <div className="p-3 bg-[#DDEBDD] brutal-border text-xs">
          <span className="font-bold text-[#16834A] block mb-1 font-mono uppercase">
            EXTERNAL AI DATA PRIVACY DISCLOSURE:
          </span>
          <p className="text-[#17251C] leading-relaxed">
            When enabled, submitted content excerpts and relevant approved knowledge are sent to the configured AI provider for analysis. Do not enable for confidential content unless your policy allows it.
          </p>
        </div>
      </div>

      {/* Scoring Weights */}
      <div className="brutal-card p-6 bg-white space-y-4">
        <div className="flex items-center justify-between border-b border-[#253C2B] pb-2">
          <span className="font-mono text-xs font-bold text-[#17251C] uppercase flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-[#16834A]" />
            <span>CONFIGURABLE SCORING WEIGHTS</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs text-center">
          <div className="p-3 bg-[#F4F1E8] brutal-border">
            <span className="text-[#637367] block">CLAIMS</span>
            <span className="font-bold text-[#16834A] text-lg">35%</span>
          </div>
          <div className="p-3 bg-[#F4F1E8] brutal-border">
            <span className="text-[#637367] block">VOICE</span>
            <span className="font-bold text-[#16834A] text-lg">25%</span>
          </div>
          <div className="p-3 bg-[#F4F1E8] brutal-border">
            <span className="text-[#637367] block">TERMINOLOGY</span>
            <span className="font-bold text-[#16834A] text-lg">20%</span>
          </div>
          <div className="p-3 bg-[#F4F1E8] brutal-border">
            <span className="text-[#637367] block">ACCESSIBILITY</span>
            <span className="font-bold text-[#16834A] text-lg">10%</span>
          </div>
          <div className="p-3 bg-[#F4F1E8] brutal-border">
            <span className="text-[#637367] block">VISUAL</span>
            <span className="font-bold text-[#16834A] text-lg">10%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
