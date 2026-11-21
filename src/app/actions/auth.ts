"use server";

import { createClient } from "@/lib/supabase/server";
import { clearUserContextCache, getCurrentUserContext } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function signInDemoUser(role: "admin" | "brand_manager" | "creator" | "reviewer") {
  const isDemoEnabled = process.env.DEMO_MODE_ENABLED === "true" || process.env.DEMO_MODE_ENABLED === "1";
  if (!isDemoEnabled) {
    throw new Error("Demo mode is disabled");
  }

  const roleEmails: Record<string, string> = {
    admin: "admin.demo@example.com",
    brand_manager: "manager.demo@example.com",
    creator: "creator.demo@example.com",
    reviewer: "reviewer.demo@example.com",
  };

  const email = roleEmails[role];
  const password = process.env.DEMO_PASSWORD || "ChangeMe-Demo-2026!";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Demo login error:", error.message);
    throw new Error(`Failed to sign in as ${role}: ${error.message}`);
  }

  redirect("/overview");
}

export async function signInWithEmail(formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("invalid login credentials")) {
      return { error: "Invalid email or password. Please verify your credentials or sign up." };
    }
    return { error: error.message };
  }

  clearUserContextCache();
  redirect("/overview");
}

export interface SignUpActionInput {
  fullName: string;
  organisationName: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

export async function signUpWithEmailAction(input: SignUpActionInput): Promise<{
  success: boolean;
  requiresEmailConfirmation?: boolean;
  redirectUrl?: string;
  error?: string;
}> {
  const fullName = input.fullName?.trim();
  const organisationName = input.organisationName?.trim();
  const email = input.email?.trim()?.toLowerCase();
  const password = input.password;

  if (!fullName || fullName.length < 2) {
    return { success: false, error: "Full name must be at least 2 characters." };
  }
  if (!organisationName || organisationName.length < 2) {
    return { success: false, error: "Organisation name must be at least 2 characters." };
  }
  if (!email || !email.includes("@")) {
    return { success: false, error: "Please provide a valid email address." };
  }
  if (!password || password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters long." };
  }
  if (input.confirmPassword && password !== input.confirmPassword) {
    return { success: false, error: "Passwords do not match." };
  }

  try {
    const supabase = await createClient();

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          organisation_name: organisationName,
        },
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("already in use") || error.status === 422) {
        return {
          success: false,
          error: "This email is already registered. Please sign in or use a different email.",
        };
      }
      if (msg.includes("weak") || msg.includes("password")) {
        return {
          success: false,
          error: "Password is too weak. Please use at least 8 characters with a mix of letters and numbers.",
        };
      }
      return { success: false, error: error.message };
    }

    // If session is immediately available (email confirmation disabled or instant login)
    if (data.session && data.user) {
      const { error: rpcError } = await supabase.rpc("create_user_organisation", {
        p_full_name: fullName,
        p_org_name: organisationName,
      });

      if (rpcError) {
        console.error("RPC create_user_organisation error:", rpcError);
        return { success: false, error: `Account created, but setup failed: ${rpcError.message}` };
      }

      clearUserContextCache();
      return { success: true, requiresEmailConfirmation: false, redirectUrl: "/overview" };
    }

    // Email confirmation is on
    return {
      success: true,
      requiresEmailConfirmation: true,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create account";
    return { success: false, error: message };
  }
}

export async function requestPasswordResetAction(email: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const cleanEmail = email?.trim()?.toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { success: false, error: "Please provide a valid email address." };
  }

  try {
    const supabase = await createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${siteUrl}/reset-password`,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send reset link";
    return { success: false, error: message };
  }
}

export async function updatePasswordAction(password: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!password || password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters long." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    clearUserContextCache();
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update password";
    return { success: false, error: message };
  }
}

export async function loadSampleBrandDataAction(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return { success: false, error: "Authentication required." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("load_sample_brand_data", {
      p_org_id: context.organisation.id,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/overview");
    revalidatePath("/studio");
    revalidatePath("/knowledge");
    return { success: true, message: data?.message || "Sample brand data loaded successfully." };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load sample brand data";
    return { success: false, error: message };
  }
}

export async function signOutUser() {
  clearUserContextCache();
  const supabase = await createClient();
  await supabase.auth.signOut();

  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    for (const c of allCookies) {
      if (c.name.startsWith("sb-") || c.name.includes("auth-token")) {
        cookieStore.delete(c.name);
      }
    }
  } catch (err) {
    console.error("Error clearing auth cookies on signout:", err);
  }

  redirect("/");
}
