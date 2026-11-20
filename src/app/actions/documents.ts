"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { canManageKnowledge } from "@/lib/permissions";
import { parseUploadedFile } from "@/lib/parser";
import { extractCandidates } from "@/lib/documents/extractor";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadSourceDocumentAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  documentId?: string;
}> {
  const context = await getCurrentUserContext();
  if (!context) return { success: false, error: "Not authenticated." };
  if (!canManageKnowledge(context.role)) {
    return { success: false, error: "Insufficient permissions." };
  }

  const file = formData.get("file") as File | null;
  const name = (formData.get("name") as string)?.trim();
  const version = (formData.get("version") as string)?.trim() || "1.0";
  const category = (formData.get("category") as string)?.trim() || "General";
  const owner = (formData.get("owner") as string)?.trim() || null;
  const expiryDate = (formData.get("expiry_date") as string) || null;
  const lastVerifiedDate = (formData.get("last_verified_date") as string) || null;

  if (!file || !name) {
    return { success: false, error: "File and name are required." };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      success: false,
      error: "Invalid file type. Upload PDF, DOCX, or TXT only.",
    };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { success: false, error: "File exceeds the 10 MB limit." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Parse text from the file
  let parsed: Awaited<ReturnType<typeof parseUploadedFile>>;
  try {
    parsed = await parseUploadedFile(buffer, file.name, file.type);
  } catch (err) {
    return {
      success: false,
      error: `Text extraction failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Upload to storage using admin client (private bucket)
  const adminSupabase = createAdminClient();
  const sanitisedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `knowledge-docs/${context.organisation.id}/${Date.now()}-${sanitisedName}`;

  const { error: storageError } = await adminSupabase.storage
    .from("content-uploads")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (storageError) {
    return {
      success: false,
      error: `Storage upload failed: ${storageError.message}`,
    };
  }

  // Insert source_documents row
  const supabase = await createClient();
  const { data: doc, error: dbError } = await supabase
    .from("source_documents")
    .insert({
      organisation_id: context.organisation.id,
      name,
      version,
      category,
      owner,
      uploaded_by: context.user.id,
      storage_path: storagePath,
      mime_type: file.type,
      file_size_bytes: file.size,
      extracted_text: parsed.text,
      status: "PENDING_APPROVAL",
      expiry_date: expiryDate || null,
      last_verified_date: lastVerifiedDate || null,
      page_count: parsed.pageCount ?? null,
    })
    .select("id")
    .single();

  if (dbError || !doc) {
    return { success: false, error: `Database error: ${dbError?.message}` };
  }

  // Extract candidates and insert them
  if (parsed.text) {
    const candidates = extractCandidates(parsed.text, parsed.pageCount);
    if (candidates.length > 0) {
      await supabase.from("document_candidates").insert(
        candidates.map((c) => ({
          organisation_id: context.organisation.id,
          document_id: doc.id,
          metric_name: c.metricName,
          value: c.value,
          numeric_value: c.numericValue,
          unit: c.unit,
          excerpt: c.excerpt,
          page_number: c.pageNumber,
          review_status: "PENDING",
        }))
      );
    }
  }

  // Log to activity_logs
  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "source_document_uploaded",
    target_type: "source_document",
    target_id: doc.id,
    details: { name, version, category },
  });

  revalidatePath("/knowledge/documents");
  return { success: true, documentId: doc.id };
}

export async function reviewCandidateAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  const context = await getCurrentUserContext();
  if (!context) return { success: false, error: "Not authenticated." };
  if (!canManageKnowledge(context.role)) {
    return { success: false, error: "Insufficient permissions." };
  }

  const candidateId = formData.get("candidate_id") as string;
  const action = formData.get("action") as "APPROVED" | "REJECTED";
  const metricName = (formData.get("metric_name") as string)?.trim();
  const value = (formData.get("value") as string)?.trim();
  const unit = (formData.get("unit") as string)?.trim() || null;
  const expiryDate = (formData.get("expiry_date") as string) || null;

  if (!candidateId || !action) {
    return { success: false, error: "Missing candidate_id or action." };
  }

  const supabase = await createClient();

  // Fetch the candidate with its parent document
  const { data: candidate, error: fetchErr } = await supabase
    .from("document_candidates")
    .select("*, source_documents(id, name, version, organisation_id, status)")
    .eq("id", candidateId)
    .single();

  if (fetchErr || !candidate) {
    return { success: false, error: "Candidate not found." };
  }

  // Verify org ownership
  if ((candidate.source_documents as any)?.organisation_id !== context.organisation.id) {
    return { success: false, error: "Insufficient permissions." };
  }

  if (action === "APPROVED") {
    const doc = candidate.source_documents as any;
    const sourceCitation = `${doc.name} v${doc.version}, p.${candidate.page_number ?? "?"}`;

    // Create approved_facts row
    const { data: approvedFact, error: factErr } = await supabase
      .from("approved_facts")
      .insert({
        organisation_id: context.organisation.id,
        name: metricName || candidate.metric_name,
        value: value || candidate.value,
        numeric_value: candidate.numeric_value,
        unit: unit || candidate.unit,
        approval_status: "APPROVED",
        source_citation: sourceCitation,
        source_document_id: doc.id,
        source_document_version: doc.version,
        source_excerpt: candidate.excerpt,
        source_page: candidate.page_number,
        expires_at: expiryDate || null,
      })
      .select("id")
      .single();

    if (factErr || !approvedFact) {
      return { success: false, error: `Failed to create fact: ${factErr?.message}` };
    }

    // Update candidate with approved_fact_id
    await supabase
      .from("document_candidates")
      .update({
        review_status: "APPROVED",
        reviewed_by: context.user.id,
        reviewed_at: new Date().toISOString(),
        approved_fact_id: approvedFact.id,
        metric_name: metricName || candidate.metric_name,
        value: value || candidate.value,
        unit: unit || candidate.unit,
      })
      .eq("id", candidateId);
  } else {
    await supabase
      .from("document_candidates")
      .update({
        review_status: "REJECTED",
        reviewed_by: context.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", candidateId);
  }

  revalidatePath(`/knowledge/documents/${(candidate.source_documents as any)?.id}/review`);
  return { success: true };
}

export async function reviewDocumentAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  const context = await getCurrentUserContext();
  if (!context) return { success: false, error: "Not authenticated." };
  if (!canManageKnowledge(context.role)) {
    return { success: false, error: "Insufficient permissions." };
  }

  const documentId = formData.get("document_id") as string;
  const action = formData.get("action") as "APPROVED" | "REJECTED";
  const rejectionReason = (formData.get("rejection_reason") as string)?.trim() || null;

  if (!documentId || !action) {
    return { success: false, error: "Missing document_id or action." };
  }

  const supabase = await createClient();

  // Verify ownership
  const { data: doc } = await supabase
    .from("source_documents")
    .select("id, name, organisation_id")
    .eq("id", documentId)
    .eq("organisation_id", context.organisation.id)
    .single();

  if (!doc) return { success: false, error: "Document not found." };

  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> =
    action === "APPROVED"
      ? { status: "APPROVED", approved_by: context.user.id, approved_at: now, updated_at: now }
      : { status: "REJECTED", rejected_by: context.user.id, rejected_at: now, rejection_reason: rejectionReason, updated_at: now };

  await supabase.from("source_documents").update(updatePayload).eq("id", documentId);

  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: action === "APPROVED" ? "source_document_approved" : "source_document_rejected",
    target_type: "source_document",
    target_id: documentId,
    details: { name: doc.name, reason: rejectionReason },
  });

  revalidatePath("/knowledge/documents");
  revalidatePath(`/knowledge/documents/${documentId}/review`);
  return { success: true };
}
