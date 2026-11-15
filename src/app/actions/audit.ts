"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { initializeAudit } from "@/lib/audit/pipeline";
import { z } from "zod";

const submissionSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  contentType: z.string().min(1, "Select a content type"),
  platform: z.string().min(1, "Select a distribution platform"),
  department: z.string().min(1, "Select an authoring department"),
  campaignContext: z.string().optional(),
  objective: z.string().optional(),
  body: z.string().min(5, "Content body must be at least 5 characters"),
  mode: z.enum(["live_ai", "demo"]).default("live_ai"),
});

export async function createAuditSubmission(formData: FormData) {
  const context = await getCurrentUserContext();
  if (!context) {
    throw new Error("Unauthorized");
  }

  const raw = {
    title: formData.get("title") as string,
    contentType: formData.get("contentType") as string,
    platform: formData.get("platform") as string,
    department: formData.get("department") as string,
    campaignContext: (formData.get("campaignContext") as string) || undefined,
    objective: (formData.get("objective") as string) || undefined,
    body: formData.get("body") as string,
    mode: (formData.get("mode") as "live_ai" | "demo") || "live_ai",
  };

  const validated = submissionSchema.parse(raw);
  const supabase = await createClient();

  // 1. Insert content_items (immutable original metadata)
  const { data: contentItem, error: itemErr } = await supabase
    .from("content_items")
    .insert({
      organisation_id: context.organisation.id,
      created_by: context.user.id,
      title: validated.title,
      content_type: validated.contentType,
      platform: validated.platform,
      department: validated.department,
      campaign_context: validated.campaignContext,
      objective: validated.objective,
      status: "DRAFT",
    })
    .select("id")
    .single();

  if (itemErr || !contentItem) {
    throw new Error(`Failed to create content item: ${itemErr?.message}`);
  }

  // 2. Insert content_versions (Original submission is Version 1 and never overwritten)
  const { data: version, error: versionErr } = await supabase
    .from("content_versions")
    .insert({
      content_item_id: contentItem.id,
      organisation_id: context.organisation.id,
      created_by: context.user.id,
      version_no: 1,
      body: validated.body,
      change_summary: "Initial submission",
    })
    .select("id")
    .single();

  if (versionErr || !version) {
    throw new Error(`Failed to save content version: ${versionErr?.message}`);
  }

  // 3. Initialize staged audit pipeline (creates audit + 7 audit_stages rows)
  const auditId = await initializeAudit({
    organisationId: context.organisation.id,
    contentItemId: contentItem.id,
    contentVersionId: version.id,
    mode: validated.mode,
  });

  return { success: true, auditId };
}
