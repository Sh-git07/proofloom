export interface HelpArticle {
  id: string;
  hash: string;
  category: "Getting Started" | "Role Guides" | "Audits & Evidence" | "Governance & Review" | "System & AI";
  title: string;
  summary: string;
  content: string[];
  tags: string[];
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "getting-started",
    hash: "getting-started",
    category: "Getting Started",
    title: "Getting Started with PROOFLOOM",
    summary: "Understand what PROOFLOOM does and how brand claims connect to a thread of proof.",
    content: [
      "PROOFLOOM is a Brand Integrity Engine designed to ensure every commercial claim, marketing post, and external asset is backed by verifiable corporate truth.",
      "Rather than subjective editorial debates, PROOFLOOM compares your draft content against an immutable Knowledge Vault of approved benchmark facts, tone rules, and banned terminology.",
      "The platform operates with zero-trust provenance: any claim made must be linked to an approved primary document or signed truth record. When an approved fact expires or changes, downstream content is flagged automatically."
    ],
    tags: ["overview", "introduction", "basics", "quickstart", "proofloom", "mission"]
  },
  {
    id: "role-guides",
    hash: "role-guides",
    category: "Role Guides",
    title: "Guide by Role (Creator, Reviewer, Brand Manager, Admin)",
    summary: "Clear responsibilities and workflows tailored for each organizational role.",
    content: [
      "Creator: Draft content in Content Studio, run immediate brand audits, view claim breakdowns, accept suggested rewrites, and submit compliant drafts for review.",
      "Reviewer: Access the Review Queue to inspect claim citations, examine side-by-side evidence, verify remediation of findings, and record formal approvals or itemized rejections.",
      "Brand Manager: Own the Brand Knowledge Vault, approve source documents and extracted candidate facts, assign review workloads, and monitor Brand Drift for guideline ambiguity.",
      "Admin: Manage team permissions, configure live Gemini AI models and fallback policies, execute emergency critical overrides with mandatory justifications, and track organizational governance insights."
    ],
    tags: ["roles", "creator", "reviewer", "brand manager", "admin", "permissions", "workflow"]
  },
  {
    id: "audit-stages",
    hash: "audit-stages",
    category: "Audits & Evidence",
    title: "How an Audit Works (The Pipeline Stages)",
    summary: "A deep dive into the multi-stage text and visual verification architecture.",
    content: [
      "Every audit executes through a rigorous deterministic pipeline:",
      "Stage 1: Pre-flight rule matching — fast regex scans for banned terminology, profanity, and mandatory disclaimers.",
      "Stage 2: Claim extraction — decomposes unstructured text into discrete, testable factual assertions.",
      "Stage 3: Evidence retrieval & matching — pairs assertions against active, unexpired facts in the Knowledge Vault.",
      "Stage 4: Voice & tone consistency — evaluates reading grade level, sentiment, and voice archetype adherence.",
      "Stage 5: Rewrite generation — drafts precision diff-aligned fixes for detected violations.",
      "Stage 6: Overall scoring — aggregates sub-scores into the Brand Integrity Score.",
      "Stage 7: Activity logging & notifications — records immutable audit hashes and alerts stakeholders.",
      "Stage 8 (Visual only): Image inspection — verifies aspect ratio, palette contrast, safe zones, and logo presence."
    ],
    tags: ["stages", "pipeline", "audit", "engine", "extraction", "voice", "visual"]
  },
  {
    id: "audit-engine-modes",
    hash: "audit-engine-modes",
    category: "Audits & Evidence",
    title: "Audit Engine Modes: Live AI vs Rules Fallback",
    summary: "How hedged Gemini execution and deterministic rule fallbacks guarantee uptime.",
    content: [
      "LIVE AI: Powered by Google Gemini. The engine employs hedged requests: queries are sent to the primary model; if latency exceeds 8 seconds or a transient error (429/500/503) occurs, a secondary fallback model starts in parallel. The fastest valid response wins.",
      "RULES ONLY: If external AI services are unavailable or disabled, PROOFLOOM seamlessly falls back to local rule-based heuristics without interrupting creator workflows.",
      "Stage labels honestly identify whether primary AI, fallback AI, or rule-based heuristics executed."
    ],
    tags: ["engine mode", "live ai", "gemini", "fallback", "hedge", "rules only"]
  },
  {
    id: "claim-statuses",
    hash: "claim-statuses",
    category: "Audits & Evidence",
    title: "The Six Claim Verification Statuses",
    summary: "How extracted assertions are classified against corporate evidence.",
    content: [
      "VERIFIED: The assertion directly matches an active, approved fact in the Knowledge Vault with verbatim excerpt provenance.",
      "PARTIALLY_SUPPORTED: The statement has directional truth, but numbers, qualifiers, or dates diverge slightly from approved benchmarks.",
      "CONTRADICTED: The claim conflicts with an approved truth record (e.g. asserting 99% uptime when benchmark is 95%). Categorized as a CRITICAL violation.",
      "OUTDATED: Matches a previously valid fact whose expiry date has passed or which has been superseded by a newer version.",
      "HUMAN_VERIFICATION_REQUIRED: Subjective, comparative, or nuanced claim that automated heuristics cannot verify authoritatively.",
      "UNSUPPORTED: No matching fact exists in the Knowledge Vault. Content creators must substantiate with primary evidence."
    ],
    tags: ["claim statuses", "verified", "partially supported", "contradicted", "outdated", "unsupported", "human verification"]
  },
  {
    id: "integrity-score",
    hash: "integrity-score",
    category: "Audits & Evidence",
    title: "The Brand Integrity Score: Decision Support Metric",
    summary: "Understanding the 0-100 composite score and its dimensional breakdown.",
    content: [
      "The Brand Integrity Score (0 to 100) is a quantitative decision-support metric calculated from weighted dimensions: factual accuracy (40%), voice consistency (30%), terminology compliance (20%), and visual aesthetics (10% when present).",
      "IMPORTANT: The score is an automated guidance and risk indicator, not a formal legal guarantee or compliance indemnity.",
      "Scoring bands: 80-100 (High Integrity / Ready for review), 60-79 (Needs Attention / Warnings present), 0-59 (High Risk / Critical blocks present)."
    ],
    tags: ["integrity score", "metrics", "decision support", "dimensions", "accuracy", "voice"]
  },
  {
    id: "not-checked",
    hash: "not-checked",
    category: "Audits & Evidence",
    title: "NOT CHECKED Dimensions",
    summary: "What it means when a dimension displays 'NOT CHECKED'.",
    content: [
      "A dimension marked NOT CHECKED indicates that verification was not performed for that specific facet (e.g., visual analysis on text-only copy, or a disabled rule category).",
      "Dimensions marked NOT CHECKED do not contribute positively or negatively to the numerical score, but require manual review prior to publication."
    ],
    tags: ["not checked", "bypassed", "unverified", "dimensions"]
  },
  {
    id: "severity-levels",
    hash: "severity-levels",
    category: "Governance & Review",
    title: "Finding Severity Levels & Enforcement",
    summary: "Understanding CRITICAL, HIGH, MEDIUM, LOW, and INFO classifications.",
    content: [
      "CRITICAL: High-risk brand or legal violation (contradicted facts, profanity, blacklisted competitor names). CRITICAL findings strictly block approval at the database level.",
      "HIGH: Significant deviations in tone, voice archetype, or major unsubstantiated claims requiring manager review.",
      "MEDIUM: Moderate stylistic divergence or unverified secondary assertions.",
      "LOW & INFO: Minor polish suggestions and informational reminders. These never block review progression."
    ],
    tags: ["severity", "critical", "high", "medium", "low", "info", "blockers"]
  },
  {
    id: "claim-provenance",
    hash: "claim-provenance",
    category: "Audits & Evidence",
    title: "Claim Provenance & Evidence Chains",
    summary: "Connecting every extracted fact to source documents, page numbers, and excerpts.",
    content: [
      "Claim Provenance provides a transparent audit trail showing exactly why a claim passed or failed.",
      "Each verified claim displays: the source document title, document version, exact excerpt sentence, page number, verification date, and validity status.",
      "Pending, rejected, or expired documents are strictly excluded from serving as supporting evidence."
    ],
    tags: ["provenance", "evidence", "source documents", "citations", "chain of custody"]
  },
  {
    id: "evidence-matching",
    hash: "evidence-matching",
    category: "Audits & Evidence",
    title: "Evidence Matching & 'NO APPROVED EVIDENCE FOUND'",
    summary: "What happens when automated matching cannot find an approved corporate record.",
    content: [
      "When an audit encounters a factual claim with no corresponding approved entry in the Knowledge Vault, it displays 'NO APPROVED EVIDENCE FOUND'.",
      "This indicates that either the benchmark fact has not yet been ingested and approved by a Brand Manager, or the claim is unverified.",
      "To resolve, creators can request a brand fact addition, or Brand Managers can upload the official source document into Brand Knowledge."
    ],
    tags: ["no approved evidence found", "unsupported", "missing facts", "knowledge vault"]
  },
  {
    id: "rewrites-and-versions",
    hash: "rewrites-and-versions",
    category: "Governance & Review",
    title: "Rewrites and Immutable Version History",
    summary: "How suggestions are generated, accepted, and versioned.",
    content: [
      "When a rule violation or unverified claim is detected, the engine generates an targeted rewrite proposal preserving your original intent.",
      "Accepting a rewrite automatically generates an immutable new version of the content item in PostgreSQL.",
      "Prior versions are preserved permanently with cryptographic checksums, ensuring complete historical reproducibility."
    ],
    tags: ["rewrites", "versions", "version control", "diff", "immutability"]
  },
  {
    id: "critical-finding-block",
    hash: "critical-finding-block",
    category: "Governance & Review",
    title: "Review & Approval: Why Critical Findings Block Sign-Off",
    summary: "The automated governance gate preventing unverified or contradicted publication.",
    content: [
      "In PROOFLOOM, content containing unresolved CRITICAL findings cannot be approved through normal channels. The database trigger rejects approval mutations.",
      "To proceed, the creator must accept a remediation rewrite or resolve the finding.",
      "Administrative Override: An authorized Admin may bypass a critical block only by submitting an executive justification (minimum 15 characters), creating an immutable accountability record in activity_logs."
    ],
    tags: ["critical block", "approval gate", "admin override", "sign off", "governance"]
  },
  {
    id: "visual-checks",
    hash: "visual-checks",
    category: "Audits & Evidence",
    title: "Visual Checks & Asset Consistency",
    summary: "Evaluating brand color palettes, aspect ratios, safe zones, and logo placement.",
    content: [
      "When an image is attached to content, Stage 8 executes visual consistency checks.",
      "Checks include: aspect ratio compatibility for the target platform (e.g., 1:1 for Instagram, 16:9 for YouTube), color palette adherence, contrast accessibility, safe zone margins, and logo presence.",
      "Visual findings receive standard severity tiers and contribute to the composite Brand Integrity Score."
    ],
    tags: ["visual checks", "images", "aspect ratio", "color palette", "safe zones", "logo"]
  },
  {
    id: "challenging-findings",
    hash: "challenging-findings",
    category: "Governance & Review",
    title: "Challenging a Finding: Brand Memory Court",
    summary: "How creators can appeal automated findings and establish brand precedent.",
    content: [
      "If you believe an automated finding is inaccurate or that your wording represents a legitimate stylistic exception, you can submit a challenge to the Brand Memory Court.",
      "Challenges require a written justification (minimum 15 characters). Reviewers adjudicate challenges with one of three formal decisions: UPHOLD (ruling stands), REVERSE (finding removed), or EXCEPTION (policy exception granted).",
      "Adjudication decisions are immutably logged and contribute to guideline clarity analytics."
    ],
    tags: ["challenge", "brand memory court", "appeal", "exception", "adjudication"]
  },
  {
    id: "brand-drift",
    hash: "brand-drift",
    category: "Governance & Review",
    title: "Brand Drift Detection & Guideline Clarity",
    summary: "Continuous telemetry to identify unclear guidelines and evolving messaging trends.",
    content: [
      "Brand Drift analyzes aggregate audit telemetry across 90 days to identify systemic issues.",
      "Frequent violations, widespread finding dismissals, and high appeal rates trigger automated 'Guideline Clarity Suggestions'.",
      "Brand Managers can accept suggestions to draft guideline clarifications or add clarifying examples, closing the loop between rule enforcement and creator reality."
    ],
    tags: ["brand drift", "guideline clarity", "telemetry", "drift velocity", "suggestions"]
  },
  {
    id: "ai-privacy",
    hash: "ai-privacy",
    category: "System & AI",
    title: "AI Safety, Privacy & Zero-Retention Architecture",
    summary: "How PROOFLOOM protects enterprise data when interacting with AI models.",
    content: [
      "PROOFLOOM uses Google Gemini with enterprise privacy guarantees: customer drafts and brand knowledge are never used to train public foundation models.",
      "Calls are stateless with structured JSON schemas and tight 15-second per-stage budgets.",
      "If live AI is disabled or fails, the platform transparently uses deterministic rule fallbacks with complete traceability."
    ],
    tags: ["ai privacy", "security", "zero retention", "gemini", "enterprise"]
  },
  {
    id: "faq-troubleshooting",
    hash: "faq-troubleshooting",
    category: "System & AI",
    title: "FAQ & Troubleshooting",
    summary: "Answers to common operational questions and technical troubleshooting steps.",
    content: [
      "Q: Why did my audit take longer than 8 seconds? A: The hedged request system waits 8 seconds before launching a parallel fallback model to ensure the quickest response.",
      "Q: Can I approve content with warnings? A: Yes. HIGH, MEDIUM, and LOW warnings do not block approvals; only unresolved CRITICAL findings prevent sign-off.",
      "Q: Where are my uploaded source documents stored? A: In a private, encrypted storage bucket accessible only by authorized managers and system verification workers.",
      "Q: Can I replay the introductory tour? A: Yes, click any role's 'Replay tour' button at the top of this Help Centre."
    ],
    tags: ["faq", "troubleshooting", "help", "answers", "questions", "tour"]
  }
];

export function searchHelpArticles(
  query: string,
  categoryFilter?: string
): HelpArticle[] {
  const cleanQuery = query.trim().toLowerCase();

  return HELP_ARTICLES.filter((article) => {
    if (categoryFilter && categoryFilter !== "All" && article.category !== categoryFilter) {
      return false;
    }

    if (!cleanQuery) return true;

    const inTitle = article.title.toLowerCase().includes(cleanQuery);
    const inSummary = article.summary.toLowerCase().includes(cleanQuery);
    const inTags = article.tags.some((tag) => tag.toLowerCase().includes(cleanQuery));
    const inContent = article.content.some((line) => line.toLowerCase().includes(cleanQuery));

    return inTitle || inSummary || inTags || inContent;
  });
}
