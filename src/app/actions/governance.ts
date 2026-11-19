"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { canReviewContent, canAssignReviewers, canManageMembers } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export type ApprovalDecisionType = "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
export type OrgRoleType = "admin" | "brand_manager" | "reviewer" | "creator";

/**
 * Submits audited content for formal human review.
 * Calls PostgreSQL submit_for_review RPC to validate status transition and notify reviewers.
 */
export async function submitForReviewAction(contentItemId: string) {
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return { success: false, error: "Unauthorized" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_for_review", {
      p_content_item_id: contentItemId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/audits");
    revalidatePath(`/audits/${contentItemId}`);
    revalidatePath("/reviews");
    revalidatePath("/overview");

    return { success: true, ...data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

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
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return { success: false, error: "Unauthorized" };
    }

    if (!canReviewContent(context.role)) {
      return {
        success: false,
        error: "Reviewer, Brand Manager, or Admin privileges required to adjudicate content.",
      };
    }

    if ((decision === "REJECTED" || decision === "REVISION_REQUESTED") && (!reason || reason.trim().length < 5)) {
      return {
        success: false,
        error: `A documented reason is required to ${decision === "REJECTED" ? "reject content" : "request changes"}.`,
      };
    }

    if (isOverride && (!overrideReason || overrideReason.trim().length < 15)) {
      return {
        success: false,
        error: "Admin override requires a documented justification of at least 15 characters.",
      };
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
      return { success: false, error: error.message };
    }

    revalidatePath(`/reviews/${contentItemId}`);
    revalidatePath("/reviews");
    revalidatePath("/audits");
    revalidatePath("/overview");

    return { success: true, ...data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Assigns a reviewer to a content submission.
 * Calls PostgreSQL assign_reviewer RPC.
 */
export async function assignReviewerAction({
  contentItemId,
  reviewerId,
  notes,
}: {
  contentItemId: string;
  reviewerId: string;
  notes?: string;
}) {
  try {
    const context = await getCurrentUserContext();
    if (!context) return { success: false, error: "Unauthorized" };
    if (!canAssignReviewers(context.role)) {
      return { success: false, error: "Only Brand Managers and Admins can assign reviewers." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("assign_reviewer", {
      p_content_item_id: contentItemId,
      p_reviewer_id: reviewerId,
      p_notes: notes || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/reviews/${contentItemId}`);
    revalidatePath("/reviews");
    return { success: true, ...data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Posts a review discussion comment on a submission.
 */
export async function addReviewCommentAction({
  contentItemId,
  comment,
  findingId,
}: {
  contentItemId: string;
  comment: string;
  findingId?: string;
}) {
  try {
    const context = await getCurrentUserContext();
    if (!context) return { success: false, error: "Unauthorized" };

    if (!comment || comment.trim().length === 0) {
      return { success: false, error: "Comment cannot be empty." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("add_review_comment", {
      p_content_item_id: contentItemId,
      p_comment: comment.trim(),
      p_finding_id: findingId || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/reviews/${contentItemId}`);
    revalidatePath("/reviews");
    return { success: true, ...data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Allows reviewer/manager/admin to toggle a finding resolved state.
 */
export async function toggleFindingResolvedAction({
  findingId,
  isResolved,
  contentItemId,
}: {
  findingId: string;
  isResolved: boolean;
  contentItemId?: string;
}) {
  try {
    const context = await getCurrentUserContext();
    if (!context) return { success: false, error: "Unauthorized" };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("resolve_audit_finding", {
      p_finding_id: findingId,
      p_is_resolved: isResolved,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (contentItemId) {
      revalidatePath(`/reviews/${contentItemId}`);
    }
    revalidatePath("/audits");
    revalidatePath("/reviews");
    return { success: true, ...data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
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
  let department: string;
  let role: OrgRoleType;

  if (params instanceof FormData) {
    email = (params.get("email") as string) || "";
    fullName = (params.get("fullName") as string) || "";
    department = (params.get("department") as string) || "General";
    role = ((params.get("role") as string) || "creator") as OrgRoleType;
  } else {
    email = params.email;
    fullName = params.fullName;
    department = params.department || "General";
    role = params.role;
  }

  if (!email || !fullName) {
    return { success: false, error: "Email and Full Name are required." };
  }

  const supabase = await createClient();

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let profileId = existingProfile?.id;

  if (!profileId) {
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
    profileId = newProfile.id;
  }

  const { error: mErr } = await supabase.from("organisation_members").insert({
    organisation_id: context.organisation.id,
    user_id: profileId,
    role,
  });

  if (mErr) return { success: false, error: `Failed to add member: ${mErr.message}` };

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "member_invited",
    target_type: "user",
    target_id: profileId,
    details: { email, role, full_name: fullName },
  });

  revalidatePath("/team");
  return { success: true };
}

/**
 * Updates a member's role (Admin only).
 */
export async function updateMemberRoleAction({
  membershipId,
  userId,
  newRole,
}: {
  membershipId?: string;
  userId?: string;
  newRole: OrgRoleType;
}) {
  const context = await getCurrentUserContext();
  if (!context) return { success: false, error: "Unauthorized" };
  if (!canManageMembers(context.role)) {
    return { success: false, error: "Admin privileges required to change roles." };
  }

  const supabase = await createClient();

  let query = supabase.from("organisation_members").update({ role: newRole });
  if (membershipId) {
    query = query.eq("id", membershipId);
  } else if (userId) {
    query = query.eq("organisation_id", context.organisation.id).eq("user_id", userId);
  } else {
    return { success: false, error: "Missing member identifier" };
  }

  const { error } = await query;
  if (error) return { success: false, error: `Failed to update role: ${error.message}` };

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "role_changed",
    target_type: "user",
    target_id: userId || membershipId,
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

/**
 * Removes a member from the organisation (Admin only).
 */
export async function removeMemberAction(userId: string) {
  const context = await getCurrentUserContext();
  if (!context) return { success: false, error: "Unauthorized" };
  if (!canManageMembers(context.role)) {
    return { success: false, error: "Admin privileges required to remove members." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("organisation_members")
    .delete()
    .eq("organisation_id", context.organisation.id)
    .eq("user_id", userId);

  if (error) return { success: false, error: `Failed to remove member: ${error.message}` };

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "member_removed",
    target_type: "user",
    target_id: userId,
  });

  revalidatePath("/team");
  return { success: true };
}
