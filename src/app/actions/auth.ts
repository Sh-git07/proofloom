"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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
  const email = formData.get("email") as string;
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
    return { error: error.message };
  }

  redirect("/overview");
}

export async function signOutUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
