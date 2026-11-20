import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { canManageKnowledge } from "@/lib/permissions";
import { SourceDocumentsList } from "@/components/knowledge/SourceDocumentsList";
import { SectionLabel } from "@/components/ui/section-label";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function SourceDocumentsPage() {
  const context = await getCurrentUserContext();
  if (!context) redirect("/login");

  const supabase = await createClient();
  const { data: documents } = await supabase
    .from("source_documents")
    .select("*")
    .eq("organisation_id", context.organisation.id)
    .order("created_at", { ascending: false });

  const canEdit = canManageKnowledge(context.role);

  return (
    <div className="space-y-6">
      <div className="brutal-panel bg-white p-5">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/knowledge">
            <Button className="bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD] font-mono text-xs font-bold brutal-border px-2 py-1 h-auto">
              ← BACK TO VAULT
            </Button>
          </Link>
        </div>
        <SectionLabel number="07" title="SOURCE DOCUMENTS" />
        <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
          Evidence Source Documents
        </h1>
        <p className="text-xs sm:text-sm text-[#637367] mt-0.5 font-medium">
          Upload PDF, DOCX, or TXT files. The system extracts numeric candidate facts using rule-based
          pattern matching — no AI. Each candidate must be reviewed and approved by a manager before it
          becomes evidence in audit runs.
        </p>
      </div>

      <SourceDocumentsList documents={(documents as any) || []} canEdit={canEdit} />
    </div>
  );
}
