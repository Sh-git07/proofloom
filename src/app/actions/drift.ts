"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export type DriftStatusType = "DETECTED" | "INVESTIGATING" | "RESOLVED" | "ACCEPTED_EXCEPTION";

/**
 * Updates the investigation status of a systemic brand drift pattern.
 */
export async function updateDriftStatusAction({
  driftId,
  status,
  notes,
}: {
  driftId: string;
  status: DriftStatusType;
  notes?: string;
}) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");

  const supabase = await createClient();

  const { error } = await supabase
    .from("drift_insights")
    .update({
      recommendation: notes ? notes : undefined,
    })
    .eq("id", driftId)
    .eq("organisation_id", context.organisation.id);

  if (error) throw new Error(`Failed to update drift insight: ${error.message}`);

  // Log activity
  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "drift_status_updated",
    target_type: "drift_insight",
    target_id: driftId,
    details: { status, notes },
  });

  revalidatePath("/drift");
  revalidatePath("/overview");
  return { success: true };
}

/**
 * Scans recent audits and synthesizes new systemic brand drift insights.
 */
export async function scanForDriftAction() {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");

  const supabase = await createClient();
  const orgId = context.organisation.id;

  // Fetch all findings across organisation
  const { data: findings } = await supabase
    .from("audit_findings")
    .select(`
      id,
      category,
      severity,
      excerpt,
      finding_code,
      verification_status,
      created_at,
      audits(
        id,
        content_items(department)
      )
    `)
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!findings || findings.length === 0) {
    return { success: true, count: 0, message: "No historical findings to cluster." };
  }

  interface FindingAuditRow {
    id: string;
    category: string;
    severity: string;
    excerpt: string;
    finding_code: string;
    verification_status: string | null;
    created_at: string | null;
    audits: { content_items: { department: string } | null } | null;
  }

  // Group by excerpt or category to find frequency >= 2
  const excerptGroups = new Map<
    string,
    { count: number; departments: Set<string>; sampleFinding: FindingAuditRow }
  >();

  (findings as unknown as FindingAuditRow[]).forEach((f) => {
    const key = f.excerpt.trim().toLowerCase();
    const dept = f.audits?.content_items?.department || "General";

    if (!excerptGroups.has(key)) {
      excerptGroups.set(key, { count: 0, departments: new Set(), sampleFinding: f });
    }
    const group = excerptGroups.get(key)!;
    group.count += 1;
    group.departments.add(dept);
  });

  let newInsightsCreated = 0;

  for (const [excerpt, group] of Array.from(excerptGroups.entries())) {
    if (group.count >= 2) {
      // Check if insight already exists
      const { data: existing } = await supabase
        .from("drift_insights")
        .select("id")
        .eq("organisation_id", orgId)
        .ilike("title", `%${excerpt.slice(0, 20)}%`)
        .maybeSingle();

      if (!existing) {
        await supabase.from("drift_insights").insert({
          organisation_id: orgId,
          title: `Recurring Finding: "${excerpt.slice(0, 45)}..."`,
          summary: `Identified across ${group.count} separate audits spanning departments [${Array.from(group.departments).join(", ")}].`,
          insight_type: group.sampleFinding.category === "claim_reliability" ? "repeated_claim" : "voice_deviation",
          frequency: group.count,
          affected_departments: Array.from(group.departments),
          recommendation: `Align guidelines or update approved terminology in the Brand Knowledge Vault for "${excerpt.slice(0, 30)}".`,
          is_seeded: false,
        });
        newInsightsCreated++;
      }
    }
  }

  revalidatePath("/drift");
  revalidatePath("/overview");
  return { success: true, count: newInsightsCreated, message: `Scan complete: ${newInsightsCreated} new drift patterns detected.` };
}
