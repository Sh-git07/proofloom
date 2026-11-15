import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { ClaimProvenanceChain, ClaimProvenanceItem } from "@/components/provenance/ClaimProvenanceChain";
import { SectionLabel } from "@/components/ui/section-label";
import { redirect } from "next/navigation";

export default async function ProvenancePage({
  searchParams,
}: {
  searchParams: Promise<{ claim?: string }>;
}) {
  const context = await getCurrentUserContext();
  if (!context) {
    redirect("/login");
  }

  const { claim: claimQuery } = await searchParams;
  const supabase = await createClient();

  // 1-2. Fetch extracted claims and approved facts in parallel
  const [{ data: claims }, { data: facts }] = await Promise.all([
    supabase
      .from("extracted_claims")
      .select(`
        id,
        claim_text,
        claim_type,
        start_index,
        end_index,
        verification_status,
        tolerance_variance_percent,
        comparison_explanation,
        created_at,
        matched_fact:approved_facts(id, name, value, approval_status, expires_at, superseded_by),
        audit:audits(
          id,
          content_items(title, platform, department)
        )
      `)
      .eq("organisation_id", context.organisation.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("approved_facts")
      .select("id, name, value, approval_status, expires_at")
      .eq("organisation_id", context.organisation.id)
      .order("name", { ascending: true }),
  ]);

  const formattedClaims = (claims as unknown as ClaimProvenanceItem[]) || [];

  // If claim query provided from finding link, find matching claim id
  let initialClaimId = formattedClaims[0]?.id;
  if (claimQuery) {
    const match = formattedClaims.find((c) =>
      c.claim_text.toLowerCase().includes(claimQuery.toLowerCase())
    );
    if (match) {
      initialClaimId = match.id;
    }
  }

  return (
    <div className="space-y-6">
      {/* Console Header */}
      <div className="brutal-panel bg-white p-5">
        <SectionLabel number="05" title="CLAIM PROVENANCE" />
        <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
          EVIDENCE TRACEABILITY CHAIN
        </h1>
        <p className="text-xs sm:text-sm text-[#637367] mt-0.5 font-medium">
          Deterministic proof line connecting every empirical claim to approved organizational benchmark facts.
        </p>
      </div>

      <ClaimProvenanceChain
        claims={formattedClaims}
        availableFacts={facts || []}
        initialSelectedClaimId={initialClaimId}
      />
    </div>
  );
}
