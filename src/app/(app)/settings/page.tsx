import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { SettingsWorkbench, SettingsData } from "@/components/settings/SettingsWorkbench";

export default async function SettingsPage() {
  const context = await getCurrentUserContext();
  const supabase = await createClient();
  const orgId = context?.organisation.id;

  const aiProvider = process.env.AI_PROVIDER || "gemini";
  const aiModel = process.env.AI_MODEL || "gemini-2.5-flash";
  const isApiKeyConfigured = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5
  );

  // Fetch organisation settings
  const { data: dbSettings } = await supabase
    .from("organisation_settings")
    .select("*")
    .eq("organisation_id", orgId)
    .maybeSingle();

  const settings: SettingsData = {
    ai_external_allowed: dbSettings?.ai_external_allowed ?? true,
    scoring_weights: (dbSettings?.scoring_weights as SettingsData["scoring_weights"]) || {
      voice: 25,
      claims: 35,
      terminology: 20,
      accessibility: 10,
      visual: 10,
    },
    scoring_deductions: (dbSettings?.scoring_deductions as SettingsData["scoring_deductions"]) || {
      CRITICAL: 25,
      HIGH: 15,
      MEDIUM: 8,
      LOW: 3,
      INFO: 0,
    },
    claim_tolerance_percentage: dbSettings?.claim_tolerance_percentage ?? 5.0,
    retention_days: dbSettings?.retention_days ?? 365,
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="border-b-2 border-[#253C2B] pb-4">
        <span className="font-mono text-xs font-bold text-[#16834A] uppercase tracking-wider">
          10 &mdash; GOVERNANCE SETTINGS
        </span>
        <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
          ORGANISATION & ENGINE SETTINGS
        </h1>
        <p className="text-xs sm:text-sm text-[#637367]">
          Audit thresholds, scoring weights, external AI data disclosure, and retention policies for {context?.organisation.name}.
        </p>
      </div>

      <SettingsWorkbench
        initialSettings={settings}
        userRole={context?.role || "viewer"}
        activeAiProvider={aiProvider}
        activeAiModel={aiModel}
        isApiKeyConfigured={isApiKeyConfigured}
      />
    </div>
  );
}
