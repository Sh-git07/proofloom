"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { verifyClaimAgainstEvidence, DatabaseFact } from "@/lib/audit/evidence";
import { RawExtractedClaim } from "@/lib/audit/claim-extraction";

export async function reassessClaimAction({
  claimId,
  selectedFactId,
}: {
  claimId: string;
  selectedFactId?: string;
}) {
  const context = await getCurrentUserContext();
  if (!context) {
    throw new Error("Unauthorized");
  }

  const supabase = await createClient();

  // 1. Fetch claim
  const { data: claim, error: claimErr } = await supabase
    .from("extracted_claims")
    .select("*")
    .eq("id", claimId)
    .single();

  if (claimErr || !claim) {
    throw new Error("Claim not found");
  }

  // 2. Fetch facts
  const { data: facts } = await supabase
    .from("approved_facts")
    .select("*")
    .eq("organisation_id", context.organisation.id);

  // 3. Re-run comparison
  const rawClaim: RawExtractedClaim = {
    text: claim.claim_text,
    startIndex: claim.start_offset ?? 0,
    endIndex: claim.end_offset ?? claim.claim_text.length,
    claimType: claim.claim_type,
    numericValue: claim.numeric_value ?? undefined,
    unit: claim.unit ?? undefined,
    metric: claim.metric ?? undefined,
  };

  const candidateFacts = (facts as unknown as DatabaseFact[]) || [];
  let evaluatedFacts = candidateFacts;

  if (selectedFactId) {
    const specific = candidateFacts.filter((f) => f.id === selectedFactId);
    if (specific.length > 0) {
      evaluatedFacts = specific;
    }
  }

  const verification = verifyClaimAgainstEvidence(rawClaim, evaluatedFacts, 5.0);

  // 4. Update claim verification status in extracted_claims
  await supabase
    .from("extracted_claims")
    .update({
      verification_status: verification.status,
    })
    .eq("id", claimId);

  // 5. Update or insert into evidence_matches
  await supabase.from("evidence_matches").delete().eq("claim_id", claimId);
  if (verification.matchedFact) {
    await supabase.from("evidence_matches").insert({
      organisation_id: context.organisation.id,
      audit_id: claim.audit_id,
      claim_id: claimId,
      approved_fact_id: verification.matchedFact.id,
      evidence_source_id: (verification.matchedFact as any).source_id || null,
      excerpt: claim.claim_text,
      result: verification.status,
      comparison: {
        explanation: verification.explanation,
        variance_percent: verification.variancePercent || null,
      },
    });
  }

  // 6. Log activity
  await supabase.from("activity_logs").insert({
    organisation_id: context.organisation.id,
    actor_id: context.user.id,
    action: "claim_reassessed",
    target_type: "claim",
    target_id: claimId,
    details: {
      new_status: verification.status,
      matched_fact_id: verification.matchedFact?.id,
    },
  });

  return {
    success: true,
    status: verification.status,
    explanation: verification.explanation,
    matchedFact: verification.matchedFact,
  };
}
