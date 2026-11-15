"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { canManageSettings } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export interface UpdateSettingsParams {
  aiExternalAllowed: boolean;
  scoringWeights: {
    voice: number;
    claims: number;
    terminology: number;
    accessibility: number;
    visual: number;
  };
  scoringDeductions: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
    INFO: number;
  };
  claimTolerancePercentage: number;
  retentionDays: number;
}

export async function updateOrganisationSettingsAction(params: UpdateSettingsParams) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageSettings(context.role)) {
    throw new Error("Admin privileges required to update organisation governance settings.");
  }

  // Validate weights sum to 100
  const weights = params.scoringWeights;
  const totalWeight =
    weights.voice + weights.claims + weights.terminology + weights.accessibility + weights.visual;
  if (totalWeight !== 100) {
    throw new Error(`Scoring weights must sum to exactly 100% (currently ${totalWeight}%).`);
  }

  if (params.claimTolerancePercentage < 0 || params.claimTolerancePercentage > 50) {
    throw new Error("Claim tolerance percentage must be between 0% and 50%.");
  }

  if (params.retentionDays < 30) {
    throw new Error("Retention period cannot be less than 30 days.");
  }

  const supabase = await createClient();
  const orgId = context.organisation.id;

  const { error } = await supabase
    .from("organisation_settings")
    .upsert(
      {
        organisation_id: orgId,
        ai_external_allowed: params.aiExternalAllowed,
        scoring_weights: params.scoringWeights,
        scoring_deductions: params.scoringDeductions,
        claim_tolerance_percentage: params.claimTolerancePercentage,
        retention_days: params.retentionDays,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organisation_id" }
    );

  if (error) {
    throw new Error(`Failed to save settings: ${error.message}`);
  }

  // Log activity
  await supabase.from("activity_logs").insert({
    organisation_id: orgId,
    actor_id: context.user.id,
    action: "settings_updated",
    target_type: "organisation_settings",
    target_id: orgId,
    details: {
      ai_external_allowed: params.aiExternalAllowed,
      claim_tolerance_percentage: params.claimTolerancePercentage,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/overview");
  revalidatePath("/studio");
  return { success: true };
}
