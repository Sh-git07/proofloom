"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { canReviewContent, canAssignReviewers, canManageMembers } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export type ApprovalDecisionType = "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
export type OrgRoleType = "admin" | "brand_manager" | "reviewer" | "creator";

/**
 * Records a formal human review decision.
 * Calls PostgreSQL record_approval_decision RPC function to enforce critical finding restrictions.
 */
export async function recordApprovalAction({
  contentItemId,
  decision,
  reason,
  isOverride = false,
  overrideReason,
}: {
  contentItemId: string;
  decision: ApprovalDecisionType;
  reason: string;
  isOverride?: boolean;
  overrideReason?: string;
}) {
  const context = await getCurrentUserContext();
  if (!context) {
    throw new Error("Unauthorized");
  }

  if (!canReviewContent(context.role)) {
    throw new Error("Reviewer, Brand Manager, or Admin privileges required to adjudicate content.");
  }

  if (!reason || reason.trim().length < 10) {
    throw new Error("A documented reason of at least 10 characters is required for any approval decision.");
  }

  if (isOverride && (!overrideReason || overrideReason.trim().length < 15)) {
    throw new Error("Admin override requires a documented justification of at least 15 characters.");
  }

  const supabase = await createClient();

  // Call PostgreSQL database function
  const { data, error } = await supabase.rpc("record_approval_decision", {
    p_content_item_id: contentItemId,
    p_decision: decision,
    p_reason: reason.trim(),
    p_is_override: isOverride,
    p_override_reason: overrideReason?.trim() || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/reviews");
  revalidatePath("/audits");
  revalidatePath("/overview");

  return { success: true, ...data };
}

/**
 * Assigns a reviewer to a content submission.
 */
export async function assignReviewerAction({
  contentItemId,
  reviewerId,
}: {
  contentItemId: string;
  reviewerId: string;
}) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canAssignReviewers(context.role)) {
    throw new Error("Only Brand Managers and Admins can assign reviewers.");
  }

  const supabase = await createClient();

  // Update content item
  const { error } = await supabase
    .from("content_items")
    .update({
      assigned_reviewer_id: reviewerId,
      status: "IN_REVIEW",
      updated_at: new Date().toISOString(),
    })
    .eq("id", contentItemId);

  if (error) throw new Error(`Failed to assign reviewer: ${error.message}`);

  // Create notification for reviewer
  await supabase.from("notifications").insert({
    organisation_id: context.organisation.id,
    user_id: reviewerId,
    title: "New Review Assignment",
    message: "You have been assigned to review brand compliance on a pending submission.",
    type: "REVIEW_ASSIGNED",
    link: `/reviews?item=${contentItemId}`,
    is_read: false,
  });

  // Log activity
  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "reviewer_assigned",
    target_type: "content_item",
    target_id: contentItemId,
    details: { reviewer_id: reviewerId },
  });

  revalidatePath("/reviews");
  return { success: true };
}

/**
 * Invites / Adds a team member to the organization (Admin only).
 * Accepts either typed parameters or FormData.
 */
export async function addTeamMemberAction(
  params:
    | FormData
    | {
        email: string;
        fullName: string;
        department?: string;
        role: OrgRoleType;
      }
) {
  const context = await getCurrentUserContext();
  if (!context) return { success: false, error: "Unauthorized" };
  if (!canManageMembers(context.role)) {
    return { success: false, error: "Admin privileges required to manage team members." };
  }

  let email: string;
  let fullName: string;
  let department = "Marketing";
  let role: OrgRoleType = "creator";

  if (params instanceof FormData) {
    email = (params.get("email") as string)?.trim().toLowerCase() || "";
    fullName = (params.get("fullName") as string)?.trim() || "";
    department = (params.get("department") as string)?.trim() || "Marketing";
    role = ((params.get("role") as string) as OrgRoleType) || "creator";
  } else {
    email = params.email.trim().toLowerCase();
    fullName = params.fullName.trim();
    department = params.department?.trim() || "Marketing";
    role = params.role;
  }

  if (!email || !fullName) {
    return { success: false, error: "Email and Full Name are required." };
  }

  const supabase = await createClient();

  // Find or create profile
  let { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (!profile) {
    const { data: newProfile, error: pErr } = await supabase
      .from("profiles")
      .insert({
        email,
        full_name: fullName,
        department,
      })
      .select("id")
      .single();

    if (pErr) return { success: false, error: `Failed to create profile: ${pErr.message}` };
    profile = newProfile;
  }

  // Insert organisation membership
  const { error: mErr } = await supabase.from("organisation_members").insert({
    organisation_id: context.organisation.id,
    user_id: profile!.id,
    role,
  });

  if (mErr) return { success: false, error: `Failed to add member: ${mErr.message}` };

  // Log activity
  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "member_added",
    target_type: "member",
    target_id: email,
    details: { email, role, department },
  });

  revalidatePath("/team");
  return { success: true };
}

/**
 * Changes a team member's role (Admin only).
 */
export async function updateMemberRoleAction({
  membershipId,
  newRole,
}: {
  membershipId: string;
  newRole: OrgRoleType;
}) {
  const context = await getCurrentUserContext();
  if (!context) return { success: false, error: "Unauthorized" };
  if (!canManageMembers(context.role)) {
    return { success: false, error: "Admin privileges required to change roles." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("organisation_members")
    .update({ role: newRole })
    .eq("id", membershipId);

  if (error) return { success: false, error: `Failed to update role: ${error.message}` };

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "role_updated",
    target_type: "member",
    target_id: membershipId,
    details: { new_role: newRole },
  });

  revalidatePath("/team");
  return { success: true };
}

/**
 * Marks a notification as read.
 */
export async function markNotificationAsReadAction(notificationId: string) {
  const context = await getCurrentUserContext();
  if (!context) return { success: false, error: "Unauthorized" };

  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", context.user.id);

  revalidatePath("/overview");
  return { success: true };
}
