import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { CheckCircle, Shield } from "lucide-react";

export default async function KnowledgePage() {
  const context = await getCurrentUserContext();
  const supabase = await createClient();

  const { data: facts } = await supabase
    .from("approved_facts")
    .select("*, evidence_sources(name)")
    .eq("organisation_id", context?.organisation.id);

  const { data: terms } = await supabase
    .from("terminology_rules")
    .select("*")
    .eq("organisation_id", context?.organisation.id);

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-[#253C2B] pb-4">
        <span className="font-mono text-xs font-bold text-[#16834A] uppercase tracking-wider">
          04 &mdash; BRAND KNOWLEDGE VAULT
        </span>
        <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
          APPROVED EVIDENCE & GOVERNANCE VAULT
        </h1>
        <p className="text-xs sm:text-sm text-[#637367]">
          Authoritative brand facts, empirical benchmark reports, terminology rules, and published guidelines.
        </p>
      </div>

      {/* Approved Facts Grid */}
      <div className="space-y-4">
        <h3 className="font-mono font-bold text-sm text-[#17251C] uppercase flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-[#16834A]" />
          <span>APPROVED FACTS & BENCHMARKS ({facts?.length || 0})</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {facts?.map((fact) => {
            const isExpired = fact.approval_status === "EXPIRED" || (fact.expires_at && new Date(fact.expires_at) < new Date());

            return (
              <div key={fact.id} className="brutal-card p-4 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#17251C]">
                    {fact.name}
                  </span>
                  <span
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.5 brutal-border ${
                      isExpired
                        ? "bg-[#D94C4C] text-white"
                        : "bg-[#B7F28B] text-[#17251C]"
                    }`}
                  >
                    {isExpired ? "EXPIRED / OUTDATED" : "APPROVED"}
                  </span>
                </div>

                <p className="font-mono text-sm font-bold text-[#16834A] bg-[#F4F1E8] p-2 brutal-border">
                  {fact.value}
                </p>

                <p className="text-xs text-[#637367]">
                  {fact.description}
                </p>

                <div className="pt-2 border-t border-[#DDEBDD] flex items-center justify-between font-mono text-[10px] text-[#637367]">
                  <span>Metric: {fact.metric}</span>
                  <span>Owner: {fact.owner}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Terminology Rules Section */}
      <div className="space-y-4 pt-4">
        <h3 className="font-mono font-bold text-sm text-[#17251C] uppercase flex items-center space-x-2">
          <Shield className="w-4 h-4 text-[#16834A]" />
          <span>TERMINOLOGY & POSITIONING RULES ({terms?.length || 0})</span>
        </h3>

        <div className="brutal-card bg-white p-4 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b-2 border-[#253C2B] bg-[#F4F1E8] text-[#637367]">
                <th className="py-2 px-3">DISALLOWED TERM</th>
                <th className="py-2 px-3">APPROVED REPLACEMENT</th>
                <th className="py-2 px-3">CONTEXT / MANDATORY DISCLAIMER</th>
              </tr>
            </thead>
            <tbody className="divide-y border-b-2 border-[#253C2B]">
              {terms?.map((t) => (
                <tr key={t.id} className="hover:bg-[#F4F1E8]">
                  <td className="py-2.5 px-3 font-bold text-[#D94C4C]">
                    &ldquo;{t.disallowed_term}&rdquo;
                  </td>
                  <td className="py-2.5 px-3 font-bold text-[#16834A]">
                    &rarr; {t.approved_term}
                  </td>
                  <td className="py-2.5 px-3 text-[#637367]">
                    {t.context || t.required_disclaimer || "Standard brand positioning"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
