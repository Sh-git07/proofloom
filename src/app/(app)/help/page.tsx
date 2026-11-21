import { redirect } from "next/navigation";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { HelpCenterWorkbench } from "@/components/help/HelpCenterWorkbench";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const context = await getCurrentUserContext();

  if (!context) {
    redirect("/demo");
  }

  return <HelpCenterWorkbench currentRole={context.role} />;
}
