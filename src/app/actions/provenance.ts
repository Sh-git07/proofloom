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
    startIndex: claim.start_index,
    endIndex: claim.end_index,
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

  // 4. Update claim
  await supabase
    .from("extracted_claims")
    .update({
      matched_fact_id: verification.matchedFact?.id || null,
      verification_status: verification.status,
      tolerance_variance_percent: verification.variancePercent || null,
      comparison_explanation: verification.explanation,
    })
    .eq("id", claimId);

  // 5. Log activity
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
