import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import {
  ClaimProvenanceChain,
  ClaimProvenanceItem,
  AuditOption,
} from "@/components/provenance/ClaimProvenanceChain";
import { SectionLabel } from "@/components/ui/section-label";
import { redirect } from "next/navigation";

export default async function ProvenancePage({
  searchParams,
}: {
  searchParams: Promise<{ claim?: string; claimId?: string; auditId?: string }>;
}) {
  const context = await getCurrentUserContext();
  if (!context) {
    redirect("/login");
  }

  const { claim: claimQuery, claimId: claimIdQuery, auditId: auditIdQuery } =
    await searchParams;
  const supabase = await createClient();

  // 1-2. Fetch extracted claims (with evidence matches and audit metadata) and approved facts in parallel
  const claimsQuery = `
    id,
    audit_id,
    claim_text,
    claim_type,
    numeric_value,
    unit,
    metric,
    start_offset,
    end_offset,
    verification_status,
    confidence,
    created_at,
    audit:audits(
      id,
      overall_score,
      created_at,
      content_items(id, title, platform, department)
    ),
    evidence_matches(
      id,
      excerpt,
      result,
      comparison,
      created_at,
      approved_fact:approved_facts(
        id,
        name,
        value,
        numeric_value,
        unit,
        metric,
        source_version,
        approval_status,
        verified_at,
        expires_at,
        source:evidence_sources(
          id,
          name,
          version,
          last_verified_at,
          expires_at
        )
      ),
      evidence_source:evidence_sources(
        id,
        name,
        version,
        last_verified_at,
        expires_at
      )
    )
  `;

  const [{ data: claimsData, error: claimsErr }, { data: facts }] = await Promise.all([
    supabase
      .from("extracted_claims")
      .select(claimsQuery)
      .eq("organisation_id", context.organisation.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("approved_facts")
      .select("id, name, value, approval_status, expires_at")
      .eq("organisation_id", context.organisation.id)
      .order("name", { ascending: true }),
  ]);

  if (claimsErr) {
    console.error("Provenance claims fetch error:", claimsErr);
  }

  const formattedClaims: ClaimProvenanceItem[] = ((claimsData || []) as any[]).map((c) => ({
    id: c.id,
    audit_id: c.audit_id,
    claim_text: c.claim_text,
    claim_type: c.claim_type,
    numeric_value: c.numeric_value,
    unit: c.unit,
    metric: c.metric,
    start_offset: c.start_offset,
    end_offset: c.end_offset,
    verification_status: c.verification_status,
    confidence: c.confidence,
    created_at: c.created_at,
    audit: c.audit,
    evidence_matches: c.evidence_matches || [],
  }));

  // Build unique audits list for dropdown selector
  const auditMap = new Map<string, AuditOption>();
  for (const c of formattedClaims) {
    if (!c.audit_id) continue;
    if (!auditMap.has(c.audit_id)) {
      const title =
        c.audit?.content_items?.title || `Audit #${c.audit_id.slice(0, 8)}`;
      auditMap.set(c.audit_id, {
        id: c.audit_id,
        title,
        platform: c.audit?.content_items?.platform,
        department: c.audit?.content_items?.department,
        claimCount: 1,
        score: c.audit?.overall_score,
        created_at: c.audit?.created_at || c.created_at,
      });
    } else {
      const existing = auditMap.get(c.audit_id)!;
      existing.claimCount += 1;
    }
  }

  const auditOptions = Array.from(auditMap.values()).sort((a, b) => {
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  // Resolve initial selected claim & audit
  let initialClaimId = formattedClaims[0]?.id;
  let initialAuditId = auditIdQuery || "ALL";

  if (claimIdQuery) {
    const match = formattedClaims.find((c) => c.id === claimIdQuery);
    if (match) {
      initialClaimId = match.id;
      if (!auditIdQuery) {
        initialAuditId = match.audit_id;
      }
    }
  } else if (claimQuery) {
    const match = formattedClaims.find((c) =>
      c.claim_text.toLowerCase().includes(claimQuery.toLowerCase())
    );
    if (match) {
      initialClaimId = match.id;
      if (!auditIdQuery) {
        initialAuditId = match.audit_id;
      }
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
        audits={auditOptions}
        initialSelectedClaimId={initialClaimId}
        initialSelectedAuditId={initialAuditId}
      />
    </div>
  );
}
