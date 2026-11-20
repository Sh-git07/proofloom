"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { canManageKnowledge } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import {
  createImpactRecords,
  findAffectedContentItems,
  flagItemsNeedsReReview,
  notifyImpactedUsers,
} from "@/lib/impact/tracker";

// ==========================================
// 1. APPROVED FACTS
// ==========================================

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
  const status = (formData.get("status") as string) || "APPROVED";

  if (!name || !value) {
    throw new Error("Name and value are required.");
  }

  const supabase = await createClient();
  const expiresAt = expiryDays > 0
    ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { error } = await supabase.from("approved_facts").insert({
    organisation_id: context.organisation.id,
    name: name.trim(),
    value: value.trim(),
    numeric_value: numericStr ? parseFloat(numericStr) : null,
    unit: unit ? unit.trim() : null,
    expires_at: expiresAt,
    approval_status: status,
    verified_at: status === "APPROVED" ? new Date().toISOString() : null,
    source_citation: sourceCitation?.trim() || null,
    owner: context.user.fullName,
  });

  if (error) {
    throw new Error(`Failed to create fact: ${error.message}`);
  }

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "fact_created",
    target_type: "fact",
    target_id: name.trim(),
    details: { name, value, numeric_value: numericStr, status },
  });

  revalidatePath("/knowledge");
  return { success: true };
}

export async function updateApprovedFactAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage knowledge facts.");
  }

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const value = formData.get("value") as string;
  const numericStr = formData.get("numericValue") as string;
  const unit = formData.get("unit") as string;
  const sourceCitation = formData.get("sourceCitation") as string;
  const status = (formData.get("status") as string) || "APPROVED";

  if (!id || !name || !value) {
    throw new Error("ID, name, and value are required.");
  }

  const supabase = await createClient();

  // Fetch current fact BEFORE mutating so we can diff for impact tracking
  const { data: oldFact } = await supabase
    .from("approved_facts")
    .select("name, value, unit, expires_at, approval_status")
    .eq("id", id)
    .eq("organisation_id", context.organisation.id)
    .single();

  const { error } = await supabase
    .from("approved_facts")
    .update({
      name: name.trim(),
      value: value.trim(),
      numeric_value: numericStr ? parseFloat(numericStr) : null,
      unit: unit ? unit.trim() : null,
      approval_status: status,
      source_citation: sourceCitation?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organisation_id", context.organisation.id);

  if (error) {
    throw new Error(`Failed to update fact: ${error.message}`);
  }

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "fact_updated",
    target_type: "fact",
    target_id: id,
    details: { name, value, status },
  });

  // ---- Impact tracking ----
  if (oldFact) {
    const orgId = context.organisation.id;
    const actorId = context.user.id;
    const affectedItems: string[] = [];

    if (oldFact.value !== value.trim()) {
      const count = await createImpactRecords(supabase, orgId, id, "value_changed", oldFact.value, value.trim(), `Fact "${name}" value changed`);
      if (count > 0) {
        const items = await findAffectedContentItems(supabase, orgId, id);
        affectedItems.push(...items);
      }
    }
    if ((oldFact.unit || null) !== (unit?.trim() || null)) {
      await createImpactRecords(supabase, orgId, id, "unit_changed", oldFact.unit, unit?.trim() || null, `Fact "${name}" unit changed`);
    }
    if (status === "ARCHIVED" && oldFact.approval_status !== "ARCHIVED") {
      await createImpactRecords(supabase, orgId, id, "archived", oldFact.value, null, `Fact "${name}" was archived`);
    }
    if (affectedItems.length > 0) {
      await flagItemsNeedsReReview(supabase, orgId, actorId, id, affectedItems, name);
      await notifyImpactedUsers(supabase, orgId, affectedItems, name);
    }
  }

  revalidatePath("/knowledge");
  revalidatePath("/reviews");
  return { success: true };
}

export async function archiveApprovedFactAction(factId: string) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage knowledge facts.");
  }

  const supabase = await createClient();

  // Fetch before archiving for impact tracking
  const { data: oldFact } = await supabase
    .from("approved_facts")
    .select("name, value")
    .eq("id", factId)
    .eq("organisation_id", context.organisation.id)
    .single();

  const { error } = await supabase
    .from("approved_facts")
    .update({
      approval_status: "ARCHIVED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", factId)
    .eq("organisation_id", context.organisation.id);

  if (error) {
    throw new Error(`Failed to archive fact: ${error.message}`);
  }

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "fact_archived",
    target_type: "fact",
    target_id: factId,
    details: { approval_status: "ARCHIVED" },
  });

  // ---- Impact tracking ----
  if (oldFact) {
    const orgId = context.organisation.id;
    await createImpactRecords(supabase, orgId, factId, "archived", oldFact.value, null, `Fact "${oldFact.name}" was archived`);
    const affectedItems = await findAffectedContentItems(supabase, orgId, factId);
    if (affectedItems.length > 0) {
      await flagItemsNeedsReReview(supabase, orgId, context.user.id, factId, affectedItems, oldFact.name);
      await notifyImpactedUsers(supabase, orgId, affectedItems, oldFact.name);
    }
  }

  revalidatePath("/knowledge");
  revalidatePath("/reviews");
  return { success: true };
}

// ==========================================
// 2. TERMINOLOGY RULES
// ==========================================

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
    context: reason?.trim() || null,
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

export async function updateTerminologyRuleAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage terminology rules.");
  }

  const id = formData.get("id") as string;
  const disallowed = formData.get("disallowedTerm") as string;
  const approved = formData.get("approvedTerm") as string;
  const category = (formData.get("category") as string) || "brand_standard";
  const severity = (formData.get("severity") as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW") || "MEDIUM";
  const reason = formData.get("reason") as string;

  if (!id || !disallowed || !approved) {
    throw new Error("ID, disallowed term, and approved replacement are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("terminology_rules")
    .update({
      disallowed_term: disallowed.trim(),
      approved_term: approved.trim(),
      category,
      severity,
      reason: reason?.trim() || null,
      context: reason?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organisation_id", context.organisation.id);

  if (error) {
    throw new Error(`Failed to update rule: ${error.message}`);
  }

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "term_rule_updated",
    target_type: "terminology",
    target_id: id,
    details: { disallowed, approved, severity },
  });

  revalidatePath("/knowledge");
  return { success: true };
}

export async function deleteTerminologyRuleAction(ruleId: string) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage terminology rules.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("terminology_rules")
    .delete()
    .eq("id", ruleId)
    .eq("organisation_id", context.organisation.id);

  if (error) {
    throw new Error(`Failed to delete rule: ${error.message}`);
  }

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "term_rule_deleted",
    target_type: "terminology",
    target_id: ruleId,
  });

  revalidatePath("/knowledge");
  return { success: true };
}

// ==========================================
// 3. BRAND GUIDELINES
// ==========================================

export async function createGuidelineAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage brand guidelines.");
  }

  const title = formData.get("title") as string;
  const category = (formData.get("category") as string) || "voice";
  const body = formData.get("body") as string;
  const status = (formData.get("status") as string)?.toLowerCase() || "published";
  const version = (formData.get("version") as string) || "1.0";

  if (!title || !body) {
    throw new Error("Title and guideline rules are required.");
  }

  const supabase = await createClient();

  const { error } = await supabase.from("brand_guidelines").insert({
    organisation_id: context.organisation.id,
    title: title.trim(),
    category,
    body: body.trim(),
    version,
    status,
    published_at: status === "published" ? new Date().toISOString() : null,
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
    details: { title, category, version, status },
  });

  revalidatePath("/knowledge");
  return { success: true };
}

export async function updateGuidelineAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage brand guidelines.");
  }

  const id = formData.get("id") as string;
  const title = formData.get("title") as string;
  const category = (formData.get("category") as string) || "voice";
  const body = formData.get("body") as string;
  const status = (formData.get("status") as string)?.toLowerCase() || "published";

  if (!id || !title || !body) {
    throw new Error("ID, title, and body are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_guidelines")
    .update({
      title: title.trim(),
      category,
      body: body.trim(),
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organisation_id", context.organisation.id);

  if (error) {
    throw new Error(`Failed to update guideline: ${error.message}`);
  }

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "guideline_updated",
    target_type: "guideline",
    target_id: id,
    details: { title, status },
  });

  revalidatePath("/knowledge");
  return { success: true };
}

export async function versionGuidelineAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage brand guidelines.");
  }

  const id = formData.get("id") as string;
  const newVersion = formData.get("version") as string;
  const body = formData.get("body") as string;

  if (!id || !newVersion) {
    throw new Error("Guideline ID and new version number are required.");
  }

  const supabase = await createClient();
  const updateData: Record<string, any> = {
    version: newVersion.trim(),
    status: "published",
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (body) {
    updateData.body = body.trim();
  }

  const { error } = await supabase
    .from("brand_guidelines")
    .update(updateData)
    .eq("id", id)
    .eq("organisation_id", context.organisation.id);

  if (error) {
    throw new Error(`Failed to version guideline: ${error.message}`);
  }

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "guideline_versioned",
    target_type: "guideline",
    target_id: id,
    details: { newVersion },
  });

  revalidatePath("/knowledge");
  return { success: true };
}

export async function archiveGuidelineAction(guidelineId: string) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage brand guidelines.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_guidelines")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", guidelineId)
    .eq("organisation_id", context.organisation.id);

  if (error) {
    throw new Error(`Failed to archive guideline: ${error.message}`);
  }

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "guideline_archived",
    target_type: "guideline",
    target_id: guidelineId,
  });

  revalidatePath("/knowledge");
  return { success: true };
}

// ==========================================
// 4. APPROVED ASSETS
// ==========================================

export async function createApprovedAssetAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage brand assets.");
  }

  const name = formData.get("name") as string;
  const assetType = formData.get("assetType") as string;
  const storagePath = formData.get("storagePath") as string;
  const description = formData.get("description") as string;

  if (!name || !assetType) {
    throw new Error("Asset name and type are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("approved_assets").insert({
    organisation_id: context.organisation.id,
    name: name.trim(),
    asset_type: assetType.trim(),
    storage_path: storagePath?.trim() || null,
    mime_type: "image/svg+xml",
    metadata: { description: description?.trim() || "" },
  });

  if (error) {
    throw new Error(`Failed to register asset: ${error.message}`);
  }

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "asset_registered",
    target_type: "asset",
    target_id: name.trim(),
    details: { name, assetType },
  });

  revalidatePath("/knowledge");
  return { success: true };
}

export async function updateApprovedAssetAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage brand assets.");
  }

  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const assetType = formData.get("assetType") as string;
  const description = formData.get("description") as string;

  if (!id || !name || !assetType) {
    throw new Error("ID, name, and asset type are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("approved_assets")
    .update({
      name: name.trim(),
      asset_type: assetType.trim(),
      metadata: { description: description?.trim() || "" },
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organisation_id", context.organisation.id);

  if (error) {
    throw new Error(`Failed to update asset: ${error.message}`);
  }

  revalidatePath("/knowledge");
  return { success: true };
}

export async function deleteApprovedAssetAction(assetId: string) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage brand assets.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("approved_assets")
    .delete()
    .eq("id", assetId)
    .eq("organisation_id", context.organisation.id);

  if (error) {
    throw new Error(`Failed to delete asset: ${error.message}`);
  }

  revalidatePath("/knowledge");
  return { success: true };
}

// ==========================================
// 5. APPROVED EXAMPLES
// ==========================================

export async function createApprovedExampleAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage approved examples.");
  }

  const title = formData.get("title") as string;
  const category = (formData.get("category") as string) || "General Copy";
  const content = formData.get("content") as string;
  const whyItWorks = formData.get("whyItWorks") as string;

  if (!title || !content || !whyItWorks) {
    throw new Error("Title, approved content, and explanation are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("approved_examples").insert({
    organisation_id: context.organisation.id,
    title: title.trim(),
    category: category.trim(),
    content: content.trim(),
    why_it_works: whyItWorks.trim(),
  });

  if (error) {
    throw new Error(`Failed to create example: ${error.message}`);
  }

  revalidatePath("/knowledge");
  return { success: true };
}

export async function updateApprovedExampleAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage approved examples.");
  }

  const id = formData.get("id") as string;
  const title = formData.get("title") as string;
  const category = formData.get("category") as string;
  const content = formData.get("content") as string;
  const whyItWorks = formData.get("whyItWorks") as string;

  if (!id || !title || !content) {
    throw new Error("ID, title, and content are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("approved_examples")
    .update({
      title: title.trim(),
      category: category?.trim() || "General Copy",
      content: content.trim(),
      why_it_works: whyItWorks?.trim() || "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organisation_id", context.organisation.id);

  if (error) {
    throw new Error(`Failed to update example: ${error.message}`);
  }

  revalidatePath("/knowledge");
  return { success: true };
}

export async function deleteApprovedExampleAction(exampleId: string) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage approved examples.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("approved_examples")
    .delete()
    .eq("id", exampleId)
    .eq("organisation_id", context.organisation.id);

  if (error) {
    throw new Error(`Failed to delete example: ${error.message}`);
  }

  revalidatePath("/knowledge");
  return { success: true };
}

// ==========================================
// 6. DISCLAIMERS & POLICIES
// ==========================================

export async function createBrandDisclaimerAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage legal disclaimers.");
  }

  const title = formData.get("title") as string;
  const trigger = formData.get("trigger") as string;
  const disclaimerText = formData.get("disclaimerText") as string;
  const isMandatory = formData.get("isMandatory") === "true" || formData.get("isMandatory") === "on";

  if (!title || !trigger || !disclaimerText) {
    throw new Error("Title, trigger rule, and disclaimer text are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("brand_disclaimers").insert({
    organisation_id: context.organisation.id,
    title: title.trim(),
    trigger: trigger.trim(),
    disclaimer_text: disclaimerText.trim(),
    is_mandatory: isMandatory,
  });

  if (error) {
    throw new Error(`Failed to create disclaimer: ${error.message}`);
  }

  revalidatePath("/knowledge");
  return { success: true };
}

export async function updateBrandDisclaimerAction(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage legal disclaimers.");
  }

  const id = formData.get("id") as string;
  const title = formData.get("title") as string;
  const trigger = formData.get("trigger") as string;
  const disclaimerText = formData.get("disclaimerText") as string;
  const isMandatory = formData.get("isMandatory") === "true" || formData.get("isMandatory") === "on";

  if (!id || !title || !disclaimerText) {
    throw new Error("ID, title, and disclaimer text are required.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_disclaimers")
    .update({
      title: title.trim(),
      trigger: trigger?.trim() || "",
      disclaimer_text: disclaimerText.trim(),
      is_mandatory: isMandatory,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organisation_id", context.organisation.id);

  if (error) {
    throw new Error(`Failed to update disclaimer: ${error.message}`);
  }

  revalidatePath("/knowledge");
  return { success: true };
}

export async function deleteBrandDisclaimerAction(disclaimerId: string) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage legal disclaimers.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_disclaimers")
    .delete()
    .eq("id", disclaimerId)
    .eq("organisation_id", context.organisation.id);

  if (error) {
    throw new Error(`Failed to delete disclaimer: ${error.message}`);
  }

  revalidatePath("/knowledge");
  return { success: true };
}

// ==========================================
// IMPACT TRACKING ACTIONS
// ==========================================

/**
 * Run an expiry impact check: find facts whose expiry_date has passed,
 * create impact records for content items using them.
 * No duplicates: uses ON CONFLICT DO NOTHING.
 */
export async function runImpactCheckAction(): Promise<{ success: boolean; count: number; error?: string }> {
  const context = await getCurrentUserContext();
  if (!context) return { success: false, count: 0, error: "Unauthorized" };
  if (!canManageKnowledge(context.role)) {
    return { success: false, count: 0, error: "Insufficient permissions." };
  }

  const supabase = await createClient();
  const orgId = context.organisation.id;
  const now = new Date().toISOString();

  // Find facts that have expired
  const { data: expiredFacts } = await supabase
    .from("approved_facts")
    .select("id, name, value")
    .eq("organisation_id", orgId)
    .neq("approval_status", "ARCHIVED")
    .lt("expires_at", now)
    .not("expires_at", "is", null);

  let totalCreated = 0;
  for (const fact of expiredFacts || []) {
    const count = await createImpactRecords(
      supabase,
      orgId,
      fact.id,
      "expired",
      fact.value,
      null,
      `Fact "${fact.name}" has expired`
    );
    totalCreated += count;
    if (count > 0) {
      const items = await findAffectedContentItems(supabase, orgId, fact.id);
      if (items.length > 0) {
        await flagItemsNeedsReReview(supabase, orgId, context.user.id, fact.id, items, fact.name);
        await notifyImpactedUsers(supabase, orgId, items, fact.name);
      }
    }
  }

  await supabase.from("activity_logs").insert({
    organisation_id: orgId,
    actor_id: context.user.id,
    action: "impact_check_run",
    target_type: "organisation",
    target_id: orgId,
    details: { expired_facts_checked: (expiredFacts || []).length, impacts_created: totalCreated },
  });

  revalidatePath("/reviews");
  return { success: true, count: totalCreated };
}

/**
 * Resolve an impact record (after re-audit and human review).
 */
export async function resolveImpactAction(
  impactId: string
): Promise<{ success: boolean; error?: string }> {
  const context = await getCurrentUserContext();
  if (!context) return { success: false, error: "Unauthorized" };
  if (!canManageKnowledge(context.role)) {
    return { success: false, error: "Insufficient permissions." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("fact_change_impacts")
    .update({
      status: "RESOLVED",
      resolved_by: context.user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", impactId)
    .eq("organisation_id", context.organisation.id);

  if (error) return { success: false, error: error.message };

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "impact_resolved",
    target_type: "fact_change_impact",
    target_id: impactId,
    details: {},
  });

  revalidatePath("/reviews");
  return { success: true };
}

// ==========================================
// CLARITY SUGGESTIONS ACTIONS
// ==========================================

import {
  computeClaritySuggestions,
  saveClaritySuggestions,
} from "@/lib/clarity/suggestions";

/**
 * Compute and persist clarity suggestions for the organisation.
 */
export async function computeClaritySuggestionsAction(): Promise<{
  success: boolean;
  count: number;
  error?: string;
}> {
  const context = await getCurrentUserContext();
  if (!context) return { success: false, count: 0, error: "Unauthorized" };

  const supabase = await createClient();
  const suggestions = await computeClaritySuggestions(supabase, context.organisation.id);
  const count = await saveClaritySuggestions(supabase, suggestions);

  revalidatePath("/drift");
  return { success: true, count };
}

/**
 * Accept or reject a clarity suggestion.
 * Accepting creates a DRAFT brand_guideline note linked to the rule.
 */
export async function reviewClaritySuggestionAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  const context = await getCurrentUserContext();
  if (!context) return { success: false, error: "Unauthorized" };
  if (!canManageKnowledge(context.role)) {
    return { success: false, error: "Insufficient permissions." };
  }

  const suggestionId = formData.get("suggestion_id") as string;
  const action = formData.get("action") as "ACCEPTED" | "REJECTED";
  const rejectionReason = (formData.get("rejection_reason") as string)?.trim() || null;

  if (!suggestionId || !action) return { success: false, error: "Missing fields." };

  const supabase = await createClient();

  const { data: suggestion } = await supabase
    .from("clarity_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .eq("organisation_id", context.organisation.id)
    .single();

  if (!suggestion) return { success: false, error: "Suggestion not found." };

  let draftGuidelineId: string | null = null;

  if (action === "ACCEPTED") {
    // Create a DRAFT guideline note — never published automatically
    const { data: draft } = await supabase
      .from("brand_guidelines")
      .insert({
        organisation_id: context.organisation.id,
        title: `[DRAFT NOTE] Clarity improvement: ${suggestion.rule_label}`,
        category: "voice",
        status: "draft",
        body: suggestion.suggestion_text,
        version: "0.1",
      })
      .select("id")
      .single();
    draftGuidelineId = draft?.id || null;
  }

  await supabase
    .from("clarity_suggestions")
    .update({
      status: action,
      reviewed_by: context.user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: action === "REJECTED" ? rejectionReason : null,
      draft_guideline_id: draftGuidelineId,
    })
    .eq("id", suggestionId);

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: action === "ACCEPTED" ? "clarity_suggestion_accepted" : "clarity_suggestion_rejected",
    target_type: "clarity_suggestion",
    target_id: suggestionId,
    details: { rule_label: suggestion.rule_label, rejection_reason: rejectionReason },
  });

  revalidatePath("/drift");
  return { success: true };
}
