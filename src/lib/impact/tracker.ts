/**
 * Impact tracking helpers.
 * Called from knowledge.ts server actions after a fact is mutated.
 * Rule: one OPEN record per (fact_id, content_item_id, change_type).
 *       If a record already exists for that combination, upsert is a no-op.
 */
import { SupabaseClient } from "@supabase/supabase-js";

export type ChangeType =
  | "value_changed"
  | "unit_changed"
  | "expiry_changed"
  | "superseded"
  | "expired"
  | "archived";

export interface ImpactRecord {
  organisation_id: string;
  fact_id: string;
  content_item_id: string;
  change_type: ChangeType;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  status: "OPEN";
}

/**
 * Find content items that used `factId` as evidence in their latest audit
 * and whose current status is APPROVED, IN_REVIEW, or READY_TO_PUBLISH.
 * Returns content_item_id list.
 */
export async function findAffectedContentItems(
  supabase: SupabaseClient,
  orgId: string,
  factId: string
): Promise<string[]> {
  // 1. Find all audits that reference this fact via evidence_matches
  const { data: matches } = await supabase
    .from("evidence_matches")
    .select("audit_id")
    .eq("approved_fact_id", factId)
    .eq("organisation_id", orgId);

  if (!matches || matches.length === 0) return [];
  const auditIds = [...new Set(matches.map((m) => m.audit_id as string))];

  // 2. For each audit, get its content_item_id
  const { data: audits } = await supabase
    .from("audits")
    .select("id, content_item_id")
    .in("id", auditIds)
    .eq("organisation_id", orgId);

  if (!audits || audits.length === 0) return [];

  // 3. For each content_item find the latest audit and check it matches one of auditIds
  const contentItemIds = [...new Set(audits.map((a) => a.content_item_id as string))];

  // 4. Filter content_items to those whose status is eligible
  const { data: items } = await supabase
    .from("content_items")
    .select("id, status")
    .in("id", contentItemIds)
    .in("status", ["APPROVED", "IN_REVIEW", "READY_TO_PUBLISH"])
    .eq("organisation_id", orgId);

  if (!items || items.length === 0) return [];
  return items.map((i) => i.id as string);
}

/**
 * Create impact records for a fact mutation.
 * Uses INSERT ... ON CONFLICT DO NOTHING to prevent duplicates.
 */
export async function createImpactRecords(
  supabase: SupabaseClient,
  orgId: string,
  factId: string,
  changeType: ChangeType,
  oldValue: string | null,
  newValue: string | null,
  reason: string | null
): Promise<number> {
  const affectedItems = await findAffectedContentItems(supabase, orgId, factId);
  if (affectedItems.length === 0) return 0;

  const records: ImpactRecord[] = affectedItems.map((ciId) => ({
    organisation_id: orgId,
    fact_id: factId,
    content_item_id: ciId,
    change_type: changeType,
    old_value: oldValue,
    new_value: newValue,
    reason,
    status: "OPEN",
  }));

  // ignoreDuplicates uses ON CONFLICT DO NOTHING
  await supabase.from("fact_change_impacts").upsert(records, {
    onConflict: "fact_id,content_item_id,change_type",
    ignoreDuplicates: true,
  });

  return records.length;
}

/**
 * Flag content items with NEEDS_RE-REVIEW label by adding a note in activity_logs.
 * We do NOT change the approval decision — only flag.
 */
export async function flagItemsNeedsReReview(
  supabase: SupabaseClient,
  orgId: string,
  actorId: string,
  factId: string,
  contentItemIds: string[],
  factName: string
): Promise<void> {
  if (contentItemIds.length === 0) return;

  const logs = contentItemIds.map((ciId) => ({
    organisation_id: orgId,
    actor_id: actorId,
    action: "content_needs_re_review",
    target_type: "content_item",
    target_id: ciId,
    details: {
      reason: "FACT_CHANGED",
      fact_id: factId,
      fact_name: factName,
      label: "NEEDS RE-REVIEW",
    },
  }));

  await supabase.from("activity_logs").insert(logs);
}

/**
 * Send notifications to content creators and all managers for each affected item.
 */
export async function notifyImpactedUsers(
  supabase: SupabaseClient,
  orgId: string,
  contentItemIds: string[],
  factName: string
): Promise<void> {
  if (contentItemIds.length === 0) return;

  // Fetch creator_ids for the impacted content items
  const { data: items } = await supabase
    .from("content_items")
    .select("id, creator_id, title")
    .in("id", contentItemIds)
    .eq("organisation_id", orgId);

  // Fetch all admins and brand_managers in the org
  const { data: managers } = await supabase
    .from("organisation_members")
    .select("user_id")
    .eq("organisation_id", orgId)
    .in("role", ["admin", "brand_manager"]);

  const managerIds = (managers || []).map((m) => m.user_id as string);
  const notifications: Array<{
    organisation_id: string;
    user_id: string;
    title: string;
    message: string;
    type: string;
    link: string;
  }> = [];

  for (const item of items || []) {
    const title = `Fact changed: "${factName}" — review required`;
    const message = `The approved fact "${factName}" used in "${item.title}" has changed. Please re-audit and re-review this content.`;
    const link = `/reviews?item=${item.id}`;

    // Notify creator
    if (item.creator_id) {
      notifications.push({
        organisation_id: orgId,
        user_id: item.creator_id,
        title,
        message,
        type: "fact_impact",
        link,
      });
    }
    // Notify managers
    for (const uid of managerIds) {
      if (uid !== item.creator_id) {
        notifications.push({ organisation_id: orgId, user_id: uid, title, message, type: "fact_impact", link });
      }
    }
  }

  if (notifications.length > 0) {
    await supabase.from("notifications").insert(notifications);
  }
}
