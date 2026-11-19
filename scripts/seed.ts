import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const demoPassword = process.env.DEMO_PASSWORD || "ChangeMe-Demo-2026!";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findOrCreateUser(email: string, fullName: string, department: string) {
  const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  const existing = listData.users.find((u) => u.email === email);
  let userId: string;

  if (existing) {
    userId = existing.id;
    await supabase.auth.admin.updateUserById(userId, {
      password: demoPassword,
      user_metadata: { full_name: fullName, department },
      email_confirm: true,
    });
  } else {
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: demoPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName, department },
    });
    if (createError) throw createError;
    userId = createData.user.id;
  }

  // Ensure profile exists in profiles table
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    email,
    full_name: fullName,
    department,
    updated_at: new Date().toISOString(),
  });
  if (profileError) throw profileError;

  return userId;
}

async function seed() {
  console.log("🌱 Starting PROOFLOOM Database Seeding...");

  // 1. Create or get Demo Users
  console.log("Creating/updating demo auth users...");
  const adminId = await findOrCreateUser("admin.demo@example.com", "Alex Vance (Admin)", "Executive");
  const managerId = await findOrCreateUser("manager.demo@example.com", "Morgan Riley (Brand Manager)", "Brand Governance");
  const creatorId = await findOrCreateUser("creator.demo@example.com", "Casey Jordan (Creator)", "Product Marketing");
  const reviewerId = await findOrCreateUser("reviewer.demo@example.com", "Sam Taylor (Reviewer)", "Legal & Compliance");
  const orbitUserId = await findOrCreateUser("orbit.user@example.com", "Dr. Elena Rostova", "Research");

  // 2. Clear previous demo data for Nova Creative and Orbit Labs (Idempotent cleanup)
  console.log("Cleaning up previous demo organisations...");
  const { error: cleanupErr } = await supabase.rpc("cleanup_demo_organisations");
  if (cleanupErr) {
    console.warn("RPC cleanup warning (falling back to direct delete):", cleanupErr.message);
    const { data: existingOrgs } = await supabase
      .from("organisations")
      .select("id, slug")
      .in("slug", ["nova-creative", "orbit-labs"]);

    if (existingOrgs && existingOrgs.length > 0) {
      for (const org of existingOrgs) {
        await supabase.from("organisations").delete().eq("id", org.id);
      }
    }
  }

  // 3. Create Nova Creative Organisation
  console.log("Creating organisation: Nova Creative...");
  const { data: novaOrg, error: novaErr } = await supabase
    .from("organisations")
    .insert({
      name: "Nova Creative",
      slug: "nova-creative",
      is_demo: true,
    })
    .select()
    .single();
  if (novaErr) throw novaErr;
  const novaId = novaOrg.id;

  // 4. Create Orbit Labs Organisation (for multi-tenant isolation testing)
  console.log("Creating organisation: Orbit Labs...");
  const { data: orbitOrg, error: orbitErr } = await supabase
    .from("organisations")
    .insert({
      name: "Orbit Labs",
      slug: "orbit-labs",
      is_demo: true,
    })
    .select()
    .single();
  if (orbitErr) throw orbitErr;
  const orbitId = orbitOrg.id;

  // 5. Add members to Nova Creative
  await supabase.from("organisation_members").insert([
    { organisation_id: novaId, user_id: adminId, role: "admin" },
    { organisation_id: novaId, user_id: managerId, role: "brand_manager" },
    { organisation_id: novaId, user_id: creatorId, role: "creator" },
    { organisation_id: novaId, user_id: reviewerId, role: "reviewer" },
  ]);

  // Add member to Orbit Labs
  await supabase.from("organisation_members").insert([
    { organisation_id: orbitId, user_id: orbitUserId, role: "admin" },
  ]);

  // 6. Organisation Settings for Nova Creative
  await supabase.from("organisation_settings").insert({
    organisation_id: novaId,
    ai_external_allowed: true,
    scoring_weights: { voice: 25, claims: 35, terminology: 20, accessibility: 10, visual: 10 },
    scoring_deductions: { CRITICAL: 25, HIGH: 15, MEDIUM: 8, LOW: 3, INFO: 0 },
    claim_tolerance_percentage: 5.0,
    retention_days: 365,
  });

  // Settings for Orbit Labs
  await supabase.from("organisation_settings").insert({
    organisation_id: orbitId,
    ai_external_allowed: false,
    scoring_weights: { voice: 25, claims: 35, terminology: 20, accessibility: 10, visual: 10 },
    scoring_deductions: { CRITICAL: 25, HIGH: 15, MEDIUM: 8, LOW: 3, INFO: 0 },
    claim_tolerance_percentage: 5.0,
  });

  // 7. Brand Guidelines (~14 total: 12 published with versions, 1 draft, 1 archived)
  console.log("Seeding comprehensive brand guidelines (14 guidelines)...");
  await supabase.from("brand_guidelines").insert([
    {
      organisation_id: novaId,
      title: "Nova Creative Core Brand Voice & Tone",
      category: "voice",
      version: "2.1",
      status: "published",
      published_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      tone_attributes: ["Confident", "Approachable", "Educational", "Clear", "Human", "Professional"],
      body: "Nova Creative communicates with confident clarity, technical precision, and approachable professionalism. We build tools that empower human teams rather than replacing them. Every sentence should educate, inform, or guide the reader toward measurable outcomes without resorting to aggressive or hollow hype.",
      rules: [
        "No exaggerated promises or unverified claims.",
        "No unsupported superlatives (e.g. '#1', 'world's fastest', 'unbeatable').",
        "No aggressive or combative sales language (e.g. 'destroy', 'crush', 'kill').",
        "Always include required disclaimers with performance and productivity statistics.",
        "Preserve clarity and speak to creators with respect and technical rigor."
      ],
      prohibited_terms: [
        "destroy", "crush", "revolutionary", "game-changing", "unbeatable",
        "#1", "guaranteed", "world's fastest", "autonomous employee replacement system"
      ],
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Brand Personality & Emotional Resonance",
      category: "voice",
      version: "1.4",
      status: "published",
      published_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      tone_attributes: ["Empathetic", "Rigorous", "Transparent", "Constructive"],
      body: "Our brand personality reflects an experienced technical partner: empathetic to creator struggles, rigorous in verification, and transparent about capabilities. When in doubt, favor straightforward explanations over clever marketing wordplay.",
      rules: [
        "Emphasize collaboration between AI assistance and human creative judgment.",
        "Acknowledge edge cases and limitations honestly.",
        "Avoid condescending or overly simplistic product walkthroughs."
      ],
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Writing Rules: Active Voice & Plain Language",
      category: "content_style",
      version: "2.0",
      status: "published",
      published_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      body: "Write crisp, action-oriented copy. Readers skim digital content; sentences exceeding 25 words create cognitive friction and will be flagged by the audit engine. Ensure headings follow sentence-case capitalization (e.g. 'Enterprise brand governance at scale' rather than Title Case).",
      rules: [
        "Use active voice wherever possible (e.g., 'Teams verify claims', not 'Claims are verified by teams').",
        "Keep sentences under 25 words to optimize cognitive accessibility.",
        "Use plain language over opaque industry buzzwords.",
        "Use sentence-case for all headings and subheadings."
      ],
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Messaging Principles: Outcome-First Framing",
      category: "messaging",
      version: "1.8",
      status: "published",
      published_at: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
      body: "Focus messaging on the tangible business outcome delivered to our customers: time reclaimed, compliance risk mitigated, and brand consistency preserved. Never state a quantitative benefit without citing an audited evidence source.",
      rules: [
        "Always lead with the customer outcome rather than internal feature mechanics.",
        "Every numeric statistic requires an authoritative approved benchmark in the vault.",
        "No comparative claims without an authorized third-party source."
      ],
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Prohibited Language & Superlative Restrictions",
      category: "compliance",
      version: "2.2",
      status: "published",
      published_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      body: "Superlative claims invite regulatory scrutiny and erode buyer trust. Content containing unsupported superlatives or combative language will be blocked from publication until revised with verified intent-preserving alternatives.",
      rules: [
        "Never use unprovable superlatives such as '#1', 'world's fastest', or 'unbeatable'.",
        "Avoid combative or violent sales verbs like 'destroy', 'crush', or 'kill'.",
        "Eliminate hollow buzzwords including 'revolutionary', 'game-changing', 'disrupt', and 'synergy'."
      ],
      prohibited_terms: ["#1", "world's fastest", "unbeatable", "destroy", "crush", "kill", "revolutionary", "game-changing"],
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Required Language & Attribution Standards",
      category: "compliance",
      version: "1.5",
      status: "published",
      published_at: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString(),
      body: "Whenever citing pilot statistics or performance gains (e.g., our 18% task completion improvement), creators must append the statutory disclaimer: 'Results based on an internal pilot; individual results may vary.'",
      rules: [
        "Append the mandatory pilot disclaimer to any performance percentage claim.",
        "Include trademark notices on first mention of proprietary product names.",
        "Disclose human-in-the-loop oversight when discussing AI capabilities."
      ],
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Audience Guidelines: Operations, Executives & Developers",
      category: "audience",
      version: "1.2",
      status: "published",
      published_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      body: "Tailor copy depth to the target persona. Operations managers value queue balancing and time savings; executive leaders care about governance visibility and compliance shields; technical developers require API rigor and isolation security.",
      rules: [
        "Operations Managers: focus on workflow orchestration, queue balancing, and audit history.",
        "Executives: focus on enterprise risk reduction, brand integrity index, and governance ROI.",
        "Developers: focus on deterministic API checks, Webhook integrations, and RLS multi-tenancy."
      ],
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Visual Identity & Vector Emblem Standards",
      category: "visual",
      version: "3.0",
      status: "published",
      published_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      body: "Our visual identity is grounded in neo-brutalist technical precision. Use hard 2px offset borders (#253C2B), solid paper backgrounds (#F4F1E8), and crisp signal lime (#B7F28B) accents. Never apply soft blurs or drop-shadows.",
      rules: [
        "Adhere strictly to official brand palette: #16834A (forest), #B7F28B (signal lime), #17251C (machine ink), #F4F1E8 (blueprint paper), #253C2B (border).",
        "Maintain minimum clear space of 24px around the PROOFLOOM emblem.",
        "Do not stretch, rotate, skew, or recolour official vector marks.",
        "Minimum display size is 120px wide on desktop screens."
      ],
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Digital Accessibility & Readability Standards",
      category: "accessibility",
      version: "2.0",
      status: "published",
      published_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      body: "Accessibility is a non-negotiable core standard. All copy must achieve high readability scores, provide meaningful link context (e.g. 'Read our pilot methodology report'), and ensure complete visual legibility across devices.",
      rules: [
        "Provide descriptive alt text for all embedded image assets.",
        "Never use generic link text such as 'click here' or 'learn more'; specify the destination.",
        "Maintain minimum WCAG AAA color contrast across text and interactive buttons.",
        "Structure long articles with sequential, logical heading levels (H1, H2, H3)."
      ],
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Multi-Channel Distribution Rules (LinkedIn, X, Email, PR)",
      category: "distribution",
      version: "1.6",
      status: "published",
      published_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      body: "Optimize copy structure for destination channels. Social posts must lead with an engaging hook; email dispatches should maintain brevity with a single clear action; formal press releases must follow traditional inverted pyramid news structure.",
      rules: [
        "LinkedIn: professional insight tone, maximum 3 relevant hashtags, lead with a strong hook line.",
        "Instagram: visual-first, conversational caption, all key links directed to bio or verified landing pages.",
        "X (Twitter): concise under 240 characters, focused on single product insight or milestone.",
        "Email: subject lines under 50 characters, single primary CTA above the fold.",
        "Press Releases: standard AP newsroom style, city dateline, third-person perspective only."
      ],
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Competitor References & Objective Comparison",
      category: "competitive",
      version: "1.1",
      status: "published",
      published_at: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(),
      body: "We win on engineering rigor and verified proof, not mudslinging. When comparing platform workflows, present objective feature matrices substantiated by documented public specifications.",
      rules: [
        "Never disparage or attack competitors by name.",
        "Comparative matrices must reflect publicly verifiable feature sets as of the current quarter.",
        "Always credit competitor trademarks to their respective owners.",
        "Focus differentiation on verified provenance and deterministic evidence capabilities."
      ],
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Claims & Evidence Verification Policy",
      category: "evidence_policy",
      version: "2.5",
      status: "published",
      published_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      body: "The thread of proof is our company's foundational promise. No marketing claim may be deployed publicly without deterministic verification against an active, unexpired evidence benchmark in the Brand Knowledge Vault.",
      rules: [
        "Every quantitative assertion must match an approved fact in the Brand Knowledge Vault within 5% tolerance.",
        "Expired or superseded metrics must never be published in new marketing copy.",
        "Claims lacking authoritative vault benchmarks are flagged as UNSUPPORTED and blocked from publishing.",
        "All performance gains require statistical sample sizes and methodology documentation."
      ],
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Generative AI Oversight & Human Co-Pilot Protocol",
      category: "emerging_tech",
      version: "0.9",
      status: "draft",
      body: "Upcoming operational framework for governing generative AI copy suggestions. Mandates creator review and transparent disclosure of automated workflow stages.",
      rules: [
        "Human-in-the-loop sign-off required for all AI-generated copy variants.",
        "Mandatory intent-preservation audit on suggested rewrites before publication."
      ],
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Legacy Launch Messaging Framework 2024",
      category: "archive",
      version: "1.0",
      status: "archived",
      body: "Archived launch messaging guidelines from platform genesis. Superseded by Core Brand Voice & Tone v2.1. Preserved for audit compliance and historical traceability.",
      rules: [
        "Deprecated legacy messaging framework from platform inception."
      ],
      is_demo: true,
    },
  ]);

  // 8. Evidence Sources (Documents)
  console.log("Seeding evidence sources...");
  const now = new Date();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fiveMonthsFuture = new Date(now.getTime() + 150 * 24 * 60 * 60 * 1000);
  const nineMonthsFuture = new Date(now.getTime() + 270 * 24 * 60 * 60 * 1000);
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const { data: pilotDoc } = await supabase.from("evidence_sources").insert({
    organisation_id: novaId,
    name: "Internal Productivity Pilot Report v2",
    version: "2.0",
    category: "Research & Benchmarks",
    owner: "Dr. Karen Stone, Research Lead",
    approval_status: "APPROVED",
    last_verified_at: sixtyDaysAgo.toISOString(),
    expires_at: nineMonthsFuture.toISOString(),
    summary: "Rigorous empirical evaluation across 450 users over 6 weeks measuring task completion time reductions.",
    raw_text: "Across the 450-participant randomized trial, users demonstrated an average 18% improvement in task completion time (p < 0.01) when using guided workflows. Individual results may vary based on task complexity.",
    is_demo: true,
  }).select().single();

  const { data: customerDoc } = await supabase.from("evidence_sources").insert({
    organisation_id: novaId,
    name: "Q3 Verified Enterprise Metrics",
    version: "3.2",
    category: "Financial & Operating Metrics",
    owner: "Finance & Operations Audit",
    approval_status: "APPROVED",
    last_verified_at: thirtyDaysAgo.toISOString(),
    expires_at: fiveMonthsFuture.toISOString(),
    summary: "Audited customer account counts and active subscriptions as of Q3 closing.",
    raw_text: "As of the close of Q3, Nova Creative serves 12,400 active commercial businesses worldwide across North America, Europe, and Asia-Pacific.",
    is_demo: true,
  }).select().single();

  // Orbit Labs private fact (used for isolation testing)
  await supabase.from("approved_facts").insert({
    organisation_id: orbitId,
    name: "Orbit Platform Uptime SLA",
    value: "99.99% uptime guarantee",
    numeric_value: 99.99,
    unit: "%",
    metric: "uptime",
    description: "Orbit Labs proprietary SLA for enterprise telemetry clusters.",
    approval_status: "APPROVED",
    owner: "Dr. Elena Rostova",
    is_demo: true,
  });

  // 9. Approved Facts in Nova Creative (~12 facts with owners, sources, versions, dates, expiries)
  console.log("Seeding comprehensive approved facts (12 facts)...");
  // Fact 1: Pilot 18%
  const { data: factPilot } = await supabase.from("approved_facts").insert({
    organisation_id: novaId,
    name: "Task Completion Time Improvement",
    value: "18% improvement in task completion time in an internal pilot",
    numeric_value: 18,
    unit: "%",
    metric: "productivity_task_completion",
    description: "Empirical pilot study benchmark for guided workflows.",
    source_id: pilotDoc?.id,
    source_version: "2.0",
    approval_status: "APPROVED",
    owner: "Product Marketing & Research",
    verified_at: sixtyDaysAgo.toISOString(),
    expires_at: nineMonthsFuture.toISOString(),
    source_citation: "Internal Productivity Pilot Report v2 (p. 4)",
    is_demo: true,
  }).select().single();

  // Fact 2: Active customer count (12,400)
  const { data: factCustomerCount } = await supabase.from("approved_facts").insert({
    organisation_id: novaId,
    name: "Verified Customer Base",
    value: "12,400 businesses worldwide",
    numeric_value: 12400,
    unit: "businesses",
    metric: "customer_business_count",
    description: "Audited count of active businesses as of Q3 closing.",
    source_id: customerDoc?.id,
    source_version: "3.2",
    approval_status: "APPROVED",
    owner: "Finance & Operations",
    verified_at: thirtyDaysAgo.toISOString(),
    expires_at: fiveMonthsFuture.toISOString(),
    source_citation: "Q3 Verified Enterprise Metrics (Table 2)",
    is_demo: true,
  }).select().single();

  // Fact 3: Superseded customer count (8,000) -> Expired and points to Fact 2
  await supabase.from("approved_facts").insert({
    organisation_id: novaId,
    name: "Legacy Customer Count (Q1)",
    value: "8,000 businesses",
    numeric_value: 8000,
    unit: "businesses",
    metric: "customer_business_count",
    description: "Historic customer count from earlier fiscal year.",
    approval_status: "EXPIRED",
    owner: "Finance & Operations",
    verified_at: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    expires_at: twoMonthsAgo.toISOString(),
    superseded_by: factCustomerCount?.id,
    source_citation: "Q1 Historic Operating Report",
    is_demo: true,
  });

  // Fact 4: Feature Descriptions - Smart Scheduler
  await supabase.from("approved_facts").insert({
    organisation_id: novaId,
    name: "Product: Smart Scheduler",
    value: "Smart Scheduler automatically coordinates cross-timezone content calendars with algorithmic queue balancing.",
    metric: "product description",
    approval_status: "APPROVED",
    owner: "Product Management",
    verified_at: thirtyDaysAgo.toISOString(),
    expires_at: fiveMonthsFuture.toISOString(),
    source_version: "1.0",
    source_citation: "Official Product Spec Sheet 2026",
    is_demo: true,
  });

  // Fact 5: Feature Descriptions - Insight Digest
  await supabase.from("approved_facts").insert({
    organisation_id: novaId,
    name: "Product: Insight Digest",
    value: "Insight Digest summarizes weekly team governance analytics and highlighted brand drift alerts into an actionable executive summary.",
    metric: "product description",
    approval_status: "APPROVED",
    owner: "Product Management",
    verified_at: thirtyDaysAgo.toISOString(),
    expires_at: fiveMonthsFuture.toISOString(),
    source_version: "1.0",
    source_citation: "Official Product Spec Sheet 2026",
    is_demo: true,
  });

  // Fact 6: Supported Platforms
  await supabase.from("approved_facts").insert({
    organisation_id: novaId,
    name: "Supported Publishing Platforms",
    value: "Direct publishing integrations with LinkedIn, Instagram, X (Twitter), Slack, Webhooks, and Email ESPs.",
    metric: "integrations",
    approval_status: "APPROVED",
    owner: "Engineering Integrations",
    verified_at: thirtyDaysAgo.toISOString(),
    expires_at: nineMonthsFuture.toISOString(),
    source_version: "4.1",
    source_citation: "Integration Capabilities Matrix v4",
    is_demo: true,
  });

  // Fact 7: Support Hours
  await supabase.from("approved_facts").insert({
    organisation_id: novaId,
    name: "Enterprise Support Coverage",
    value: "24/7 global support with guaranteed 1-hour initial response SLA for Enterprise tier workspaces; 8am-8pm EST Monday-Friday for Growth plans.",
    metric: "sla support",
    approval_status: "APPROVED",
    owner: "Customer Operations",
    verified_at: thirtyDaysAgo.toISOString(),
    expires_at: nineMonthsFuture.toISOString(),
    source_version: "2.1",
    source_citation: "Global Customer SLA Handbook",
    is_demo: true,
  });

  // Fact 8: Plan Names
  await supabase.from("approved_facts").insert({
    organisation_id: novaId,
    name: "Commercial Subscription Tiers",
    value: "Commercial product plans available in Starter, Professional, Growth, and Custom Enterprise tiers.",
    metric: "packaging",
    approval_status: "APPROVED",
    owner: "Revenue Operations",
    verified_at: thirtyDaysAgo.toISOString(),
    expires_at: nineMonthsFuture.toISOString(),
    source_version: "2.0",
    source_citation: "2026 Packaging & Pricing Guide",
    is_demo: true,
  });

  // Fact 9: One fact expiring within 20 days (e.g. 14 days remaining)
  const fourteenDaysFuture = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  await supabase.from("approved_facts").insert({
    organisation_id: novaId,
    name: "Q4 Platform Active User Benchmark",
    value: "48,500 monthly active enterprise users across registered commercial workspaces.",
    numeric_value: 48500,
    unit: "users",
    metric: "active users",
    approval_status: "APPROVED",
    owner: "Data Analytics & Telemetry",
    verified_at: sixtyDaysAgo.toISOString(),
    expires_at: fourteenDaysFuture.toISOString(),
    source_version: "4.0",
    source_citation: "Q4 Platform Usage Audit (Expiring Soon)",
    is_demo: true,
  });

  // Fact 10: One already expired
  await supabase.from("approved_facts").insert({
    organisation_id: novaId,
    name: "2024 Historic Uptime Achievement",
    value: "99.85% platform infrastructure availability during fiscal year 2024.",
    numeric_value: 99.85,
    unit: "%",
    metric: "uptime",
    approval_status: "EXPIRED",
    owner: "Infrastructure Engineering",
    verified_at: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
    expires_at: twoMonthsAgo.toISOString(),
    source_version: "1.0",
    source_citation: "2024 Historic Infrastructure Review",
    is_demo: true,
  });

  // Fact 11: One pending approval (not authoritative)
  await supabase.from("approved_facts").insert({
    organisation_id: novaId,
    name: "Projected Review Time Reduction Estimate",
    value: "Estimated 35% reduction in external legal and compliance copy turnaround cycles based on initial customer cohort telemetry.",
    numeric_value: 35,
    unit: "%",
    metric: "projected reduction",
    approval_status: "PENDING",
    owner: "Sales Enablement & Value Engineering",
    verified_at: null,
    expires_at: fiveMonthsFuture.toISOString(),
    source_version: "0.4",
    source_citation: "Preliminary Value Modeling Draft v0.4 (Under Review)",
    is_demo: true,
  });

  // Fact 12: One rejected (not authoritative)
  await supabase.from("approved_facts").insert({
    organisation_id: novaId,
    name: "Unverified Third-Party Survey Satisfaction Score",
    value: "Claimed 99.4% customer satisfaction rating from an unverified public online poll.",
    numeric_value: 99.4,
    unit: "%",
    metric: "satisfaction score",
    approval_status: "REJECTED",
    owner: "External Marketing Agency",
    verified_at: null,
    expires_at: null,
    source_version: "1.0",
    source_citation: "Unverified Web Survey Results (Rejected by Legal)",
    is_demo: true,
  });

  // 10. Terminology Rules (~25 rules with approved term, disallowed alternative, explanation, example)
  console.log("Seeding corporate terminology standards (25 rules)...");
  await supabase.from("terminology_rules").insert([
    {
      organisation_id: novaId,
      disallowed_term: "autonomous employee replacement system",
      approved_term: "AI-powered productivity platform",
      category: "product_positioning",
      severity: "CRITICAL",
      reason: "Positioning statement: PROOFLOOM enhances and protects human creators rather than replacing them.",
      context: "Positioning statement: PROOFLOOM enhances and protects human creators rather than replacing them.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "revolutionary",
      approved_term: "new or purpose-built",
      category: "marketing_hype",
      severity: "MEDIUM",
      reason: "Marketing hype filter: avoid inflated adjectives.",
      context: "Marketing hype filter: avoid inflated adjectives.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "game-changing",
      approved_term: "modern or high-efficiency",
      category: "marketing_hype",
      severity: "MEDIUM",
      reason: "Marketing hype filter: replace generic buzzwords with concrete descriptions.",
      context: "Marketing hype filter: replace generic buzzwords with concrete descriptions.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "cutting-edge",
      approved_term: "advanced or purpose-built",
      category: "marketing_hype",
      severity: "MEDIUM",
      reason: "Avoid clichéd marketing jargon; specify concrete architectural advantages.",
      context: "Avoid clichéd marketing jargon.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "best-in-class",
      approved_term: "industry-standard or leading",
      category: "marketing_hype",
      severity: "HIGH",
      reason: "Unsubstantiated comparative claim requiring independent category certification.",
      context: "Unsubstantiated comparative claim.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "world's fastest",
      approved_term: "high-throughput",
      category: "legal_compliance",
      severity: "CRITICAL",
      reason: "Legal claim restriction: superlative benchmarks require external third-party certification.",
      context: "Legal claim restriction: superlative benchmarks require external third-party certification.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "guaranteed results",
      approved_term: "measured outcomes",
      category: "legal_compliance",
      severity: "HIGH",
      reason: "Legal liability prohibition: individual productivity depends on operational complexity.",
      context: "Legal liability prohibition.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "disrupt",
      approved_term: "streamline or modernize",
      category: "marketing_hype",
      severity: "LOW",
      reason: "Overused Silicon Valley jargon; replace with operational descriptions.",
      context: "Overused jargon.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "synergy",
      approved_term: "collaboration or alignment",
      category: "jargon",
      severity: "LOW",
      reason: "Corporate buzzword; choose clear conversational terms.",
      context: "Corporate buzzword.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "10x",
      approved_term: "accelerated or high-yield",
      category: "marketing_hype",
      severity: "HIGH",
      reason: "Unverified exponential performance claim without statistical foundation.",
      context: "Unverified exponential claim.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "SmartScheduler",
      approved_term: "Smart Scheduler",
      category: "product_spelling",
      severity: "HIGH",
      reason: "Official product name spelling requires a space between words.",
      context: "Official product naming standard.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "Smart-Scheduler",
      approved_term: "Smart Scheduler",
      category: "product_spelling",
      severity: "HIGH",
      reason: "Do not hyphenate product brand name.",
      context: "Official product naming standard.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "Insights Digest",
      approved_term: "Insight Digest",
      category: "product_spelling",
      severity: "HIGH",
      reason: "Product feature is singular: Insight Digest.",
      context: "Official product naming standard.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "NovaCreative",
      approved_term: "Nova Creative",
      category: "brand_spelling",
      severity: "CRITICAL",
      reason: "Company name consists of two distinct words separated by a space.",
      context: "Corporate entity naming standard.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "Nova Creatives",
      approved_term: "Nova Creative",
      category: "brand_spelling",
      severity: "HIGH",
      reason: "Company name is singular: Nova Creative.",
      context: "Corporate entity naming standard.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "AI powered",
      approved_term: "AI-powered",
      category: "grammar_style",
      severity: "LOW",
      reason: "Hyphenate compound adjective preceding a noun.",
      context: "Editorial style guide standard.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "A.I.",
      approved_term: "AI",
      category: "grammar_style",
      severity: "LOW",
      reason: "Omit periods in modern technical abbreviations.",
      context: "Editorial style guide standard.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "e-mail",
      approved_term: "email",
      category: "grammar_style",
      severity: "LOW",
      reason: "Modern unhyphenated form is corporate standard.",
      context: "Editorial style guide standard.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "clients",
      approved_term: "customers",
      category: "brand_vocabulary",
      severity: "MEDIUM",
      reason: "Standard corporate terminology refers to commercial users as customers.",
      context: "Brand vocabulary guide.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "log in",
      approved_term: "sign in",
      category: "ui_terminology",
      severity: "MEDIUM",
      reason: "Standard user action verb across platform navigation is 'sign in'.",
      context: "UI terminology standard.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "log out",
      approved_term: "sign out",
      category: "ui_terminology",
      severity: "MEDIUM",
      reason: "Standard user action verb is 'sign out'.",
      context: "UI terminology standard.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "unbeatable",
      approved_term: "highly competitive",
      category: "marketing_hype",
      severity: "HIGH",
      reason: "Absolute superlatives violate marketing compliance policy.",
      context: "Marketing hype filter.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "#1",
      approved_term: "leading",
      category: "legal_compliance",
      severity: "HIGH",
      reason: "Rank-order claims require third-party verification source.",
      context: "Legal claim restriction.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "crush",
      approved_term: "outperform",
      category: "brand_voice",
      severity: "HIGH",
      reason: "Eliminate violent, combative rhetoric in commercial communication.",
      context: "Brand voice standard.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "destroy",
      approved_term: "surpass",
      category: "brand_voice",
      severity: "HIGH",
      reason: "Eliminate combative and violent verbs.",
      context: "Brand voice standard.",
      is_demo: true,
    },
  ]);

  // 11. Disclaimers & Policies (~6 statutory disclaimers with triggers)
  console.log("Seeding mandatory disclaimers & policies (6 disclaimers)...");
  await supabase.from("brand_disclaimers").insert([
    {
      organisation_id: novaId,
      title: "Pilot Performance Metric Disclaimer",
      trigger: "Enforced whenever numeric speed, time-saving, or productivity percentages are cited.",
      disclaimer_text: "Results based on an internal pilot; individual results may vary.",
      is_mandatory: true,
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Customer Testimonial & Case Study Endorsement",
      trigger: "Applies to any quoted customer feedback or individual endorsement.",
      disclaimer_text: "Customer testimonials reflect individual experiences. Outcomes may vary across operational environments.",
      is_mandatory: true,
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Competitive Comparison Substantiation Policy",
      trigger: "Applies to any side-by-side platform or feature comparison matrix.",
      disclaimer_text: "Comparison based on publicly available features as of Q3 2026. Competitor trademarks belong to their respective owners.",
      is_mandatory: true,
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "AI-Assisted Verification & Generative Disclosure",
      trigger: "Enforced when content describes automated generative copy or algorithmic audits.",
      disclaimer_text: "PROOFLOOM uses human-in-the-loop AI governance. All automated suggestions require qualified human review.",
      is_mandatory: true,
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Customer Data Privacy & Enterprise Telemetry Policy",
      trigger: "Applies to product onboarding and technical architecture documentation.",
      disclaimer_text: "Nova Creative does not use customer content to train shared foundation models. Enterprise tenant data remains strictly isolated.",
      is_mandatory: true,
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Forward-Looking Product Roadmap Disclaimer",
      trigger: "Applies to unreleased product features or future milestone statements.",
      disclaimer_text: "Roadmap features and release schedules are subject to change without notice based on engineering feasibility.",
      is_mandatory: false,
      is_demo: true,
    },
  ]);

  // 12. Approved Examples (~8 gold-standard copy examples with 'why this works')
  console.log("Seeding approved copy examples (8 examples)...");
  await supabase.from("approved_examples").insert([
    {
      organisation_id: novaId,
      title: "Productivity Pilot LinkedIn Announcement",
      category: "LinkedIn Post",
      content: "Our AI-powered productivity platform helps teams work smarter. In an internal pilot, teams saw an 18% improvement in task completion time. Results based on an internal pilot; individual results may vary.",
      why_it_works: "Pairs an authoritative empirical statistic with the required legal disclaimer, uses approved product naming, and maintains an approachable professional tone.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Customer Growth Milestone Share",
      category: "LinkedIn Post",
      content: "More than 12,400 forward-thinking businesses now rely on Nova Creative to ensure brand consistency across every channel. Join them today.",
      why_it_works: "Cites current verified benchmark customer metric without hyperbole; leads with customer trust and momentum.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Smart Scheduler Launch Announcement",
      category: "LinkedIn Post",
      content: "Say hello to Smart Scheduler: our new tool designed to coordinate cross-timezone content calendars automatically. Simplify your planning from day one.",
      why_it_works: "Highlights customer benefit first, uses approved product spelling, and avoids hollow buzzwords.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Executive Governance Digest Email Subject Line",
      category: "Email Subject Line",
      content: "Your Weekly Insight Digest: 3 brand governance wins and 1 drift alert to review",
      why_it_works: "Under 60 characters, front-loads the value, uses exact feature name, and sets clear expectations.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Feature Availability Notification Email Subject Line",
      category: "Email Subject Line",
      content: "New in Nova Creative: Smart Scheduler is now live for all teams",
      why_it_works: "Clear, direct, sentence-case, approved brand capitalization, zero spam triggers.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Official Brand Homepage Hero Headline",
      category: "Website Headline",
      content: "Where every brand claim has a thread of proof.",
      why_it_works: "Memorable brand tagline, zero empty superlatives, communicates concrete governance value.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Global Enterprise Adoption Press Release Opening",
      category: "Press Release",
      content: "NEW YORK — Nova Creative today announced the expansion of its brand integrity platform to serve over 12,400 commercial enterprises across global markets.",
      why_it_works: "Follows AP news style, active voice, factual audited figure, professional newsroom standard.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      title: "Smart Scheduler Canonical Feature Overview",
      category: "Product Description",
      content: "Smart Scheduler is an AI-powered content coordination engine that balances team review queues and automates multi-channel publishing calendars.",
      why_it_works: "Lead with what the tool does for the user; active voice, approved terminology, zero buzzwords.",
      is_demo: true,
    },
  ]);

  // 13. Approved Assets & SVG Storage Upload (~6 assets)
  console.log("Seeding approved assets and uploading SVGs to storage...");
  const svgAssets = [
    {
      filename: "primary-logo.svg",
      name: "Nova Creative Primary Emblem",
      asset_type: "logo",
      description: "Official forest green emblem with signal lime monogram. Minimum width 120px with 24px clear space.",
      content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" width="240" height="80"><rect width="240" height="80" fill="#16834A" rx="4" stroke="#253C2B" stroke-width="3"/><rect x="12" y="12" width="56" height="56" fill="#B7F28B" stroke="#253C2B" stroke-width="2"/><text x="40" y="48" font-family="monospace" font-size="28" font-weight="900" fill="#17251C" text-anchor="middle">PL</text><text x="80" y="42" font-family="monospace" font-size="20" font-weight="800" fill="#F4F1E8" letter-spacing="2">PROOFLOOM</text><text x="80" y="58" font-family="monospace" font-size="9" font-weight="700" fill="#B7F28B" letter-spacing="1.5">BRAND INTEGRITY</text></svg>`,
    },
    {
      filename: "mono-logo.svg",
      name: "Monochrome Print Mark",
      asset_type: "logo",
      description: "Solid machine ink emblem on blueprint paper for black-and-white documentation.",
      content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" width="240" height="80"><rect width="240" height="80" fill="#F4F1E8" rx="4" stroke="#17251C" stroke-width="3"/><rect x="12" y="12" width="56" height="56" fill="#17251C"/><text x="40" y="48" font-family="monospace" font-size="28" font-weight="900" fill="#F4F1E8" text-anchor="middle">PL</text><text x="80" y="42" font-family="monospace" font-size="20" font-weight="800" fill="#17251C" letter-spacing="2">PROOFLOOM</text><text x="80" y="58" font-family="monospace" font-size="9" font-weight="700" fill="#17251C" letter-spacing="1.5">MONO EMBLEM</text></svg>`,
    },
    {
      filename: "color-palette-sheet.svg",
      name: "Official Brand Palette 2026",
      asset_type: "color_palette",
      description: "Official 5-color token sheet: Forest #16834A, Signal Lime #B7F28B, Ink #17251C, Blueprint #F4F1E8, Border #253C2B.",
      content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240"><rect width="600" height="240" fill="#F4F1E8" stroke="#253C2B" stroke-width="3"/><text x="24" y="36" font-family="monospace" font-size="14" font-weight="900" fill="#17251C">NOVA CREATIVE — OFFICIAL BRAND PALETTE 2026</text><rect x="24" y="56" width="96" height="96" fill="#16834A" stroke="#253C2B" stroke-width="2"/><text x="72" y="176" font-family="monospace" font-size="11" font-weight="800" fill="#17251C" text-anchor="middle">FOREST</text><text x="72" y="192" font-family="monospace" font-size="10" font-weight="600" fill="#637367" text-anchor="middle">#16834A</text><rect x="136" y="56" width="96" height="96" fill="#B7F28B" stroke="#253C2B" stroke-width="2"/><text x="184" y="176" font-family="monospace" font-size="11" font-weight="800" fill="#17251C" text-anchor="middle">LIME</text><text x="184" y="192" font-family="monospace" font-size="10" font-weight="600" fill="#637367" text-anchor="middle">#B7F28B</text><rect x="248" y="56" width="96" height="96" fill="#17251C" stroke="#253C2B" stroke-width="2"/><text x="296" y="176" font-family="monospace" font-size="11" font-weight="800" fill="#17251C" text-anchor="middle">INK</text><text x="296" y="192" font-family="monospace" font-size="10" font-weight="600" fill="#637367" text-anchor="middle">#17251C</text><rect x="360" y="56" width="96" height="96" fill="#F4F1E8" stroke="#253C2B" stroke-width="2"/><text x="408" y="176" font-family="monospace" font-size="11" font-weight="800" fill="#17251C" text-anchor="middle">PAPER</text><text x="408" y="192" font-family="monospace" font-size="10" font-weight="600" fill="#637367" text-anchor="middle">#F4F1E8</text><rect x="472" y="56" width="96" height="96" fill="#253C2B" stroke="#253C2B" stroke-width="2"/><text x="520" y="176" font-family="monospace" font-size="11" font-weight="800" fill="#17251C" text-anchor="middle">BORDER</text><text x="520" y="192" font-family="monospace" font-size="10" font-weight="600" fill="#637367" text-anchor="middle">#253C2B</text></svg>`,
    },
    {
      filename: "social-post-template.svg",
      name: "Social Post Layout Template",
      asset_type: "template",
      description: "1200x630 blueprint social card with neo-brutalist border and empirical proof stat container.",
      content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630"><rect width="1200" height="630" fill="#F4F1E8"/><rect x="40" y="40" width="1120" height="550" fill="#FFFFFF" stroke="#253C2B" stroke-width="4"/><rect x="60" y="60" width="1080" height="80" fill="#16834A" stroke="#253C2B" stroke-width="3"/><text x="90" y="110" font-family="monospace" font-size="28" font-weight="900" fill="#B7F28B">NOVA CREATIVE // VERIFIED POST</text><rect x="60" y="180" width="700" height="370" fill="#F4F1E8" stroke="#253C2B" stroke-width="2"/><text x="90" y="240" font-family="monospace" font-size="24" font-weight="700" fill="#17251C">HEADLINE GOES HERE</text><text x="90" y="290" font-family="monospace" font-size="16" fill="#637367">Lead with empirical customer outcome. Keep copy under 25 words per sentence.</text><rect x="800" y="180" width="340" height="370" fill="#16834A" stroke="#253C2B" stroke-width="2"/><text x="970" y="370" font-family="monospace" font-size="48" font-weight="900" fill="#B7F28B" text-anchor="middle">18%</text><text x="970" y="410" font-family="monospace" font-size="14" font-weight="700" fill="#F4F1E8" text-anchor="middle">PILOT IMPROVEMENT</text></svg>`,
    },
    {
      filename: "email-header-banner.svg",
      name: "Email Dispatch Header Banner",
      asset_type: "imagery",
      description: "600x150 responsive email header banner for weekly governance alerts and release notes.",
      content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 150" width="600" height="150"><rect width="600" height="150" fill="#16834A" stroke="#253C2B" stroke-width="3"/><rect x="24" y="24" width="48" height="48" fill="#B7F28B" stroke="#253C2B" stroke-width="2"/><text x="48" y="56" font-family="monospace" font-size="22" font-weight="900" fill="#17251C" text-anchor="middle">PL</text><text x="88" y="54" font-family="monospace" font-size="22" font-weight="800" fill="#F4F1E8">NOVA CREATIVE</text><line x1="24" y1="88" x2="576" y2="88" stroke="#B7F28B" stroke-width="2"/><text x="24" y="118" font-family="monospace" font-size="12" font-weight="700" fill="#F4F1E8">GOVERNANCE &amp; BRAND INTEGRITY DISPATCH</text><text x="576" y="118" font-family="monospace" font-size="11" font-weight="700" fill="#B7F28B" text-anchor="end">WEEKLY EDITION</text></svg>`,
    },
    {
      filename: "icon-set-collection.svg",
      name: "Core Brand Icon Set",
      asset_type: "template",
      description: "Vector icon set: Shield (governance), Check (verification), Scale (benchmarks), Database (vault).",
      content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" width="400" height="100"><rect width="400" height="100" fill="#F4F1E8" stroke="#253C2B" stroke-width="2"/><g transform="translate(30, 20)"><rect width="60" height="60" fill="#16834A" stroke="#253C2B" stroke-width="2" rx="4"/><path d="M30 14 L44 20 V32 C44 42 30 48 30 48 C30 48 16 42 16 32 V20 Z" fill="#B7F28B" stroke="#17251C" stroke-width="2"/></g><g transform="translate(120, 20)"><rect width="60" height="60" fill="#B7F28B" stroke="#253C2B" stroke-width="2" rx="4"/><polyline points="20,30 27,37 42,22" fill="none" stroke="#17251C" stroke-width="4" stroke-linecap="round"/></g><g transform="translate(210, 20)"><rect width="60" height="60" fill="#17251C" stroke="#253C2B" stroke-width="2"/><line x1="30" y1="16" x2="30" y2="44" stroke="#B7F28B" stroke-width="3"/><line x1="18" y1="24" x2="42" y2="24" stroke="#B7F28B" stroke-width="2"/><polygon points="18,24 12,36 24,36" fill="#F4F1E8"/><polygon points="42,24 36,36 48,36" fill="#F4F1E8"/></g><g transform="translate(300, 20)"><rect width="60" height="60" fill="#16834A" stroke="#253C2B" stroke-width="2" rx="4"/><ellipse cx="30" cy="22" rx="16" ry="6" fill="#B7F28B" stroke="#17251C" stroke-width="2"/><path d="M14 22 V34 C14 38 30 40 30 40 C30 40 46 38 46 34 V22" fill="none" stroke="#B7F28B" stroke-width="2"/><path d="M14 34 V44 C14 48 30 50 30 50 C30 40 46 48 46 44 V34" fill="none" stroke="#B7F28B" stroke-width="2"/></g></svg>`,
    },
  ];

  for (const asset of svgAssets) {
    const storagePath = `${novaId}/${asset.filename}`;
    const buffer = Buffer.from(asset.content, "utf-8");

    // Upload to private brand-assets bucket
    const { error: uploadErr } = await supabase.storage
      .from("brand-assets")
      .upload(storagePath, buffer, {
        contentType: "image/svg+xml",
        upsert: true,
      });

    if (uploadErr) {
      console.warn(`Warning: Storage upload for ${asset.filename} returned:`, uploadErr.message);
    }

    // Insert metadata row in approved_assets
    await supabase.from("approved_assets").insert({
      organisation_id: novaId,
      name: asset.name,
      asset_type: asset.asset_type,
      storage_path: `brand-assets/${storagePath}`,
      file_size_bytes: buffer.length,
      mime_type: "image/svg+xml",
      metadata: { description: asset.description },
      is_demo: true,
    });
  }

  // 12. Seeded Content Items & Audits (Scenarios A, B, C, D)
  console.log("Seeding flagship scenarios A, B, C, D...");

  // Scenario A: Unsupported claim (300% productivity)
  const textA = "Our platform increases productivity by 300%. Transform your daily workflow today.";
  const { data: itemA } = await supabase.from("content_items").insert({
    organisation_id: novaId,
    creator_id: creatorId,
    title: "Q4 Product Launch Announcement",
    content_type: "Social media post",
    platform: "LinkedIn",
    audience: "Enterprise Operations Leaders",
    department: "Product Marketing",
    campaign_context: "Q4 High-Growth Push",
    status: "REVISION_REQUIRED",
    current_version_no: 1,
    is_demo: true,
  }).select().single();

  const { data: verA } = await supabase.from("content_versions").insert({
    organisation_id: novaId,
    content_item_id: itemA.id,
    version_no: 1,
    body: textA,
    source: "original",
    created_by: creatorId,
    change_summary: "Initial draft submission",
  }).select().single();

  const { data: auditA } = await supabase.from("audits").insert({
    organisation_id: novaId,
    content_item_id: itemA.id,
    content_version_id: verA.id,
    status: "COMPLETED",
    mode: "demo",
    overall_score: 52,
    scores: { voice: 85, claims: 25, terminology: 90, accessibility: 95, visual: null },
    checked_dimensions: ["voice", "claims", "terminology", "accessibility"],
    started_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
    created_by: creatorId,
    is_demo: true,
  }).select().single();

  const stages = [
    { num: 1, key: "[01] CONTENT INGESTION" },
    { num: 2, key: "[02] CLAIM EXTRACTION" },
    { num: 3, key: "[03] SOURCE VERIFICATION" },
    { num: 4, key: "[04] BRAND VOICE ANALYSIS" },
    { num: 5, key: "[05] TERMINOLOGY INSPECTION" },
    { num: 6, key: "[06] ACCESSIBILITY CHECK" },
    { num: 7, key: "[07] FINAL RISK ASSESSMENT" },
  ];

  for (const s of stages) {
    await supabase.from("audit_stages").insert({
      audit_id: auditA.id,
      stage_number: s.num,
      stage_key: s.key,
      status: "COMPLETED",
      detail: `Stage verified with deterministic rules`,
      started_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      finished_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
    });
  }

  // Claim A
  const { data: claimA } = await supabase.from("extracted_claims").insert({
    organisation_id: novaId,
    audit_id: auditA.id,
    claim_text: "increases productivity by 300%",
    claim_type: "numerical",
    numeric_value: 300,
    unit: "%",
    metric: "task completion time",
    start_offset: 13,
    end_offset: 44,
    confidence: "high",
    verification_status: "CONTRADICTED",
  }).select().single();

  await supabase.from("evidence_matches").insert({
    organisation_id: novaId,
    audit_id: auditA.id,
    claim_id: claimA.id,
    approved_fact_id: factPilot?.id,
    evidence_source_id: pilotDoc?.id,
    excerpt: "Across the 450-participant randomized trial, users demonstrated an average 18% improvement in task completion time.",
    comparison: {
      claimed_value: 300,
      approved_value: 18,
      tolerance_pct: 5,
      variance_ratio: 16.6,
      rule: "Value exceeds approved pilot metric (300% vs approved 18%)",
    },
    result: "CONTRADICTED",
  });

  await supabase.from("audit_findings").insert({
    finding_code: "ISSUE_001",
    organisation_id: novaId,
    audit_id: auditA.id,
    category: "claim_reliability",
    severity: "CRITICAL",
    excerpt: "increases productivity by 300%",
    start_offset: 13,
    end_offset: 44,
    explanation: "The claimed 300% productivity increase drastically contradicts approved benchmark data. Official pilot records document an 18% improvement in task completion time.",
    guideline_reference: "Nova Creative Core Brand Voice & Tone — Rule 1: No exaggerated promises or unverified claims",
    verification_status: "CONTRADICTED",
    recommended_action: "Replace with verified pilot figure and add mandatory disclaimer.",
    suggested_replacement: "improved task completion time by 18% in an internal pilot. Results may vary.",
    confidence: "high",
    claim_id: claimA.id,
    is_demo: true,
  });

  // Scenario B: Tone & Terminology ("Destroy your competition with our revolutionary platform.")
  const textB = "Destroy your competition with our revolutionary platform.";
  const { data: itemB } = await supabase.from("content_items").insert({
    organisation_id: novaId,
    creator_id: creatorId,
    title: "Aggressive Competitor Campaign",
    content_type: "Advertisement",
    platform: "X",
    audience: "Tech Founders",
    department: "Growth",
    campaign_context: "Viral Hype Sprint",
    status: "REVISION_REQUIRED",
    current_version_no: 1,
    is_demo: true,
  }).select().single();

  const { data: verB } = await supabase.from("content_versions").insert({
    organisation_id: novaId,
    content_item_id: itemB.id,
    version_no: 1,
    body: textB,
    source: "original",
    created_by: creatorId,
    change_summary: "Initial aggressive pitch",
  }).select().single();

  const { data: auditB } = await supabase.from("audits").insert({
    organisation_id: novaId,
    content_item_id: itemB.id,
    content_version_id: verB.id,
    status: "COMPLETED",
    mode: "demo",
    overall_score: 48,
    scores: { voice: 30, claims: 100, terminology: 40, accessibility: 90, visual: null },
    checked_dimensions: ["voice", "claims", "terminology", "accessibility"],
    started_at: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
    created_by: creatorId,
    is_demo: true,
  }).select().single();

  for (const s of stages) {
    await supabase.from("audit_stages").insert({
      audit_id: auditB.id,
      stage_number: s.num,
      stage_key: s.key,
      status: "COMPLETED",
      detail: `Deterministic rule analysis`,
      started_at: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      finished_at: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
    });
  }

  await supabase.from("audit_findings").insert([
    {
      finding_code: "ISSUE_001",
      organisation_id: novaId,
      audit_id: auditB.id,
      category: "voice",
      severity: "HIGH",
      excerpt: "Destroy your competition",
      start_offset: 0,
      end_offset: 24,
      explanation: "Aggressive and combative phrasing 'Destroy' breaches brand voice tone principles (Educational, Human, Approachable).",
      guideline_reference: "Nova Creative Core Brand Voice & Tone — Rule 3: No aggressive or combative sales language",
      recommended_action: "Adopt an outcome-focused, collaborative tone.",
      suggested_replacement: "Accelerate your team's output",
      confidence: "high",
      is_demo: true,
    },
    {
      finding_code: "ISSUE_002",
      organisation_id: novaId,
      audit_id: auditB.id,
      category: "terminology",
      severity: "MEDIUM",
      excerpt: "revolutionary",
      start_offset: 34,
      end_offset: 47,
      explanation: "The term 'revolutionary' is flagged on the disallowed buzzwords list.",
      guideline_reference: "Terminology Rules — Prohibited Marketing Hype",
      recommended_action: "Use approved descriptor 'purpose-built'.",
      suggested_replacement: "purpose-built",
      confidence: "high",
      is_demo: true,
    },
  ]);

  // Scenario C: Outdated statistic ("Trusted by 8,000 businesses.")
  const textC = "Trusted by 8,000 businesses worldwide to govern their brand communications.";
  const { data: itemC } = await supabase.from("content_items").insert({
    organisation_id: novaId,
    creator_id: creatorId,
    title: "Customer Milestone Social Banner",
    content_type: "Social media post",
    platform: "Instagram",
    audience: "Prospective Clients",
    department: "Product Marketing",
    campaign_context: "Trust & Credibility",
    status: "READY_FOR_REVIEW",
    current_version_no: 1,
    is_demo: true,
  }).select().single();

  const { data: verC } = await supabase.from("content_versions").insert({
    organisation_id: novaId,
    content_item_id: itemC.id,
    version_no: 1,
    body: textC,
    source: "original",
    created_by: creatorId,
    change_summary: "Milestone post draft",
  }).select().single();

  const { data: auditC } = await supabase.from("audits").insert({
    organisation_id: novaId,
    content_item_id: itemC.id,
    content_version_id: verC.id,
    status: "COMPLETED",
    mode: "demo",
    overall_score: 68,
    scores: { voice: 90, claims: 45, terminology: 95, accessibility: 95, visual: null },
    checked_dimensions: ["voice", "claims", "terminology", "accessibility"],
    started_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(),
    created_by: creatorId,
    is_demo: true,
  }).select().single();

  for (const s of stages) {
    await supabase.from("audit_stages").insert({
      audit_id: auditC.id,
      stage_number: s.num,
      stage_key: s.key,
      status: "COMPLETED",
      detail: `Deterministic verification completed`,
      started_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      finished_at: new Date(now.getTime() - 23 * 60 * 60 * 1000).toISOString(),
    });
  }

  const { data: claimC } = await supabase.from("extracted_claims").insert({
    organisation_id: novaId,
    audit_id: auditC.id,
    claim_text: "Trusted by 8,000 businesses",
    claim_type: "numerical",
    numeric_value: 8000,
    unit: "businesses",
    metric: "customer count",
    start_offset: 0,
    end_offset: 27,
    confidence: "high",
    verification_status: "OUTDATED",
  }).select().single();

  await supabase.from("evidence_matches").insert({
    organisation_id: novaId,
    audit_id: auditC.id,
    claim_id: claimC.id,
    approved_fact_id: factCustomerCount?.id,
    evidence_source_id: customerDoc?.id,
    excerpt: "As of the close of Q3, Nova Creative serves 12,400 active commercial businesses worldwide.",
    comparison: {
      claimed_value: 8000,
      current_approved_value: 12400,
      note: "The 8,000 figure is outdated and superseded by Q3 verified metric (12,400).",
    },
    result: "OUTDATED",
  });

  await supabase.from("audit_findings").insert({
    finding_code: "ISSUE_001",
    organisation_id: novaId,
    audit_id: auditC.id,
    category: "claim_reliability",
    severity: "HIGH",
    excerpt: "8,000 businesses",
    start_offset: 11,
    end_offset: 27,
    explanation: "This metric is OUTDATED. The 8,000 count expired 2 months ago and is superseded by the Q3 verified audit of 12,400 businesses worldwide.",
    guideline_reference: "Q3 Verified Enterprise Metrics (v3.2)",
    verification_status: "OUTDATED",
    recommended_action: "Update to the current approved figure: 12,400 businesses.",
    suggested_replacement: "12,400 businesses",
    confidence: "high",
    claim_id: claimC.id,
    is_demo: true,
  });

  // Scenario D: Clean post
  const textD = "In our internal pilot, teams achieved an 18% improvement in task completion time. Results based on an internal pilot; individual results may vary.";
  const { data: itemD } = await supabase.from("content_items").insert({
    organisation_id: novaId,
    creator_id: creatorId,
    title: "Verified Pilot Case Study Snapshot",
    content_type: "Website copy",
    platform: "Website",
    audience: "Product Leaders",
    department: "Product Marketing",
    campaign_context: "Proof & Evidence Series",
    status: "APPROVED",
    current_version_no: 1,
    is_demo: true,
  }).select().single();

  const { data: verD } = await supabase.from("content_versions").insert({
    organisation_id: novaId,
    content_item_id: itemD.id,
    version_no: 1,
    body: textD,
    source: "original",
    created_by: creatorId,
    change_summary: "Fully referenced copy with disclaimer",
  }).select().single();

  const { data: auditD } = await supabase.from("audits").insert({
    organisation_id: novaId,
    content_item_id: itemD.id,
    content_version_id: verD.id,
    status: "COMPLETED",
    mode: "demo",
    overall_score: 96,
    scores: { voice: 98, claims: 95, terminology: 100, accessibility: 94, visual: null },
    checked_dimensions: ["voice", "claims", "terminology", "accessibility"],
    started_at: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(now.getTime() - 47 * 60 * 60 * 1000).toISOString(),
    created_by: creatorId,
    is_demo: true,
  }).select().single();

  for (const s of stages) {
    await supabase.from("audit_stages").insert({
      audit_id: auditD.id,
      stage_number: s.num,
      stage_key: s.key,
      status: "COMPLETED",
      detail: `All assertions verified and compliant`,
      started_at: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
      finished_at: new Date(now.getTime() - 47 * 60 * 60 * 1000).toISOString(),
    });
  }

  const { data: claimD } = await supabase.from("extracted_claims").insert({
    organisation_id: novaId,
    audit_id: auditD.id,
    claim_text: "18% improvement in task completion time",
    claim_type: "numerical",
    numeric_value: 18,
    unit: "%",
    metric: "task completion time",
    start_offset: 27,
    end_offset: 67,
    confidence: "high",
    verification_status: "VERIFIED",
  }).select().single();

  await supabase.from("evidence_matches").insert({
    organisation_id: novaId,
    audit_id: auditD.id,
    claim_id: claimD.id,
    approved_fact_id: factPilot?.id,
    evidence_source_id: pilotDoc?.id,
    excerpt: "users demonstrated an average 18% improvement in task completion time (p < 0.01)",
    comparison: {
      claimed_value: 18,
      approved_value: 18,
      delta: 0,
      status: "Exact match with approved pilot metric",
    },
    result: "VERIFIED",
  });

  // Approval decision for D
  await supabase.from("approval_decisions").insert({
    organisation_id: novaId,
    content_item_id: itemD.id,
    content_version_id: verD.id,
    decider_id: reviewerId,
    decision: "APPROVED",
    reason: "All claims verified against Pilot Report v2. Disclaimer correctly positioned.",
    is_override: false,
  });

  // 13. Challenges (2 challenges: 1 upheld, 1 accepted as exception)
  console.log("Seeding finding challenges...");
  const { data: challenge1 } = await supabase.from("finding_challenges").insert({
    organisation_id: novaId,
    finding_id: (await supabase.from("audit_findings").select("id").eq("audit_id", auditB.id).limit(1).single()).data?.id,
    challenger_id: creatorId,
    reason: "This phrasing is part of a deliberate retro gaming campaign metaphor.",
    context: "The audience is gaming hardware developers who appreciate bold competitive metaphors.",
    status: "DECIDED",
  }).select().single();

  if (challenge1) {
    await supabase.from("challenge_decisions").insert({
      challenge_id: challenge1.id,
      organisation_id: novaId,
      decider_id: reviewerId,
      decision: "ACCEPT_AS_EXCEPTION",
      rationale: "Approved as a one-off campaign exception for targeted gaming hardware audience. Does not modify core brand voice guideline.",
    });
  }

  // Challenge 2: Upheld
  const { data: challenge2 } = await supabase.from("finding_challenges").insert({
    organisation_id: novaId,
    finding_id: (await supabase.from("audit_findings").select("id").eq("audit_id", auditA.id).limit(1).single()).data?.id,
    challenger_id: creatorId,
    reason: "A customer tweet claimed they were 3x faster.",
    context: "Requesting exception based on user testimonial.",
    status: "DECIDED",
  }).select().single();

  if (challenge2) {
    await supabase.from("challenge_decisions").insert({
      challenge_id: challenge2.id,
      organisation_id: novaId,
      decider_id: managerId,
      decision: "UPHOLD",
      rationale: "Unverified customer tweets cannot supersede empirical benchmarks. Finding upheld.",
    });
  }

  // 14. Pad history with ~25 additional seeded audits over the last 90 days
  console.log("Seeding history audits (25 records)...");
  const departments = ["Product Marketing", "Growth", "Demand Generation", "Sales Enablement", "Corporate Communications"];
  const contentTypes = ["Social media post", "Advertisement", "Blog article", "Email campaign", "Website copy", "Product description"];
  const platforms = ["LinkedIn", "X", "Email", "Website", "Instagram"];

  for (let i = 1; i <= 25; i++) {
    const daysAgo = Math.floor(Math.random() * 85) + 3;
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    const dept = departments[i % departments.length];
    const cType = contentTypes[i % contentTypes.length];
    const plat = platforms[i % platforms.length];
    const isOutdatedReused = i % 4 === 0;
    const isClean = i % 3 === 0;

    const score = isClean ? 92 : (isOutdatedReused ? 64 : 76);
    const itemStatus = isClean ? "APPROVED" : (isOutdatedReused ? "REVISION_REQUIRED" : "READY_FOR_REVIEW");

    const { data: histItem } = await supabase.from("content_items").insert({
      organisation_id: novaId,
      creator_id: creatorId,
      title: `${dept} Campaign Blast #${i}`,
      content_type: cType,
      platform: plat,
      audience: "B2B Decision Makers",
      department: dept,
      campaign_context: `Sprint ${Math.floor(i / 2) + 1}`,
      status: itemStatus,
      current_version_no: 1,
      is_demo: true,
      created_at: createdAt,
    }).select().single();

    if (histItem) {
      const histBody = isOutdatedReused
        ? `Join 8,000 businesses achieving extraordinary results with our Smart Scheduler.`
        : (isClean
          ? `Empowering modern workflows with an 18% improvement in task completion time. Results based on an internal pilot; individual results may vary.`
          : `Unbeatable efficiency and world's fastest workflow automation engine.`);

      const { data: histVer } = await supabase.from("content_versions").insert({
        organisation_id: novaId,
        content_item_id: histItem.id,
        version_no: 1,
        body: histBody,
        source: "original",
        created_by: creatorId,
        created_at: createdAt,
      }).select().single();

      if (histVer) {
        const { data: histAudit } = await supabase.from("audits").insert({
          organisation_id: novaId,
          content_item_id: histItem.id,
          content_version_id: histVer.id,
          status: "COMPLETED",
          mode: "demo",
          overall_score: score,
          scores: {
            voice: isClean ? 95 : 70,
            claims: isClean ? 98 : (isOutdatedReused ? 45 : 75),
            terminology: isClean ? 100 : 70,
            accessibility: 92,
            visual: null,
          },
          checked_dimensions: ["voice", "claims", "terminology", "accessibility"],
          started_at: createdAt,
          completed_at: createdAt,
          created_by: creatorId,
          is_demo: true,
          created_at: createdAt,
        }).select().single();

        if (histAudit && isOutdatedReused) {
          await supabase.from("audit_findings").insert({
            finding_code: "ISSUE_001",
            organisation_id: novaId,
            audit_id: histAudit.id,
            category: "claim_reliability",
            severity: "HIGH",
            excerpt: "8,000 businesses",
            explanation: "Outdated customer metric detected across marketing drafts.",
            guideline_reference: "Q3 Verified Enterprise Metrics",
            verification_status: "OUTDATED",
            recommended_action: "Update to 12,400 businesses.",
            suggested_replacement: "12,400 businesses",
            confidence: "high",
            is_demo: true,
            created_at: createdAt,
          });
        }
      }
    }
  }

  // 15. Drift Insights (>= 3 insights, flagged is_seeded=true)
  console.log("Seeding systemic brand drift insights...");
  await supabase.from("drift_insights").insert([
    {
      organisation_id: novaId,
      title: "Outdated Customer Metric (8,000) Persistently Reused",
      summary: "The superseded '8,000 businesses' figure was detected in 6 Product Marketing submissions over the past 60 days, despite Q3 audit verification of 12,400 businesses.",
      insight_type: "expired_stat_reuse",
      frequency: 6,
      affected_departments: ["Product Marketing", "Growth"],
      recommendation: "Broadcast an automated notification to Product Marketing and archive legacy pitch decks containing the 8,000 count.",
      is_seeded: true,
    },
    {
      organisation_id: novaId,
      title: "Superlative & Hype Language Clustering in Growth Team",
      summary: "Terms such as 'world's fastest' and 'unbeatable' appeared in 8 recent Demand Generation campaign submissions, triggering repeated terminology and tone penalties.",
      insight_type: "voice_deviation",
      frequency: 8,
      affected_departments: ["Growth", "Demand Generation"],
      recommendation: "Conduct a 15-minute alignment workshop on acceptable technical performance positioning.",
      is_seeded: true,
    },
    {
      organisation_id: novaId,
      title: "Missing Performance Disclaimers on Productivity Claims",
      summary: "4 submissions quoted the verified 18% pilot improvement statistic without attaching the mandatory legal disclaimer, risking consumer protection non-compliance.",
      insight_type: "repeated_claim",
      frequency: 4,
      affected_departments: ["Product Marketing", "Sales Enablement"],
      recommendation: "Enable automatic prompt injection of mandatory disclaimer when 18% pilot benchmark is cited.",
      is_seeded: true,
    },
  ]);

  // 16. Notifications
  console.log("Seeding notifications...");
  await supabase.from("notifications").insert([
    {
      organisation_id: novaId,
      user_id: creatorId,
      title: "Brand Audit Completed",
      message: "Audit for 'Q4 Product Launch Announcement' completed with score 52 (1 CRITICAL finding).",
      type: "audit_complete",
      link: `/audits/${auditA.id}`,
      is_read: false,
    },
    {
      organisation_id: novaId,
      user_id: reviewerId,
      title: "Review Assignment Pending",
      message: "Customer Milestone Social Banner submitted by Casey Jordan is ready for review.",
      type: "review_assigned",
      link: `/reviews`,
      is_read: false,
    },
    {
      organisation_id: novaId,
      user_id: creatorId,
      title: "Challenge Decision Recorded",
      message: "Your challenge on 'Aggressive Competitor Campaign' was accepted as a one-off exception.",
      type: "challenge_decision",
      link: `/reviews`,
      is_read: true,
    },
    {
      organisation_id: novaId,
      user_id: managerId,
      title: "Systemic Brand Drift Alert",
      message: "6 recent submissions detected reusing expired customer stat '8,000 businesses'.",
      type: "critical_issue",
      link: `/drift`,
      is_read: false,
    },
  ]);

  // 17. Activity Logs
  console.log("Seeding activity logs...");
  await supabase.from("activity_logs").insert([
    {
      organisation_id: novaId,
      actor_id: adminId,
      action: "organisation_initialized",
      target_type: "organisation",
      target_id: novaId,
      details: { name: "Nova Creative", mode: "governance_v1" },
      created_at: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      organisation_id: novaId,
      actor_id: managerId,
      action: "guideline_published",
      target_type: "brand_guidelines",
      target_id: "core_voice_v2",
      details: { title: "Nova Creative Core Brand Voice & Tone", version: "2.1" },
      created_at: new Date(now.getTime() - 65 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      organisation_id: novaId,
      actor_id: managerId,
      action: "fact_verified",
      target_type: "approved_facts",
      target_id: factPilot?.id,
      details: { fact: "18% improvement in task completion time", metric: "pilot benchmark" },
      created_at: sixtyDaysAgo.toISOString(),
    },
    {
      organisation_id: novaId,
      actor_id: creatorId,
      action: "content_submitted",
      target_type: "content_item",
      target_id: itemA.id,
      details: { title: "Q4 Product Launch Announcement" },
      created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      organisation_id: novaId,
      actor_id: reviewerId,
      action: "challenge_exception_granted",
      target_type: "finding_challenges",
      target_id: challenge1?.id,
      details: { finding_id: "ISSUE_001", scope: "campaign_exception_only" },
      created_at: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
    },
  ]);

  console.log("✅ Seed completed successfully!");
  console.log("\n========================================================");
  console.log("PROOFLOOM DEMO ACCOUNTS (PASSWORD: " + demoPassword + ")");
  console.log("--------------------------------------------------------");
  console.log("1. Admin:         admin.demo@example.com");
  console.log("2. Brand Manager: manager.demo@example.com");
  console.log("3. Creator:       creator.demo@example.com");
  console.log("4. Reviewer:      reviewer.demo@example.com");
  console.log("Isolated Test Org User: orbit.user@example.com");
  console.log("========================================================\n");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
