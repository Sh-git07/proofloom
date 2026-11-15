"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { canDecideChallenges, canChallengeFinding } from "@/lib/permissions";

export type ChallengeDecisionType =
  | "UPHOLD"
  | "REVERSE"
  | "ACCEPT_AS_EXCEPTION"
  | "REQUEST_EVIDENCE"
  | "PROPOSE_GUIDELINE_CHANGE";

/**
 * Creator submits a challenge against a brand audit finding.
 */
export async function submitChallengeAction({
  findingId,
  contentItemId,
  reason,
  contextNote,
}: {
  findingId: string;
  contentItemId: string;
  reason: string;
  contextNote?: string;
}) {
  const context = await getCurrentUserContext();
  if (!context) {
    throw new Error("Unauthorized");
  }

  if (!canChallengeFinding(context.role)) {
    throw new Error("Only authorized authors and creators can challenge findings.");
  }

  if (!reason || reason.trim().length < 15) {
    throw new Error("Challenge rationale must be at least 15 characters.");
  }

  const supabase = await createClient();

  // Create challenge row
  const { data: challenge, error: challengeErr } = await supabase
    .from("finding_challenges")
    .insert({
      organisation_id: context.organisation.id,
      finding_id: findingId,
      submitted_by: context.user.id,
      reason: reason.trim(),
      context: contextNote?.trim() || null,
      status: "PENDING",
    })
    .select("id")
    .single();

  if (challengeErr || !challenge) {
    throw new Error(`Failed to submit challenge: ${challengeErr?.message}`);
  }

  // Immutable activity log
  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "finding_challenged",
    target_type: "challenge",
    target_id: challenge.id,
    details: {
      finding_id: findingId,
      content_item_id: contentItemId,
      reason: reason.trim(),
    },
  });

  return { success: true, challengeId: challenge.id };
}

/**
 * Reviewer or Brand Manager adjudicates a finding challenge in the Brand Memory Court.
 */
export async function decideChallengeAction({
  challengeId,
  findingId,
  decision,
  reason,
}: {
  challengeId: string;
  findingId: string;
  decision: ChallengeDecisionType;
  reason: string;
}) {
  const context = await getCurrentUserContext();
  if (!context) {
    throw new Error("Unauthorized");
  }

  if (!canDecideChallenges(context.role)) {
    throw new Error("Reviewer, Brand Manager, or Admin privileges required to adjudicate challenges.");
  }

  if (!reason || reason.trim().length < 15) {
    throw new Error("Decision justification must be at least 15 characters.");
  }

  const supabase = await createClient();

  // 1. Insert immutable decision record
  const { error: decisionErr } = await supabase.from("challenge_decisions").insert({
    organisation_id: context.organisation.id,
    challenge_id: challengeId,
    decided_by: context.user.id,
    decision,
    reason: reason.trim(),
  });

  if (decisionErr) {
    throw new Error(`Failed to record decision: ${decisionErr.message}`);
  }

  // 2. Update challenge status
  await supabase
    .from("finding_challenges")
    .update({
      status: decision === "UPHOLD" ? "UPHELD" : decision === "REVERSE" ? "REVERSED" : "RESOLVED",
    })
    .eq("id", challengeId);

  // 3. Update finding if reversed or accepted as exception
  if (decision === "REVERSE" || decision === "ACCEPT_AS_EXCEPTION") {
    await supabase
      .from("audit_findings")
      .update({
        is_resolved: true,
      })
      .eq("id", findingId);
  }

  // 4. Log immutable activity event
  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "challenge_decided",
    target_type: "challenge",
    target_id: challengeId,
    details: {
      decision,
      finding_id: findingId,
      reason: reason.trim(),
    },
  });

  return { success: true };
}
