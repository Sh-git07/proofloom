import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { canManageKnowledge } from "@/lib/permissions";
import { DocumentReviewPanel } from "@/components/knowledge/DocumentReviewPanel";
import { SectionLabel } from "@/components/ui/section-label";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DocumentReviewPage({ params }: Props) {
  const { id } = await params;
  const context = await getCurrentUserContext();
  if (!context) redirect("/login");

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("source_documents")
    .select("*, document_candidates(*)")
    .eq("id", id)
    .eq("organisation_id", context.organisation.id)
    .single();

  if (!doc) notFound();

  const canEdit = canManageKnowledge(context.role);

  return (
    <div className="space-y-6">
      <div className="brutal-panel bg-white p-5">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/knowledge/documents">
            <Button className="bg-[#F4F1E8] text-[#17251C] hover:bg-[#DDEBDD] font-mono text-xs font-bold brutal-border px-2 py-1 h-auto">
              ← BACK TO DOCUMENTS
            </Button>
          </Link>
        </div>
        <SectionLabel number="07" title="DOCUMENT REVIEW" />
      </div>

      <DocumentReviewPanel document={doc as any} canEdit={canEdit} />
    </div>
  );
}
