"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { generateStructured } from "@/lib/ai";
import { diffWordsWithSpace } from "diff";
import { z } from "zod";

export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface RewriteResult {
  rewrittenText: string;
  explanation: string;
  diff: DiffPart[];
}

/**
 * Generates an intent-preserving rewrite for a specific finding.
 */
export async function generateRewriteAction({
  contentBody,
  excerpt,
  explanation,
  recommendedAction,
  category,
}: {
  contentBody: string;
  excerpt: string;
  explanation: string;
  recommendedAction: string;
  category: string;
}): Promise<RewriteResult> {
  const context = await getCurrentUserContext();
  if (!context) {
    throw new Error("Unauthorized");
  }

  const prompt = `CONTENT EXCERPT TO REWRITE:
"${excerpt}"

FULL SURROUNDING CONTEXT:
"${contentBody}"

CATEGORY: ${category}
ISSUE: ${explanation}
RECOMMENDED REMEDIATION: ${recommendedAction}

INSTRUCTIONS:
Provide an intent-preserving replacement that changes ONLY what is necessary to resolve the issue. Retain all key calls to action, target audience tone, and product names.`;

  const aiResult = await generateStructured({
    task: "rewrite",
    system: "You are a brand governance editor. Apply minimal intent-preserving edits to fix compliance infractions without changing product intent or adding fluff.",
    prompt,
    schema: z.object({
      rewritten_text: z.string(),
      intent_preserved: z.boolean().default(true),
      explanation: z.string(),
    }),
    organisationId: context.organisation.id,
  });

  const rewrittenText = aiResult.data.rewritten_text;

  // Calculate word-level diff
  const diff = diffWordsWithSpace(excerpt, rewrittenText);

  return {
    rewrittenText,
    explanation: aiResult.data.explanation,
    diff,
  };
}

/**
 * Accepts a rewrite: executes the public.accept_rewrite RPC function
 * Creating Version N+1, keeping Version 1 intact, marking finding resolved.
 */
export async function acceptRewriteAction({
  contentItemId,
  findingId,
  originalBody,
  excerpt,
  replacement,
}: {
  contentItemId: string;
  findingId: string;
  originalBody: string;
  excerpt: string;
  replacement: string;
}) {
  const context = await getCurrentUserContext();
  if (!context) {
    throw new Error("Unauthorized");
  }

  const supabase = await createClient();

  // Replace excerpt in full body
  const newBody = originalBody.replace(excerpt, replacement);
  const summary = `Accepted intent-preserving rewrite for finding: "${excerpt}" -> "${replacement}"`;

  // Call the database function accept_rewrite
  const { data, error } = await supabase.rpc("accept_rewrite", {
    p_content_item_id: contentItemId,
    p_finding_id: findingId,
    p_new_body: newBody,
    p_summary: summary,
  });

  if (error) {
    throw new Error(`Failed to accept rewrite: ${error.message}`);
  }

  return {
    success: true,
    newVersionId: data?.version_id,
    versionNo: data?.version_no,
  };
}

/**
 * Rejects a finding with a documented justification.
 */
export async function rejectFindingAction({
  findingId,
  contentItemId,
  reason,
}: {
  findingId: string;
  contentItemId: string;
  reason: string;
}) {
  const context = await getCurrentUserContext();
  if (!context) {
    throw new Error("Unauthorized");
  }

  if (!reason || reason.trim().length < 10) {
    throw new Error("A documented reason of at least 10 characters is required to dismiss a finding.");
  }

  const supabase = await createClient();

  // Mark finding as dismissed
  await supabase
    .from("audit_findings")
    .update({
      is_resolved: true,
    })
    .eq("id", findingId);

  // Write immutable activity log
  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "finding_dismissed",
    target_type: "finding",
    target_id: findingId,
    details: {
      content_item_id: contentItemId,
      reason: reason.trim(),
    },
  });

  return { success: true };
}
