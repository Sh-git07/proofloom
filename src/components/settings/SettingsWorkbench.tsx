"use client";

import * as React from "react";
import Link from "next/link";
import {
  Cpu,
  Sliders,
  ShieldAlert,
  Clock,
  Check,
  AlertCircle,
  RefreshCw,
  Lock,
} from "lucide-react";
import { updateOrganisationSettingsAction, UpdateSettingsParams } from "@/app/actions/settings";

export interface SettingsData {
  ai_external_allowed: boolean;
  scoring_weights: {
    voice: number;
    claims: number;
    terminology: number;
    accessibility: number;
    visual: number;
  };
  scoring_deductions: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    INFO: number;
  };
  claim_tolerance_percentage: number;
  retention_days: number;
}

export function SettingsWorkbench({
  initialSettings,
  userRole,
  activeAiProvider,
  activeAiModel,
  fallbackAiModel = "gemini-3.1-flash-lite",
  isApiKeyConfigured,
}: {
  initialSettings: SettingsData;
  userRole: string;
  activeAiProvider: string;
  activeAiModel: string;
  fallbackAiModel?: string;
  isApiKeyConfigured: boolean;
}) {
  const isAdmin = userRole === "admin";

  const [aiExternalAllowed, setAiExternalAllowed] = React.useState(
    initialSettings.ai_external_allowed
  );
  const [weights, setWeights] = React.useState(initialSettings.scoring_weights);
  const [deductions, setDeductions] = React.useState(initialSettings.scoring_deductions);
  const [tolerance, setTolerance] = React.useState(
    initialSettings.claim_tolerance_percentage || 5.0
  );
  const [retentionDays, setRetentionDays] = React.useState(
    initialSettings.retention_days || 365
  );

  const [isSaving, setIsSaving] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Live AI Health State
  const [health, setHealth] = React.useState<{
    loading: boolean;
    model: string;
    status: string;
    httpStatus: number;
    latencyMs: number;
    message: string;
    isHealthy: boolean;
    lastChecked: string | null;
  }>({
    loading: false,
    model: activeAiModel,
    status: "CHECKING",
    httpStatus: 0,
    latencyMs: 0,
    message: "Verifying live Gemini model status...",
    isHealthy: true,
    lastChecked: null,
  });

  const checkHealth = React.useCallback(async () => {
    setHealth((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch("/api/ai/health");
      const data = await res.json();
      setHealth({
        loading: false,
        model: data.model || activeAiModel,
        status: data.status,
        httpStatus: data.httpStatus,
        latencyMs: data.latencyMs,
        message: data.message,
        isHealthy: Boolean(data.isHealthy),
        lastChecked: new Date().toLocaleTimeString(),
      });
    } catch (err: unknown) {
      setHealth({
        loading: false,
        model: activeAiModel,
        status: "ERROR",
        httpStatus: 0,
        latencyMs: 0,
        message: err instanceof Error ? err.message : "Health check request failed",
        isHealthy: false,
        lastChecked: new Date().toLocaleTimeString(),
      });
    }
  }, [activeAiModel]);

  React.useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const totalWeight =
    (weights.voice || 0) +
    (weights.claims || 0) +
    (weights.terminology || 0) +
    (weights.accessibility || 0) +
    (weights.visual || 0);

  const isWeightsValid = totalWeight === 100;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!isWeightsValid) {
      setFeedback({
        type: "error",
        message: `Scoring weights must sum to exactly 100% (currently ${totalWeight}%).`,
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const payload: UpdateSettingsParams = {
        aiExternalAllowed,
        scoringWeights: weights,
        scoringDeductions: deductions,
        claimTolerancePercentage: Number(tolerance),
        retentionDays: Number(retentionDays),
      };

      await updateOrganisationSettingsAction(payload);
      setFeedback({ type: "success", message: "Organisation settings updated successfully." });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to save settings",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Role permission banner */}
      {!isAdmin && (
        <div className="p-4 bg-[#E6A23C]/15 brutal-border flex items-center justify-between text-xs font-mono text-[#17251C]">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-[#E6A23C]" />
            <span>
              READ-ONLY MODE: You are signed in as <strong>{userRole.toUpperCase()}</strong>. Administrative privileges are required to modify settings.
            </span>
          </div>
          <Link
            href="/demo"
            className="px-2.5 py-1 bg-[#17251C] text-white brutal-border font-bold text-[10px] uppercase hover:bg-[#16834A]"
          >
            SWITCH TO ADMIN
          </Link>
        </div>
      )}

      {feedback && (
        <div
          className={`p-3 brutal-border text-xs font-mono flex items-center space-x-2 ${
            feedback.type === "success"
              ? "bg-[#B7F28B] text-[#17251C]"
              : "bg-[#D94C4C] text-white"
          }`}
        >
          {feedback.type === "success" ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* 1. AI Analysis Engine & External Disclosure */}
      <div className="brutal-card p-6 bg-white space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-3">
          <span className="font-mono text-xs font-bold text-[#17251C] uppercase flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-[#16834A]" />
            <span>AI ANALYSIS ENGINE CONFIGURATION</span>
          </span>
          <span
            className={`font-mono text-[10px] font-bold px-2 py-0.5 brutal-border ${
              isApiKeyConfigured && aiExternalAllowed
                ? "bg-[#B7F28B] text-[#17251C]"
                : "bg-[#E6A23C] text-[#17251C]"
            }`}
          >
            {isApiKeyConfigured && aiExternalAllowed
              ? "LIVE EXTERNAL AI ACTIVE"
              : "DEMO / DETERMINISTIC MODE"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
          <div className="p-3 bg-[#F4F1E8] brutal-border">
            <span className="text-[#637367] block text-[10px] uppercase">ACTIVE PROVIDER</span>
            <span className="font-bold text-[#17251C] text-sm uppercase">{activeAiProvider}</span>
          </div>
          <div className="p-3 bg-[#F4F1E8] brutal-border">
            <span className="text-[#637367] block text-[10px] uppercase">PRIMARY MODEL (AI_MODEL)</span>
            <span className="font-bold text-[#17251C] text-sm">{activeAiModel}</span>
          </div>
          <div className="p-3 bg-[#F4F1E8] brutal-border">
            <span className="text-[#637367] block text-[10px] uppercase">FALLBACK (AI_FALLBACK_MODEL)</span>
            <span className="font-bold text-[#17251C] text-sm">{fallbackAiModel}</span>
          </div>
        </div>

        {/* Live AI Health Check Card */}
        <div className="p-4 bg-[#F4F1E8] brutal-border space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  health.isHealthy ? "bg-[#16834A] animate-pulse" : "bg-[#D94C4C]"
                }`}
              />
              <span className="font-bold text-[#17251C] uppercase">
                LIVE AI HEALTH CHECK
              </span>
            </div>
            <button
              type="button"
              onClick={checkHealth}
              disabled={health.loading}
              className="px-2.5 py-1 bg-white brutal-border font-bold text-[10px] uppercase flex items-center space-x-1.5 hover:bg-[#B7F28B] transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${health.loading ? "animate-spin" : ""}`} />
              <span>{health.loading ? "CHECKING..." : "RE-CHECK HEALTH"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-2.5 bg-white brutal-border">
              <span className="text-[#637367] text-[10px] block uppercase">PRIMARY MODEL</span>
              <span className="font-bold text-[#17251C] text-xs block truncate">{activeAiModel}</span>
            </div>
            <div className="p-2.5 bg-white brutal-border">
              <span className="text-[#637367] text-[10px] block uppercase">FALLBACK MODEL</span>
              <span className="font-bold text-[#17251C] text-xs block truncate">{fallbackAiModel}</span>
            </div>
            <div className="p-2.5 bg-white brutal-border">
              <span className="text-[#637367] text-[10px] block uppercase">LAST CALL STATUS</span>
              <span
                className={`font-bold text-xs ${
                  health.isHealthy ? "text-[#16834A]" : "text-[#D94C4C]"
                }`}
              >
                {health.status} {health.httpStatus > 0 ? `(HTTP ${health.httpStatus})` : ""}
              </span>
            </div>
            <div className="p-2.5 bg-white brutal-border">
              <span className="text-[#637367] text-[10px] block uppercase">RESPONSE LATENCY</span>
              <span className="font-bold text-[#17251C] text-xs">
                {health.latencyMs > 0 ? `${health.latencyMs}ms` : "--"}{" "}
                {health.lastChecked ? `at ${health.lastChecked}` : ""}
              </span>
            </div>
          </div>

          <div
            className={`p-2.5 brutal-border text-[11px] ${
              health.isHealthy
                ? "bg-[#DDEBDD] text-[#16834A]"
                : "bg-[#F8D7DA] text-[#721C24]"
            }`}
          >
            <span className="font-bold">
              {health.isHealthy ? "STATUS: " : "ALERT: "}
            </span>
            <span>{health.message}</span>
          </div>
        </div>

        {/* External AI Toggle */}
        <div className="p-4 bg-[#F4F1E8] brutal-border flex items-start justify-between gap-4 font-mono text-xs">
          <div className="space-y-1">
            <span className="font-bold text-[#17251C] block uppercase">
              ALLOW EXTERNAL AI API REQUESTS
            </span>
            <p className="text-[11px] text-[#637367] max-w-xl">
              When enabled, submitted document text is processed via Google Gemini REST API. When disabled, the platform strictly uses deterministic offline rule-based verification with zero external data egress.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              disabled={!isAdmin}
              checked={aiExternalAllowed}
              onChange={(e) => setAiExternalAllowed(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[#DDEBDD] peer-focus:outline-none brutal-border rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#253C2B] after:border-2 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#16834A]"></div>
          </label>
        </div>

        {/* Data Privacy Disclosure */}
        <div className="p-3 bg-[#DDEBDD] brutal-border text-xs font-mono space-y-1">
          <span className="font-bold text-[#16834A] block uppercase">
            PRIVACY & CONFIDENTIALITY SAFEGUARD:
          </span>
          <p className="text-[#17251C] text-[11px] leading-relaxed">
            PROOFLOOM does not use your submitted brand knowledge or drafts to train public AI models. All API payloads are strictly transient and governed by your organization&apos;s zero-retention enterprise terms.
          </p>
        </div>
      </div>

      {/* 2. Scoring Dimension Weights */}
      <div className="brutal-card p-6 bg-white space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-3">
          <span className="font-mono text-xs font-bold text-[#17251C] uppercase flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-[#16834A]" />
            <span>SCORING DIMENSION WEIGHTS</span>
          </span>
          <span
            className={`font-mono text-xs font-bold px-2 py-0.5 brutal-border ${
              isWeightsValid ? "bg-[#B7F28B] text-[#17251C]" : "bg-[#D94C4C] text-white"
            }`}
          >
            TOTAL: {totalWeight}% / 100%
          </span>
        </div>

        <p className="font-mono text-xs text-[#637367]">
          Calibrate the relative importance of each dimension in the 100-point transparent scoring algorithm. Weights must sum to exactly 100%.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs">
          <div className="p-3 bg-[#F4F1E8] brutal-border space-y-1">
            <label className="text-[#637367] block text-[10px] uppercase font-bold">
              CLAIMS (%)
            </label>
            <input
              type="number"
              disabled={!isAdmin}
              min={0}
              max={100}
              value={weights.claims}
              onChange={(e) =>
                setWeights({ ...weights, claims: parseInt(e.target.value) || 0 })
              }
              className="w-full p-1.5 bg-white brutal-border font-bold text-center text-sm"
            />
          </div>

          <div className="p-3 bg-[#F4F1E8] brutal-border space-y-1">
            <label className="text-[#637367] block text-[10px] uppercase font-bold">
              VOICE (%)
            </label>
            <input
              type="number"
              disabled={!isAdmin}
              min={0}
              max={100}
              value={weights.voice}
              onChange={(e) =>
                setWeights({ ...weights, voice: parseInt(e.target.value) || 0 })
              }
              className="w-full p-1.5 bg-white brutal-border font-bold text-center text-sm"
            />
          </div>

          <div className="p-3 bg-[#F4F1E8] brutal-border space-y-1">
            <label className="text-[#637367] block text-[10px] uppercase font-bold">
              TERMINOLOGY (%)
            </label>
            <input
              type="number"
              disabled={!isAdmin}
              min={0}
              max={100}
              value={weights.terminology}
              onChange={(e) =>
                setWeights({ ...weights, terminology: parseInt(e.target.value) || 0 })
              }
              className="w-full p-1.5 bg-white brutal-border font-bold text-center text-sm"
            />
          </div>

          <div className="p-3 bg-[#F4F1E8] brutal-border space-y-1">
            <label className="text-[#637367] block text-[10px] uppercase font-bold">
              ACCESSIBILITY (%)
            </label>
            <input
              type="number"
              disabled={!isAdmin}
              min={0}
              max={100}
              value={weights.accessibility}
              onChange={(e) =>
                setWeights({ ...weights, accessibility: parseInt(e.target.value) || 0 })
              }
              className="w-full p-1.5 bg-white brutal-border font-bold text-center text-sm"
            />
          </div>

          <div className="p-3 bg-[#F4F1E8] brutal-border space-y-1">
            <label className="text-[#637367] block text-[10px] uppercase font-bold">
              VISUAL (%)
            </label>
            <input
              type="number"
              disabled={!isAdmin}
              min={0}
              max={100}
              value={weights.visual}
              onChange={(e) =>
                setWeights({ ...weights, visual: parseInt(e.target.value) || 0 })
              }
              className="w-full p-1.5 bg-white brutal-border font-bold text-center text-sm"
            />
          </div>
        </div>
      </div>

      {/* 3. Severity Deduction Points & Tolerance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity Deductions */}
        <div className="brutal-card p-6 bg-white space-y-4 font-mono text-xs">
          <div className="border-b-2 border-[#253C2B] pb-2">
            <span className="font-bold text-[#17251C] uppercase flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-[#D94C4C]" />
              <span>SEVERITY DEDUCTIONS (PTS)</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-2.5 bg-[#F4F1E8] brutal-border space-y-1">
              <span className="text-[10px] text-[#D94C4C] font-bold block uppercase">
                CRITICAL DEDUCTION
              </span>
              <input
                type="number"
                disabled={!isAdmin}
                value={deductions.CRITICAL}
                onChange={(e) =>
                  setDeductions({ ...deductions, CRITICAL: parseInt(e.target.value) || 0 })
                }
                className="w-full p-1 bg-white brutal-border text-center font-bold"
              />
            </div>

            <div className="p-2.5 bg-[#F4F1E8] brutal-border space-y-1">
              <span className="text-[10px] text-[#E6A23C] font-bold block uppercase">
                HIGH DEDUCTION
              </span>
              <input
                type="number"
                disabled={!isAdmin}
                value={deductions.HIGH}
                onChange={(e) =>
                  setDeductions({ ...deductions, HIGH: parseInt(e.target.value) || 0 })
                }
                className="w-full p-1 bg-white brutal-border text-center font-bold"
              />
            </div>

            <div className="p-2.5 bg-[#F4F1E8] brutal-border space-y-1">
              <span className="text-[10px] text-[#16834A] font-bold block uppercase">
                MEDIUM DEDUCTION
              </span>
              <input
                type="number"
                disabled={!isAdmin}
                value={deductions.MEDIUM}
                onChange={(e) =>
                  setDeductions({ ...deductions, MEDIUM: parseInt(e.target.value) || 0 })
                }
                className="w-full p-1 bg-white brutal-border text-center font-bold"
              />
            </div>

            <div className="p-2.5 bg-[#F4F1E8] brutal-border space-y-1">
              <span className="text-[10px] text-[#637367] font-bold block uppercase">
                LOW DEDUCTION
              </span>
              <input
                type="number"
                disabled={!isAdmin}
                value={deductions.LOW}
                onChange={(e) =>
                  setDeductions({ ...deductions, LOW: parseInt(e.target.value) || 0 })
                }
                className="w-full p-1 bg-white brutal-border text-center font-bold"
              />
            </div>
          </div>
        </div>

        {/* Claim Tolerance & Data Retention */}
        <div className="brutal-card p-6 bg-white space-y-4 font-mono text-xs">
          <div className="border-b-2 border-[#253C2B] pb-2">
            <span className="font-bold text-[#17251C] uppercase flex items-center space-x-2">
              <Clock className="w-4 h-4 text-[#16834A]" />
              <span>TOLERANCE & RETENTION POLICIES</span>
            </span>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-[#F4F1E8] brutal-border space-y-1">
              <label className="text-[10px] text-[#637367] font-bold block uppercase">
                NUMERICAL CLAIM TOLERANCE (%)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  max={50}
                  disabled={!isAdmin}
                  value={tolerance}
                  onChange={(e) => setTolerance(parseFloat(e.target.value) || 0)}
                  className="w-24 p-1.5 bg-white brutal-border font-bold text-center"
                />
                <span className="text-[11px] text-[#637367]">
                  Allowable variance before flagging numeric mismatch as OUTDATED / CONTRADICTED.
                </span>
              </div>
            </div>

            <div className="p-3 bg-[#F4F1E8] brutal-border space-y-1">
              <label className="text-[10px] text-[#637367] font-bold block uppercase">
                AUDIT HISTORY RETENTION (DAYS)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={30}
                  max={3650}
                  disabled={!isAdmin}
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(parseInt(e.target.value) || 365)}
                  className="w-24 p-1.5 bg-white brutal-border font-bold text-center"
                />
                <span className="text-[11px] text-[#637367]">
                  Automated retention duration for historical audits and immutable activity logs.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      {isAdmin && (
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving || !isWeightsValid}
            className="px-6 py-2.5 bg-[#16834A] text-white brutal-border font-mono text-xs font-bold brutal-shadow flex items-center space-x-2 cursor-pointer hover:bg-[#17251C] transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>SAVING SETTINGS...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>SAVE GOVERNANCE SETTINGS</span>
              </>
            )}
          </button>
        </div>
      )}
    </form>
  );
}
