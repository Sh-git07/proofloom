import { getCurrentUserContext } from "@/lib/auth-helpers";
import { ContentStudioForm } from "@/components/studio/ContentStudioForm";
import { SectionLabel } from "@/components/ui/section-label";
import { redirect } from "next/navigation";

export default async function StudioPage() {
  const context = await getCurrentUserContext();
  if (!context) {
    redirect("/login");
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Studio Header Console */}
      <div className="brutal-panel bg-white p-5">
        <SectionLabel number="02" title="CONTENT STUDIO" />
        <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
          SUBMISSION & VERIFICATION STUDIO
        </h1>
        <p className="text-xs sm:text-sm text-[#637367] mt-0.5 font-medium">
          Draft content or upload documents for multi-stage brand integrity analysis, empirical claim verification, and tone compliance.
        </p>
      </div>

      {/* Main Studio Submission Component */}
      <ContentStudioForm isDemoMode={context.isDemoMode} />
    </div>
  );
}
