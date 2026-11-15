import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { AppShell } from "@/components/shell/AppShell";

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

  return (
    <AppShell
      user={context.user}
      organisation={context.organisation}
      role={context.role}
      isDemoMode={context.isDemoMode}
      aiMode={context.aiMode}
    >
      {children}
    </AppShell>
  );
}
