import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const demoPassword = process.env.DEMO_PASSWORD || "ChangeMe-Demo-2026!";

describe("Multi-tenant RLS Isolation Test", () => {
  it("proves a Nova Creative member cannot read Orbit Labs facts or data", async () => {
    // 1. Authenticate as Nova Creative creator using public anon key
    const novaClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await novaClient.auth.signInWithPassword({
      email: "creator.demo@example.com",
      password: demoPassword,
    });

    if (authError && (authError.message?.includes("fetch failed") || (authError as any).name === "AuthRetryableFetchError")) {
      console.warn("Skipping live database isolation test: local Supabase is offline");
      return;
    }

    expect(authError).toBeNull();
    expect(authData.session).toBeDefined();

    // 2. Query approved_facts
    const { data: facts, error: factsError } = await novaClient
      .from("approved_facts")
      .select("id, name, value, organisation_id");

    expect(factsError).toBeNull();
    expect(facts).toBeDefined();
    expect(facts!.length).toBeGreaterThan(0);

    // 3. Verify Nova facts are visible
    const pilotFact = facts!.find((f) => f.name.includes("Task Completion Time"));
    expect(pilotFact).toBeDefined();

    // 4. Verify Orbit Labs facts are COMPLETELY INVISIBLE to Nova Creative member
    const orbitFact = facts!.find((f) => f.name.includes("Orbit Platform Uptime"));
    expect(orbitFact).toBeUndefined();

    // 5. Query organisations table directly: Nova Creative user can ONLY see Nova Creative
    const { data: orgs, error: orgsError } = await novaClient
      .from("organisations")
      .select("id, name, slug");

    expect(orgsError).toBeNull();
    const hasOrbitOrg = orgs!.some((o) => o.slug === "orbit-labs");
    expect(hasOrbitOrg).toBe(false);

    const hasNovaOrg = orgs!.some((o) => o.slug === "nova-creative");
    expect(hasNovaOrg).toBe(true);
  });
});
