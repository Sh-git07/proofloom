import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { ReviewDetailWorkbench } from "@/components/reviews/ReviewDetailWorkbench";

interface ReviewDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewDetailPage({ params }: ReviewDetailPageProps) {
  const { id } = await params;
  const context = await getCurrentUserContext();

  if (!context) {
    redirect("/login");
  }

  const supabase = await createClient();
  const orgId = context.organisation.id;

  // 1. Fetch content item with creator profile
  const { data: item, error: itemErr } = await supabase
    .from("content_items")
    .select(`
      id,
      title,
      content_type,
      platform,
      department,
      status,
      created_at,
      campaign_context,
      objective,
      creator_id,
      profiles:creator_id(full_name, email)
    `)
    .eq("id", id)
    .eq("organisation_id", orgId)
    .single();

  if (itemErr || !item) {
    notFound();
  }

  // 2. Fetch versions, audits, assignments, comments, decisions, and qualified reviewers in parallel
  const [
    versionsRes,
    auditRes,
    assignmentsRes,
    commentsRes,
    decisionsRes,
    reviewersRes,
  ] = await Promise.all([
    supabase
      .from("content_versions")
      .select("id, version_no, source, body, change_summary, created_at, created_by")
      .eq("content_item_id", id)
      .order("version_no", { ascending: true }),
    supabase
      .from("audits")
      .select(`
        id,
        overall_score,
        status,
        mode,
        scores,
        checked_dimensions,
        created_at
      `)
      .eq("content_item_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("review_assignments")
      .select(`
        id,
        status,
        notes,
        created_at,
        reviewer_id,
        assigned_by,
        reviewer:reviewer_id(id, full_name, email),
        assigner:assigned_by(full_name)
      `)
      .eq("content_item_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("review_comments")
      .select(`
        id,
        comment,
        finding_id,
        created_at,
        author:author_id(full_name, email)
      `)
      .eq("content_item_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("approval_decisions")
      .select(`
        id,
        decision,
        reason,
        is_override,
        override_reason,
        created_at,
        decider:decider_id(full_name, email)
      `)
      .eq("content_item_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("organisation_members")
      .select(`
        user_id,
        role,
        profiles:user_id(id, full_name, email, department)
      `)
      .eq("organisation_id", orgId)
      .in("role", ["reviewer", "brand_manager", "admin"]),
  ]);

  const latestAudit = auditRes.data;

  // 3. If there is an audit, fetch its findings
  let findings: any[] = [];
  if (latestAudit?.id) {
    const { data: findingsData } = await supabase
      .from("audit_findings")
      .select(`
        id,
        finding_code,
        category,
        severity,
        excerpt,
        explanation,
        guideline_reference,
        verification_status,
        recommended_action,
        suggested_replacement,
        confidence,
        confidence_note,
        is_resolved
      `)
      .eq("audit_id", latestAudit.id)
      .order("created_at", { ascending: true });

    findings = findingsData || [];
  }

  // Format reviewer choices for dropdown
  const qualifiedReviewers = (reviewersRes.data || []).map((m: any) => ({
    userId: m.user_id,
    role: m.role,
    fullName: m.profiles?.full_name || m.profiles?.email || "Team Member",
    email: m.profiles?.email || "",
    department: m.profiles?.department || "General",
  }));

  const creatorProfile = item.profiles as { full_name?: string; email?: string } | null;

  return (
    <ReviewDetailWorkbench
      currentUserRole={context.role}
      currentUserId={context.user.id}
      contentItem={{
        id: item.id,
        title: item.title,
        content_type: item.content_type,
        platform: item.platform,
        department: item.department,
        status: item.status,
        created_at: item.created_at,
        creator_name: creatorProfile?.full_name || creatorProfile?.email || "Creator",
        creator_id: item.creator_id,
        campaign_context: item.campaign_context,
        objective: item.objective,
      }}
      versions={(versionsRes.data || []).map((v) => ({
        id: v.id,
        version_no: v.version_no,
        source: v.source,
        body: v.body,
        change_summary: v.change_summary,
        created_at: v.created_at,
      }))}
      latestAudit={
        latestAudit
          ? {
              id: latestAudit.id,
              overall_score: latestAudit.overall_score,
              status: latestAudit.status,
              mode: latestAudit.mode,
              created_at: latestAudit.created_at,
            }
          : null
      }
      findings={findings.map((f) => ({
        id: f.id,
        finding_code: f.finding_code,
        category: f.category,
        severity: f.severity,
        excerpt: f.excerpt,
        explanation: f.explanation,
        guideline_reference: f.guideline_reference,
        verification_status: f.verification_status,
        recommended_action: f.recommended_action,
        suggested_replacement: f.suggested_replacement,
        confidence: f.confidence,
        confidence_note: f.confidence_note,
        source: (f.confidence_note === "AI" || f.id?.includes("AI") || f.finding_code?.includes("AI") ? "AI" : "Rule") as "Rule" | "AI",
        is_resolved: f.is_resolved,
      }))}
      assignments={(assignmentsRes.data || []).map((a: any) => ({
        id: a.id,
        status: a.status,
        notes: a.notes,
        created_at: a.created_at,
        reviewer_id: a.reviewer_id,
        reviewer_name: a.reviewer?.full_name || a.reviewer?.email || "Reviewer",
        reviewer_email: a.reviewer?.email,
        assigned_by_name: a.assigner?.full_name,
      }))}
      comments={(commentsRes.data || []).map((c: any) => ({
        id: c.id,
        comment: c.comment,
        finding_id: c.finding_id,
        created_at: c.created_at,
        author_name: c.author?.full_name || c.author?.email || "Team Member",
      }))}
      decisions={(decisionsRes.data || []).map((d: any) => ({
        id: d.id,
        decision: d.decision,
        reason: d.reason,
        is_override: d.is_override,
        override_reason: d.override_reason,
        created_at: d.created_at,
        decider_name: d.decider?.full_name || d.decider?.email || "Decider",
      }))}
      qualifiedReviewers={qualifiedReviewers}
    />
  );
}
