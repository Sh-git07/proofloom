import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { notFound, redirect } from "next/navigation";
import { AuditReportView } from "@/components/audit/AuditReportView";
import { calculateStageFindingsCount } from "@/lib/audit/labelling";

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
      content_items(
        id,
        title,
        content_type,
        platform,
        department,
        status,
        creator_id,
        profiles:creator_id(full_name, email)
      )
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
    creator_id?: string;
    profiles?: {
      full_name?: string;
      email?: string;
    };
  };

  const version = audit.content_versions as unknown as {
    body: string;
    version_no: number;
  };

  const creatorName = item?.profiles?.full_name || item?.profiles?.email || "Platform Creator";

  return (
    <AuditReportView
      userRole={context.role}
      creatorName={creatorName}
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
      initialStages={(stages || []).map((s) => ({
        id: s.id,
        stage_number: s.stage_number,
        stage_name: s.stage_key || s.stage_name || `[0${s.stage_number}] STAGE`,
        status: s.status,
        started_at: s.started_at,
        completed_at: s.finished_at,
        error_message: s.error,
        detail: s.detail,
        findings_count: calculateStageFindingsCount(s.stage_number, findings || []),
      }))}
      initialFindings={(findings || []).map((f) => ({
        id: f.id,
        category: (f.category === "claim_reliability" ? "claims" : f.category) as "voice" | "claims" | "terminology" | "accessibility" | "visual",
        severity: f.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",
        excerpt: f.excerpt,
        start_index: f.start_offset ?? 0,
        end_index: f.end_offset ?? 0,
        explanation: f.explanation,
        guideline_reference: f.guideline_reference,
        verification_status: f.verification_status,
        recommended_action: f.recommended_action,
        suggested_replacement: f.suggested_replacement,
        confidence: f.confidence as "high" | "medium" | "low",
        confidence_note: f.confidence_note,
        source: (f.confidence_note === "AI" || f.id?.includes("AI") || f.finding_code?.includes("AI") ? "AI" : "Rule") as "Rule" | "AI",
        is_resolved: f.is_resolved,
      }))}
    />
  );
}
