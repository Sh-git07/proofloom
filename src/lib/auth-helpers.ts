import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { OrgRole } from "./permissions";

export interface CurrentUserContext {
  user: {
    id: string;
    email: string;
    fullName: string;
    department?: string;
  };
  organisation: {
    id: string;
    name: string;
    slug: string;
    isDemo: boolean;
  };
  role: OrgRole;
  isDemoMode: boolean;
  aiMode: "live_ai" | "demo";
}

export const getCurrentUserContext = cache(async (): Promise<CurrentUserContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Look up profile and organisation membership in parallel
  const [profileRes, memberRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, department")
      .eq("id", user.id)
      .single(),
    supabase
      .from("organisation_members")
      .select("organisation_id, role, organisations(id, name, slug, is_demo)")
      .eq("user_id", user.id)
      .limit(1)
      .single(),
  ]);

  const profile = profileRes.data;
  const member = memberRes.data;

  if (!member || !member.organisations) {
    return null;
  }

  const org = member.organisations as unknown as {
    id: string;
    name: string;
    slug: string;
    is_demo: boolean;
  };

  const hasApiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
  const aiProvider = process.env.AI_PROVIDER || "gemini";
  const isLive = hasApiKey && aiProvider !== "demo";

  return {
    user: {
      id: user.id,
      email: user.email || "",
      fullName: profile?.full_name || user.email?.split("@")[0] || "User",
      department: profile?.department,
    },
    organisation: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      isDemo: org.is_demo,
    },
    role: member.role as OrgRole,
    isDemoMode: process.env.DEMO_MODE_ENABLED === "true" || org.is_demo,
    aiMode: isLive ? "live_ai" : "demo",
  };
});
