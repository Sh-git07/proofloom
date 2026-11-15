import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import {
  ReviewQueueWorkbench,
  ReviewQueueItem,
  ChallengeItem,
} from "@/components/reviews/ReviewQueueWorkbench";

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams?: Promise<{ item?: string }>;
}) {
  const context = await getCurrentUserContext();
  const supabase = await createClient();
  const resolvedParams = searchParams ? await searchParams : undefined;
  const orgId = context?.organisation.id;

  // 1. Fetch content items eligible for review
  const { data: contentItemsRaw } = await supabase
    .from("content_items")
    .select(`
      id,
      title,
      content_type,
      platform,
      department,
      status,
      created_at,
      creator_id,
      profiles(full_name, email)
    `)
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false });

  // 2. Fetch versions for these content items
  const itemIds = (contentItemsRaw || []).map((ci) => ci.id);
  const { data: versionsRaw } = itemIds.length > 0
    ? await supabase
        .from("content_versions")
        .select("id, content_item_id, version_no, body, created_at")
        .in("content_item_id", itemIds)
        .order("version_no", { ascending: false })
    : { data: [] };

  // 3. Fetch latest audits and findings for these items
  const { data: auditsRaw } = itemIds.length > 0
    ? await supabase
        .from("audits")
        .select(`
          id,
          content_item_id,
          overall_score,
          status,
          created_at,
          audit_findings(id, category, severity, excerpt, explanation, is_resolved)
        `)
        .in("content_item_id", itemIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // 4. Fetch assignments
  const { data: assignmentsRaw } = itemIds.length > 0
    ? await supabase
        .from("review_assignments")
        .select(`
          content_item_id,
          reviewer_id,
          profiles(full_name)
        `)
        .in("content_item_id", itemIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Assemble ReviewQueueItem array
  const queueItems: ReviewQueueItem[] = (contentItemsRaw || []).map((item) => {
    const itemVersions = (versionsRaw || [])
      .filter((v) => v.content_item_id === item.id)
      .map((v) => ({
        id: v.id,
        version_no: v.version_no,
        body: v.body,
        created_at: v.created_at,
      }));

    const latestAuditRaw = (auditsRaw || []).find((a) => a.content_item_id === item.id);
    const findings = (latestAuditRaw?.audit_findings as unknown as Array<{
      id: string;
      category: string;
      severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
      excerpt: string;
      explanation: string;
      is_resolved: boolean;
    }>) || [];

    const criticalCount = findings.filter(
      (f) => f.severity === "CRITICAL" && !f.is_resolved
    ).length;

    const assignment = (assignmentsRaw || []).find((a) => a.content_item_id === item.id);
    const reviewerProfile = assignment?.profiles as unknown as { full_name: string } | null;
    const authorProfile = item.profiles as unknown as { full_name: string; email: string } | null;

    return {
      id: item.id,
      title: item.title,
      content_type: item.content_type,
      platform: item.platform,
      department: item.department || "General",
      status: item.status,
      created_at: item.created_at,
      assigned_reviewer_id: assignment?.reviewer_id || null,
      author: authorProfile ? { full_name: authorProfile.full_name, email: authorProfile.email } : null,
      assigned_reviewer: reviewerProfile ? { full_name: reviewerProfile.full_name } : null,
      latest_audit: latestAuditRaw
        ? {
            id: latestAuditRaw.id,
            overall_score: latestAuditRaw.overall_score,
            status: latestAuditRaw.status,
            critical_findings_count: criticalCount,
            findings,
          }
        : null,
      versions: itemVersions,
    };
  });

  // 5. Fetch Brand Memory Court Challenges
  const { data: challengesRaw } = await supabase
    .from("finding_challenges")
    .select(`
      id,
      finding_id,
      reason,
      context,
      status,
      created_at,
      profiles(full_name),
      audit_findings(excerpt, severity, category, explanation)
    `)
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false });

  const challenges: ChallengeItem[] = (challengesRaw || []).map((c) => {
    const p = c.profiles as unknown as { full_name: string } | null;
    const f = c.audit_findings as unknown as {
      excerpt: string;
      severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
      category: string;
      explanation: string;
    } | null;

    return {
      id: c.id,
      finding_id: c.finding_id,
      reason: c.reason,
      context: c.context,
      status: c.status,
      created_at: c.created_at,
      submitted_by_profile: p ? { full_name: p.full_name } : null,
      finding: f ? {
        excerpt: f.excerpt,
        severity: f.severity,
        category: f.category,
        explanation: f.explanation,
      } : null,
    };
  });

  // 6. Fetch reviewers in organisation (admin, brand_manager, reviewer)
  const { data: membersRaw } = await supabase
    .from("organisation_members")
    .select(`
      user_id,
      role,
      profiles(full_name)
    `)
    .eq("organisation_id", orgId)
    .in("role", ["admin", "brand_manager", "reviewer"]);

  const reviewers = (membersRaw || []).map((m) => {
    const p = m.profiles as unknown as { full_name: string } | null;
    return {
      id: m.user_id,
      name: p?.full_name || "Team Member",
      role: m.role,
    };
  });

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-[#253C2B] pb-4">
        <span className="font-mono text-xs font-bold text-[#16834A] uppercase tracking-wider">
          06 &mdash; REVIEW QUEUE & BRAND MEMORY COURT
        </span>
        <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
          HUMAN GOVERNANCE & SIGN-OFF
        </h1>
        <p className="text-xs sm:text-sm text-[#637367]">
          Authorised multi-tier sign-off workbench with database-enforced critical override gates and Brand Memory Court adjudication.
        </p>
      </div>

      <ReviewQueueWorkbench
        queueItems={queueItems}
        challenges={challenges}
        reviewers={reviewers}
        userRole={context?.role || "viewer"}
        initialSelectedItemId={resolvedParams?.item}
      />
    </div>
  );
}
