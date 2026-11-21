"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { clearUserContextCache } from "@/lib/auth-helpers";

export interface OnboardingState {
  welcome_dismissed?: boolean;
  checklist_dismissed?: boolean;
  tours_completed?: string[];
  [key: string]: unknown;
}

export async function updateOnboardingAction(
  patch: Partial<OnboardingState>
): Promise<{ success: boolean; onboarding?: OnboardingState; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Authentication required to update onboarding state." };
    }

    // Read existing onboarding state for this user
    const { data: profile, error: readError } = await supabase
      .from("profiles")
      .select("onboarding")
      .eq("id", user.id)
      .single();

    if (readError && readError.code !== "PGRST116") {
      return { success: false, error: readError.message };
    }

    const currentOnboarding: OnboardingState =
      profile?.onboarding && typeof profile.onboarding === "object"
        ? (profile.onboarding as OnboardingState)
        : {};

    const mergedOnboarding: OnboardingState = {
      ...currentOnboarding,
      ...patch,
    };

    // Strict security: Update ONLY the authenticated user's own profile row
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ onboarding: mergedOnboarding })
      .eq("id", user.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    clearUserContextCache();
    revalidatePath("/overview");
    revalidatePath("/(app)", "layout");

    return { success: true, onboarding: mergedOnboarding };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update onboarding state";
    return { success: false, error: message };
  }
}
