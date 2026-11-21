# PROOFLOOM

> **Where every brand claim has a thread of proof.**  
> The intelligent brand integrity and governance layer between content creation and publication.

[![Production](https://img.shields.io/badge/Production-Live%20on%20Vercel-16834A?style=flat-square)](https://proofloom-six.vercel.app)
[![Tests](https://img.shields.io/badge/Tests-138%2F138%20Passing-B7F28B?style=flat-square&labelColor=17251C)](https://proofloom-six.vercel.app)

---

## Live Deployment

- **Production Application:** [https://proofloom-six.vercel.app](https://proofloom-six.vercel.app)
- **Demo Portal (Instant 4-Role Access):** [https://proofloom-six.vercel.app/demo](https://proofloom-six.vercel.app/demo)
- **Real-Email Account Sign Up:** [https://proofloom-six.vercel.app/signup](https://proofloom-six.vercel.app/signup)

---

## What is PROOFLOOM?

PROOFLOOM is an AI-powered Brand Governance and Brand Integrity Platform built for modern enterprise marketing, communications, and legal teams. Rather than operating as a generic copywriting tool, PROOFLOOM acts as an authoritative governance checkpoint. It audits marketing copy and visual collateral against approved empirical facts, brand voice guidelines, and terminology rules. It detects numeric contradictions and outdated statistics using deterministic mathematical tolerance checks, surfaces intent-preserving rewrites with word-level visual diffing, clusters systemic brand drift across departments, tracks the downstream impact of edited facts, and enforces strict review gates where critical brand infractions cannot reach publication without documented administrative sign-off.

---

## Authentication & Onboarding

PROOFLOOM offers two seamless entry pathways:

- **Demo Portal (`/demo`):** Instant single-click authentication as any of the 4 pre-configured governance roles in the benchmark *Nova Creative* workspace:
  - **Alex Vance (Admin):** Executive access, AI engine controls, override authority, team roster management.
  - **Jordan Lee (Brand Manager):** Knowledge vault oversight, source document review, reviewer assignments, drift analytics.
  - **Taylor Morgan (Reviewer):** Content review workbench, evidence provenance inspection, Brand Memory Court challenges.
  - **Casey Jordan (Creator):** Content studio drafting, live audit execution, intent-preserving rewrite adoption.
- **Real-Email Account Sign Up (`/signup`):** Self-service account registration (Full Name, Organisation Name, Email, Password) powered by Supabase Auth and a transactional PostgreSQL `SECURITY DEFINER` function. Automatically provisions an isolated organisation (unique slug, `is_demo = false`), assigns the creator as administrator, configures default engine thresholds, and handles email verification and password reset (`/reset-password`).
- **Empty Organisation Onboarding:** When a new organisation registers with zero brand facts, `/overview` and `/studio` surface a "SET UP YOUR BRAND FIRST" onboarding banner with options to navigate to Brand Knowledge or populate the organisation with a one-click starter pack (voice guideline, pilot fact, customer metric, terminology rules, and disclaimer).

---

## Key Features

### 1. Visual Brand Consistency
Multimodal brand audit engine analyzing graphic collateral (PNG, JPG, WebP) alongside text. Evaluates current vs. outdated logos with replacement recommendations, detects unauthorized elements and mascots, extracts dominant color palettes with WCAG contrast validation against background colors, verifies mandatory compliance stickers and badges, and flags placement infractions.

### 2. Evidence from Uploaded Approved Documents
In **Brand Knowledge &rarr; Source Documents**, Brand Managers can upload PDF, DOCX, or TXT source materials (financial disclosures, customer surveys, benchmark studies) up to 10 MB. A rule-based parser extracts candidate metrics with units, context, excerpts, and page numbers ("Pattern-based extraction; a manager must review every candidate"). Managers can edit, approve, or reject extracted facts. Approved facts link directly to document version and page, powering the **Claim Provenance** visual pipeline (`VERIFIED`, `CONTRADICTED`, `OUTDATED`, `UNSUPPORTED`).

### 3. Change-Impact Tracking & Guideline-Clarity Suggestions
- **Fact Impact Tracking:** When an approved fact is modified, superseded, expired, or archived, the system immediately locates all approved or in-review content items that relied on that evidence. It creates `OPEN` impact records displaying side-by-side old vs. new values and moves affected items to a `NEEDS RE-REVIEW` status in the Review Queue under the **IMPACTED BY FACT CHANGE** tab, featuring a one-click "Re-run audit" button.
- **Guideline Clarity Suggestions:** Rule-based drift analytics aggregates 90-day review findings, dismissals, challenges, and overturned disputes. Guidelines or terminology rules with elevated friction trigger automatic suggestions (e.g., *"Rule X was flagged N times and challenged M times; consider clarifying wording or adding an example"*), allowing managers to accept and draft clarification notes.

### 4. Built-in User Guidance
Zero-network-overhead static user guidance styled in the neo-brutalist design system:
- **Welcome Modal:** Explains core value propositions tailored to the user's role on first login.
- **Role Guided Tours:** 60-second keyboard-accessible tours (Back, Next, Esc, focus trapping) for Creators, Reviewers, Brand Managers, and Admins, culminating in a "Try a sample audit" action for Creators.
- **Getting Started Checklist:** Dynamic card on `/overview` tracking setup milestones computed from live database state.
- **Contextual HelpTips:** Reusable `<HelpTip>` popovers positioned beside the Integrity Score, NOT CHECKED badges, claim verification statuses, review gates, drift velocity indicators, and external AI controls.
- **Help Centre (`/help`):** Searchable documentation and reference guide.

### 5. Live Gemini Analysis with Resilient Fallback
Hedged dual-model architecture: queries primary model `AI_MODEL` (`gemini-3.8-flash`) and immediately initiates `AI_FALLBACK_MODEL` (`gemini-3.1-flash-lite`) if primary latency exceeds 8 seconds or returns 429/500/503. The engine uses whichever returns valid structured JSON first and safely aborts the other, maintaining a 15-second hard timeout and 30-second stage budget. Full transparency is provided via honest stage telemetry badges (`AI: used (primary)`, `AI: used (fallback)`, `AI: failed, rules only (reason)`), dual-model health telemetry on Settings (`/api/ai/health`), and an external AI data privacy toggle.

---

## Tech Stack & Architecture

PROOFLOOM is built on Next.js 16 (App Router, Server Actions, Route Handlers) and TypeScript, styled with a high-density neo-brutalist control room interface using Tailwind CSS, Space Grotesk, Inter, JetBrains Mono, and Lucide React. Multi-tenant data isolation and governance state are managed by Supabase PostgreSQL 15, enforcing strict Row-Level Security (RLS) policies, database triggers, and `SECURITY DEFINER` stored procedures. Content analysis combines Google Gemini REST API multimodal processing with serverless document parsing (`unpdf`, `mammoth`, `sharp`) and an offline deterministic mathematical rules engine.

---

## Environment Variables

Configure the following environment variable names in your `.env.local` file (names only, no values):

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project API URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous API key for client-side authentication.
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key for database seeding and privileged RPC execution.
- `SUPABASE_PROJECT_REF` — Supabase project reference identifier.
- `SUPABASE_DB_PASSWORD` — PostgreSQL database password for direct migrations.
- `GEMINI_API_KEY` — Google Gemini API key for live multimodal and text audits.
- `AI_PROVIDER` — Provider identifier for AI integrations (e.g., `gemini`).
- `AI_MODEL` — Primary Gemini model name for live audit stages (e.g., `gemini-3.8-flash`).
- `AI_FALLBACK_MODEL` — Fallback Gemini model name for hedged requests (e.g., `gemini-3.1-flash-lite`).
- `AI_MAX_REQUESTS_PER_USER_PER_HOUR` — Rate-limiting quota cap per user per hour.
- `NEXT_PUBLIC_APP_URL` — Base web application URL (e.g., `http://localhost:3000`).
- `DEMO_MODE_ENABLED` — Boolean flag enabling the instant 4-role demo portal at `/demo`.
- `DEMO_PASSWORD` — Standard authentication password for benchmark demo accounts.
- `MAX_UPLOAD_MB` — Maximum allowable upload file size in megabytes.

---

## Setup & Local Run

Clone the repository and run the following commands:

```bash
# 1. Install dependencies
npm install

# 2. Push database schema and migrations to your linked Supabase project
npx supabase db push --include-all --linked

# 3. Seed benchmark demonstration data (Nova Creative, facts, guidelines, demo roles)
npm run seed

# 4. Start the local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

---

## Known Limitations

- **Gemini can be briefly overloaded:** Upstream Gemini API capacity spikes (HTTP 503 or 429 rate limits) can occasionally delay live AI responses; the platform automatically activates the hedged fallback model or defaults to deterministic rule-based analysis with transparent telemetry labeling.
- **Image checks are not forensic:** Visual consistency scans evaluate brand logo variants, color contrast, palette accuracy, and unauthorized elements; they do not perform deepfake forensics or cryptographic watermark verification.
- **Seeded demo data:** The demonstration organization (*Nova Creative*) contains pre-populated benchmark facts and synthetic marketing drafts intended for evaluation and compliance simulation.

---

## License

Proprietary enterprise software built for brand governance. All rights reserved.
