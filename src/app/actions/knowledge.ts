"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { canManageKnowledge } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

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

  revalidatePath("/knowledge");
  return { success: true };
}

export async function archiveApprovedFactAction(factId: string) {
  const context = await getCurrentUserContext();
  if (!context) throw new Error("Unauthorized");
  if (!canManageKnowledge(context.role)) {
    throw new Error("Only Brand Managers and Admins can manage knowledge facts.");
  }

  const supabase = await createClient();
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

  revalidatePath("/knowledge");
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
