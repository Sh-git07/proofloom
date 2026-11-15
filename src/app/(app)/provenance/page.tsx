import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
export default async function ProvenancePage() {
  const context = await getCurrentUserContext();
  const supabase = await createClient();

  const { data: matches } = await supabase
    .from("evidence_matches")
    .select(`
      id,
      excerpt,
      comparison,
      result,
      created_at,
      extracted_claims(claim_text, numeric_value, unit, metric, verification_status),
      approved_facts(name, value, owner, verified_at),
      evidence_sources(name, version)
    `)
    .eq("organisation_id", context?.organisation.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-[#253C2B] pb-4">
        <span className="font-mono text-xs font-bold text-[#16834A] uppercase tracking-wider">
          05 &mdash; CLAIM PROVENANCE
        </span>
        <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
          EVIDENCE TRACEABILITY CHAIN
        </h1>
        <p className="text-xs sm:text-sm text-[#637367]">
          Deterministic proof line connecting every numerical claim to authoritative source documents.
        </p>
      </div>

      <div className="space-y-4">
        {matches?.map((m) => {
          const claim = m.extracted_claims as unknown as {
            claim_text: string;
            numeric_value: number;
            unit: string;
            metric: string;
            verification_status: string;
          } | null;

          const fact = m.approved_facts as unknown as {
            name: string;
            value: string;
            owner: string;
            verified_at: string;
          } | null;

          const source = m.evidence_sources as unknown as {
            name: string;
            version: string;
          } | null;

          const isVerified = m.result === "VERIFIED";

          return (
            <div key={m.id} className="brutal-card p-6 bg-white space-y-4">
              {/* Chain Indicator */}
              <div className="flex items-center space-x-2 text-[10px] font-mono font-bold text-[#637367] uppercase overflow-x-auto pb-1">
                <span className="px-1.5 py-0.5 bg-[#F4F1E8] brutal-border">01 SUBMITTED CLAIM</span>
                <span>&rarr;</span>
                <span className="px-1.5 py-0.5 bg-[#F4F1E8] brutal-border">02 EXTRACTION</span>
                <span>&rarr;</span>
                <span className="px-1.5 py-0.5 bg-[#F4F1E8] brutal-border">03 SOURCE MATCH</span>
                <span>&rarr;</span>
                <span className="px-1.5 py-0.5 bg-[#F4F1E8] brutal-border">04 COMPARISON</span>
                <span>&rarr;</span>
                <span
                  className={`px-1.5 py-0.5 brutal-border font-extrabold ${
                    isVerified ? "bg-[#B7F28B] text-[#17251C]" : "bg-[#D94C4C] text-white"
                  }`}
                >
                  05 {m.result}
                </span>
              </div>

              {/* Claim vs Evidence Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-[#F4F1E8] brutal-border">
                  <span className="font-mono text-[10px] font-bold text-[#637367] uppercase block mb-1">
                    EXTRACTED ASSERTION
                  </span>
                  <p className="font-mono text-sm font-bold text-[#17251C]">
                    &ldquo;{claim?.claim_text}&rdquo;
                  </p>
                  <span className="text-[10px] font-mono text-[#637367] mt-1 block">
                    Metric: {claim?.metric || "Numerical"} &bull; Status: {m.result}
                  </span>
                </div>

                <div className="p-3 bg-[#DDEBDD] brutal-border">
                  <span className="font-mono text-[10px] font-bold text-[#16834A] uppercase block mb-1">
                    SUPPORTING SOURCE: {source?.name || fact?.name || "None"}
                  </span>
                  <p className="font-mono text-xs text-[#17251C] italic">
                    {m.excerpt || "NO APPROVED EVIDENCE FOUND"}
                  </p>
                  <span className="text-[10px] font-mono text-[#16834A] mt-1 block">
                    Source Version: {source?.version || "Official"} &bull; Verified: {fact?.verified_at ? new Date(fact.verified_at).toLocaleDateString() : "Active"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
