"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { initializeAudit } from "@/lib/audit/pipeline";
import { z } from "zod";

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

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
  try {
    const context = await getCurrentUserContext();
    if (!context) {
      return { success: false, error: "Unauthorized" };
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

    // Handle optional image attachment
    const imageFile = formData.get("image") as File | null;
    const imageAltText = (formData.get("imageAltText") as string) || null;
    let imageStoragePath: string | null = null;
    let imageMimeType: string | null = null;
    let imageFileSize: number | null = null;

    if (imageFile && imageFile.size > 0) {
      // Validate type
      if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
        return {
          success: false,
          error: `Invalid image type "${imageFile.type}". Only PNG, JPG and WebP are accepted.`,
        };
      }
      // Validate size
      if (imageFile.size > MAX_IMAGE_BYTES) {
        return {
          success: false,
          error: `Image is too large (${(imageFile.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`,
        };
      }
      imageMimeType = imageFile.type;
      imageFileSize = imageFile.size;
    }

    const supabase = await createClient();

    // 1. Insert content_items (immutable original metadata)
    const { data: contentItem, error: itemErr } = await supabase
      .from("content_items")
      .insert({
        organisation_id: context.organisation.id,
        creator_id: context.user.id,
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
      return { success: false, error: `Failed to create content item: ${itemErr?.message || "Unknown error"}` };
    }

    // 2. Upload image to private bucket if present
    if (imageFile && imageFile.size > 0) {
      const sanitizedName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${context.organisation.id}/${Date.now()}-${sanitizedName}`;
      const imageBytes = await imageFile.arrayBuffer();

      // Use admin client for storage upload (bypasses RLS path check on new content)
      const adminSupabase = createAdminClient();
      const { error: uploadErr } = await adminSupabase.storage
        .from("content-uploads")
        .upload(storagePath, imageBytes, {
          contentType: imageFile.type,
          upsert: false,
        });

      if (uploadErr) {
        return { success: false, error: `Image upload failed: ${uploadErr.message}` };
      }
      imageStoragePath = storagePath;
    }

    // 3. Insert content_versions (Original submission is Version 1 and never overwritten)
    const { data: version, error: versionErr } = await supabase
      .from("content_versions")
      .insert({
        content_item_id: contentItem.id,
        organisation_id: context.organisation.id,
        created_by: context.user.id,
        version_no: 1,
        source: "original",
        body: validated.body,
        change_summary: "Initial submission",
        ...(imageStoragePath
          ? {
              image_storage_path: imageStoragePath,
              image_alt_text: imageAltText,
              image_mime_type: imageMimeType,
              image_file_size: imageFileSize,
            }
          : {}),
      })
      .select("id")
      .single();

    if (versionErr || !version) {
      return { success: false, error: `Failed to save content version: ${versionErr?.message || "Unknown error"}` };
    }

    // 4. If there's an image, also record it in content_attachments
    if (imageStoragePath && imageFile) {
      await supabase.from("content_attachments").insert({
        organisation_id: context.organisation.id,
        content_item_id: contentItem.id,
        content_version_id: version.id,
        file_name: imageFile.name,
        file_type: imageFile.type,
        file_size: imageFile.size,
        storage_path: imageStoragePath,
        alt_text: imageAltText,
      });
    }

    // 5. Initialize staged audit pipeline
    const auditId = await initializeAudit({
      organisationId: context.organisation.id,
      contentItemId: contentItem.id,
      contentVersionId: version.id,
      mode: validated.mode,
      hasImage: !!imageStoragePath,
    });

    return { success: true, auditId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

