import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { OrgRole } from "./permissions";
import { NotificationItem } from "@/components/shell/NotificationsPopover";

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
  notifications: NotificationItem[];
}

interface CacheEntry {
  context: CurrentUserContext | null;
  expiresAt: number;
}

// In-memory process cache to eliminate duplicate remote auth round-trips during fast page navigation
const userContextMemCache = new Map<string, CacheEntry>();

export function clearUserContextCache() {
  userContextMemCache.clear();
}

export const getCurrentUserContext = cache(async (): Promise<CurrentUserContext | null> => {
  // Compute cache key from cookies
  let cacheKey = "";
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore
      .getAll()
      .filter((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))
      .map((c) => `${c.name}=${c.value}`)
      .join(";");
    if (tokenCookie) {
      cacheKey = tokenCookie;
    }
  } catch {
    // If called outside request context
  }

  const now = Date.now();
  if (cacheKey && userContextMemCache.has(cacheKey)) {
    const entry = userContextMemCache.get(cacheKey)!;
    if (now < entry.expiresAt) {
      return entry.context;
    }
    userContextMemCache.delete(cacheKey);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (cacheKey) {
      userContextMemCache.set(cacheKey, { context: null, expiresAt: now + 5000 });
    }
    return null;
  }

  // Look up profile, organisation membership, and notifications in parallel
  const [profileRes, memberRes, notifsRes] = await Promise.all([
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
    supabase
      .from("notifications")
      .select("id, title, message, type, link, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
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

  const notifications: NotificationItem[] = (notifsRes.data || []).map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    link: n.link,
    is_read: n.is_read,
    created_at: n.created_at,
  }));

  const context: CurrentUserContext = {
    user: {
      id: user.id,
      email: user.email || "",
      fullName: profile?.full_name || user.user_metadata?.full_name || "Platform User",
      department: profile?.department,
    },
    organisation: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      isDemo: org.is_demo ?? false,
    },
    role: (member.role as OrgRole) || "creator",
    isDemoMode: org.is_demo ?? false,
    aiMode: "live_ai",
    notifications,
  };

  if (cacheKey) {
    // 30 seconds TTL: fast navigation transitions reuse context without blocking on remote auth
    userContextMemCache.set(cacheKey, { context, expiresAt: now + 30000 });
  }

  return context;
});
