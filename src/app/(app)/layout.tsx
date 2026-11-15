import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { NotificationItem } from "@/components/shell/NotificationsPopover";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getCurrentUserContext();

  if (!context) {
    redirect("/demo");
  }

  const supabase = await createClient();
  const { data: notificationsRaw } = await supabase
    .from("notifications")
    .select("id, title, message, type, link, is_read, created_at")
    .eq("user_id", context.user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const notifications: NotificationItem[] = (notificationsRaw || []).map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    link: n.link,
    is_read: n.is_read,
    created_at: n.created_at,
  }));

  return (
    <AppShell
      user={context.user}
      organisation={context.organisation}
      role={context.role}
      isDemoMode={context.isDemoMode}
      aiMode={context.aiMode}
      notifications={notifications}
    >
      {children}
    </AppShell>
  );
}
