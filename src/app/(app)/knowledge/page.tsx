import { createClient } from "@/lib/supabase/server";
import { getCurrentUserContext } from "@/lib/auth-helpers";
import { KnowledgeVaultTabs } from "@/components/knowledge/KnowledgeVaultTabs";
import { SectionLabel } from "@/components/ui/section-label";
import { redirect } from "next/navigation";

export default async function KnowledgePage() {
  const context = await getCurrentUserContext();
  if (!context) {
    redirect("/login");
  }

  const supabase = await createClient();

  // Fetch all 6 Knowledge Vault collections in parallel
  const [
    { data: facts },
    { data: terms },
    { data: guidelines },
    { data: assets },
    { data: examples },
    { data: disclaimers },
  ] = await Promise.all([
    supabase
      .from("approved_facts")
      .select("*")
      .eq("organisation_id", context.organisation.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("terminology_rules")
      .select("*")
      .eq("organisation_id", context.organisation.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("brand_guidelines")
      .select("*")
      .eq("organisation_id", context.organisation.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("approved_assets")
      .select("*")
      .eq("organisation_id", context.organisation.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("approved_examples")
      .select("*")
      .eq("organisation_id", context.organisation.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("brand_disclaimers")
      .select("*")
      .eq("organisation_id", context.organisation.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <div className="brutal-panel bg-white p-5">
        <SectionLabel number="04" title="BRAND KNOWLEDGE VAULT" />
        <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
          APPROVED EVIDENCE & GOVERNANCE VAULT
        </h1>
        <p className="text-xs sm:text-sm text-[#637367] mt-0.5 font-medium">
          Authoritative brand facts, empirical benchmark reports, terminology rules, and published guidelines governing all verification runs.
        </p>
      </div>

      <KnowledgeVaultTabs
        facts={facts || []}
        terms={terms || []}
        guidelines={guidelines || []}
        assets={assets || []}
        examples={examples || []}
        disclaimers={disclaimers || []}
        userRole={context.role}
      />
    </div>
  );
}
