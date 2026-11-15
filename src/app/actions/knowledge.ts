"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { canManageKnowledge } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export async function createApprovedFactAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage knowledge facts.");
  }

  const name = formData.get("name") as string;
  const value = formData.get("value") as string;
  const numericStr = formData.get("numericValue") as string;
  const unit = formData.get("unit") as string;
  const expiryDays = parseInt((formData.get("expiryDays") as string) || "180", 10);
  const sourceCitation = formData.get("sourceCitation") as string;

  if (!name || !value) {
    throw new Error("Name and value are required.");
  }

  const supabase = await createClient();
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("approved_facts").insert({
    organisation_id: context.organisation.id,
    name: name.trim(),
    value: value.trim(),
    numeric_value: numericStr ? parseFloat(numericStr) : null,
    unit: unit ? unit.trim() : null,
    expires_at: expiresAt,
    approval_status: "APPROVED",
    verified_at: new Date().toISOString(),
    source_citation: sourceCitation?.trim() || null,
    owner: context.user.fullName,
  });

  if (error) {
    throw new Error(`Failed to create fact: ${error.message}`);
  }

  // Immutable activity log
  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "fact_created",
    target_type: "fact",
    target_id: name.trim(),
    details: { name, value, numeric_value: numericStr },
  });

  revalidatePath("/knowledge");
  return { success: true };
}

export async function createTerminologyRuleAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage terminology rules.");
  }

  const disallowed = formData.get("disallowedTerm") as string;
  const approved = formData.get("approvedTerm") as string;
  const category = (formData.get("category") as string) || "brand_standard";
  const severity = (formData.get("severity") as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW") || "MEDIUM";
  const reason = formData.get("reason") as string;

  if (!disallowed || !approved) {
    throw new Error("Disallowed term and approved replacement are required.");
  }

  const supabase = await createClient();

  const { error } = await supabase.from("terminology_rules").insert({
    organisation_id: context.organisation.id,
    disallowed_term: disallowed.trim(),
    approved_term: approved.trim(),
    category,
    severity,
    reason: reason?.trim() || null,
  });

  if (error) {
    throw new Error(`Failed to create rule: ${error.message}`);
  }

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "term_rule_created",
    target_type: "terminology",
    target_id: disallowed.trim(),
    details: { disallowed, approved, severity },
  });

  revalidatePath("/knowledge");
  return { success: true };
}

export async function createGuidelineAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage brand guidelines.");
  }

  const title = formData.get("title") as string;
  const category = (formData.get("category") as string) || "voice";
  const body = formData.get("body") as string;

  if (!title || !body) {
    throw new Error("Title and guideline rules are required.");
  }

  const supabase = await createClient();

  const { error } = await supabase.from("brand_guidelines").insert({
    organisation_id: context.organisation.id,
    title: title.trim(),
    category,
    body: body.trim(),
    status: "PUBLISHED",
    published_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to create guideline: ${error.message}`);
  }

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "guideline_published",
    target_type: "guideline",
    target_id: title.trim(),
    details: { title, category },
  });

  revalidatePath("/knowledge");
  return { success: true };
}
