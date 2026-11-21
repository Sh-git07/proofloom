import { redirect } from "next/navigation";
import { getCurrentUserContext, clearUserContextCache } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getCurrentUserContext();

  if (!context) {
    clearUserContextCache();
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <AppShell
      user={context.user}
      organisation={context.organisation}
      role={context.role}
      isDemoMode={context.isDemoMode}
      aiMode={context.aiMode}
      notifications={context.notifications}
    >
      {children}
    </AppShell>
  );
}
