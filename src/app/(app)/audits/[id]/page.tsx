import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { notFound, redirect } from "next/navigation";
import { AuditReportView } from "@/components/audit/AuditReportView";

interface AuditReportProps {
  params: Promise<{ id: string }>;
}

export default async function AuditReportPage({ params }: AuditReportProps) {
  const { id } = await params;
  const context = await getCurrentUserContext();

  if (!context) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: audit, error: auditErr } = await supabase
    .from("audits")
    .select(`
      id,
      overall_score,
      status,
      mode,
      scores,
      checked_dimensions,
      created_at,
      content_versions(body, version_no),
      content_items(id, title, content_type, platform, department, status)
    `)
    .eq("id", id)
    .eq("organisation_id", context.organisation.id)
    .single();

  if (auditErr || !audit) {
    notFound();
  }

  const { data: stages } = await supabase
    .from("audit_stages")
    .select("*")
    .eq("audit_id", id)
    .order("stage_number", { ascending: true });

  const { data: findings } = await supabase
    .from("audit_findings")
    .select("*")
    .eq("audit_id", id)
    .order("created_at", { ascending: true });

  const item = audit.content_items as unknown as {
    id: string;
    title: string;
    content_type: string;
    platform: string;
    department: string;
    status: string;
  };

  const version = audit.content_versions as unknown as {
    body: string;
    version_no: number;
  };

  return (
    <AuditReportView
      audit={{
        id: audit.id,
        overall_score: audit.overall_score,
        status: audit.status,
        mode: (audit.mode as "live_ai" | "demo") || "live_ai",
        scores: audit.scores as {
          voice?: number;
          claims?: number;
          terminology?: number;
          accessibility?: number;
          visual?: number | null;
        } | null,
        checked_dimensions: (audit.checked_dimensions as string[]) || [
          "voice",
          "claims",
          "terminology",
          "accessibility",
        ],
        created_at: audit.created_at,
      }}
      contentItem={{
        id: item?.id || "",
        title: item?.title || "Draft Submission",
        content_type: item?.content_type || "Social media post",
        platform: item?.platform || "LinkedIn",
        department: item?.department || "General",
        status: item?.status || "DRAFT",
      }}
      contentVersion={{
        body: version?.body || "",
        version_no: version?.version_no || 1,
      }}
      initialStages={stages || []}
      initialFindings={findings || []}
    />
  );
}
