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
  const { data: existingOrgs } = await supabase
    .from("organisations")
    .select("id, slug")
    .in("slug", ["nova-creative", "orbit-labs"]);

  if (existingOrgs && existingOrgs.length > 0) {
    for (const org of existingOrgs) {
      await supabase.from("organisations").delete().eq("id", org.id);
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

  // 7. Brand Voice Guideline
  console.log("Seeding brand guidelines...");
  await supabase.from("brand_guidelines").insert({
    organisation_id: novaId,
    title: "Nova Creative Core Brand Voice & Tone",
    category: "voice",
    version: "2.1",
    status: "published",
    tone_attributes: ["Confident", "Approachable", "Educational", "Clear", "Human", "Professional"],
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
  });

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

  // 9. Approved Facts in Nova Creative
  console.log("Seeding approved facts...");
  // Fact 1: Pilot 18%
  const { data: factPilot } = await supabase.from("approved_facts").insert({
    organisation_id: novaId,
    name: "Task Completion Time Improvement",
    value: "18% improvement in task completion time in an internal pilot",
    numeric_value: 18,
    unit: "%",
    metric: "task completion time",
    description: "Empirical pilot study benchmark for guided workflows.",
    source_id: pilotDoc?.id,
    source_version: "2.0",
    approval_status: "APPROVED",
    owner: "Product Marketing & Research",
    verified_at: sixtyDaysAgo.toISOString(),
    expires_at: nineMonthsFuture.toISOString(),
    is_demo: true,
  }).select().single();

  // Fact 2: Active customer count (12,400)
  const { data: factCustomerCount } = await supabase.from("approved_facts").insert({
    organisation_id: novaId,
    name: "Verified Customer Base",
    value: "12,400 businesses worldwide",
    numeric_value: 12400,
    unit: "businesses",
    metric: "customer count",
    description: "Audited count of active businesses as of Q3 closing.",
    source_id: customerDoc?.id,
    source_version: "3.2",
    approval_status: "APPROVED",
    owner: "Finance & Operations",
    verified_at: thirtyDaysAgo.toISOString(),
    expires_at: fiveMonthsFuture.toISOString(),
    is_demo: true,
  }).select().single();

  // Fact 3: Superseded customer count (8,000) -> Expired and points to Fact 2
  await supabase.from("approved_facts").insert({
    organisation_id: novaId,
    name: "Legacy Customer Count (Q1)",
    value: "8,000 businesses",
    numeric_value: 8000,
    unit: "businesses",
    metric: "customer count",
    description: "Historic customer count from earlier fiscal year.",
    approval_status: "EXPIRED",
    owner: "Finance & Operations",
    verified_at: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    expires_at: twoMonthsAgo.toISOString(),
    superseded_by: factCustomerCount?.id,
    is_demo: true,
  });

  // Fact 4: Feature Descriptions
  await supabase.from("approved_facts").insert([
    {
      organisation_id: novaId,
      name: "Feature: Smart Scheduler",
      value: "Smart Scheduler automatically coordinates cross-timezone content calendars with algorithmic queue balancing.",
      metric: "feature description",
      approval_status: "APPROVED",
      owner: "Product Management",
      verified_at: thirtyDaysAgo.toISOString(),
      expires_at: fiveMonthsFuture.toISOString(),
      is_demo: true,
    },
    {
      organisation_id: novaId,
      name: "Feature: Insight Digest",
      value: "Insight Digest summarizes weekly team governance analytics and highlighted brand drift alerts into an actionable executive summary.",
      metric: "feature description",
      approval_status: "APPROVED",
      owner: "Product Management",
      verified_at: thirtyDaysAgo.toISOString(),
      expires_at: fiveMonthsFuture.toISOString(),
      is_demo: true,
    },
  ]);

  // 10. Terminology Rules
  console.log("Seeding terminology rules...");
  await supabase.from("terminology_rules").insert([
    {
      organisation_id: novaId,
      disallowed_term: "autonomous employee replacement system",
      approved_term: "AI-powered productivity platform",
      context: "Positioning statement: PROOFLOOM enhances and protects human creators rather than replacing them.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "revolutionary",
      approved_term: "new or purpose-built",
      context: "Marketing hype filter: avoid inflated adjectives.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "game-changing",
      approved_term: "modern or high-efficiency",
      context: "Marketing hype filter: replace generic buzzwords with concrete descriptions.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "world's fastest",
      approved_term: "high-throughput",
      context: "Legal claim restriction: superlative benchmarks require external third-party certification.",
      is_demo: true,
    },
    {
      organisation_id: novaId,
      disallowed_term: "performance claims without disclaimer",
      approved_term: "performance claims with disclaimer",
      required_disclaimer: "Results based on an internal pilot; individual results may vary.",
      context: "Mandatory compliance disclaimer for any numeric speed or productivity claim.",
      is_demo: true,
    },
  ]);

  // 11. Approved Assets
  await supabase.from("approved_assets").insert([
    {
      organisation_id: novaId,
      name: "Nova Creative Primary Emblem",
      asset_type: "logo",
      storage_path: "brand-assets/nova-logo-vector.svg",
      metadata: { color_mode: "dark_and_light", clear_space: "24px", min_width: "120px" },
      is_demo: true,
    },
    {
      organisation_id: novaId,
      name: "Official Brand Palette 2026",
      asset_type: "color_palette",
      metadata: {
        primary: "#16834A",
        signal_lime: "#B7F28B",
        machine_black: "#17251C",
        blueprint_paper: "#F4F1E8",
        border_green: "#253C2B",
      },
      is_demo: true,
    },
  ]);

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
