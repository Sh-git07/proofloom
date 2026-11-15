import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";

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
    <div className="min-h-screen bg-[#F4F1E8] flex">
      {/* Fixed Sidebar */}
      <Sidebar
        currentRole={context.role}
        isDemoMode={context.isDemoMode}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col ml-64 min-w-0">
        <Header
          user={context.user}
          organisation={context.organisation}
          role={context.role}
          isDemoMode={context.isDemoMode}
          aiMode={context.aiMode}
        />

        {/* Content Body */}
        <main className={`flex-1 p-6 md:p-8 ${context.isDemoMode ? "mt-24" : "mt-16"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
