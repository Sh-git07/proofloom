# PROOFLOOM — PROGRESS & DEPLOYMENT RUNBOOK

> **Tagline:** Where every brand claim has a thread of proof.  
> **Architecture:** Next.js (App Router) + TypeScript + Tailwind CSS (Neo-Brutalist) + Supabase (Postgres, Auth, Storage, RLS) + Gemini AI Engine.

---

## 1. Phase Status Overview

| Phase | Description | Status | Verification & Gates |
|---|---|---|---|
| **Phase 1: Foundation & Design System Pass** | Scaffold, Env Validation, Database Migrations, RLS, Auth, Seed, Neo-Brutalist Engineering Control Room UI | **COMPLETE** | `npm run build` passes; `npm run lint` passes (0 errors, 0 warnings); all migrations applied to Supabase; `npm run seed` verified; RLS multi-tenant isolation test passes; permission matrix tests pass; demo login for 4 roles wired; PostCSS + Tailwind v4 compilation verified; complete Neo-Brutalist design tokens, shared UI components, AppShell with mobile drawer, and dense control room Overview console verified via browser subagent. |
| **Phase 2: Core Product** | Content Studio, Uploads, Staged Audit Pipeline, Deterministic Engine + Gemini, Scoring, Findings Report | **COMPLETE** | `npm run build` passes; `npm run lint` passes (0 errors, 0 warnings); 29/29 unit tests pass across 8 test suites; file parser handles PDF, DOCX, TXT; AI provider abstraction (Gemini + offline demo fallback); deterministic claim extraction with character offsets; evidence comparison decision table (Scenarios A–D verified: Scenario A -> CONTRADICTED, Scenario B -> VOICE/TERMINOLOGY, Scenario C -> OUTDATED, Scenario D -> VERIFIED & clean); transparent 100-point scoring model with category cards; serverless-safe 7-stage pipeline (`POST /api/audits/[id]/run-stage`); live audit runner animation; findings report with inline highlighted document viewer. |
| **Phase 3: Differentiators** | Claim Provenance Chain, Intent-Preserving Rewrite, Knowledge Vault CRUD, Brand Memory Court | **COMPLETE** | `npm run build` passes; `npm run lint` passes (0 errors, 0 warnings); 33/33 unit tests pass across 10 test suites; Claim Provenance 5-stage SVG visual pipeline with fact attachment and deterministic reassessment (`reassessClaimAction`); Intent-preserving rewrite engine with word-level diffing (`diffWordsWithSpace`), Version N+1 creation (`accept_rewrite`), and rejection logs; 6-tab Brand Knowledge Vault CRUD with Zod validation and expiring-soon badges (<=30d); Brand Memory Court challenge submission and reviewer adjudication. |
| **Phase 4: Governance** | Review Queue Workbench, Database-Enforced Approval RPC + Critical Override Gate, Audit History Console, Team & Access, Notifications | **COMPLETE** | `npm run build` passes; `npm run lint` passes (0 errors, 0 warnings); 44/44 unit tests pass across 11 test suites; multi-tier Human Review Queue workbench with tabbed Brand Memory Court queue; database-enforced `record_approval_decision` RPC preventing non-admin approval of unresolved critical findings; 15-character mandatory administrative override rationale logged to `activity_logs`; Audit History with multi-criteria filtering (status, department, content type, text query); Team & Access workbench with role badge capabilities and admin invitation modal; interactive live Notifications popover in app shell header. |
| **Phase 5: Intelligence** | Systemic Brand Drift Radar, Governance Insights, Recharts Analytics, Markdown & JSON Exporters | **COMPLETE** | `npm run build` passes; `npm run lint` passes (0 errors, 0 warnings); 48/48 unit tests pass across 12 test suites; Brand Drift Radar workbench with active cluster metrics, drift velocity (+14.2%), category filters, automated corpus scan (`scanForDriftAction`), and investigation modal with resolution actions (`updateDriftStatusAction`); Recharts-powered Governance Insights dashboard with multi-metric volume/compliance trend lines, department horizontal comparison bars, dimension donut distribution, top recurring violation table, and one-click Markdown & JSON report downloaders. |
| **Phase 6: Finish & Deploy** | Settings (10), Landing Page Polish, Security Checklist, Vercel & Supabase Cloud Deployment Runbook | **COMPLETE** | `npm run build` passes; `npm run lint` passes (0 errors, 0 warnings); 54/54 unit tests pass across 13 test suites; interactive Governance Settings workbench with external AI privacy toggle, scoring weight sum validation (100%), severity deductions, tolerance %, and retention days; master README.md with complete architecture, quick start, demo personas, and Vercel/Supabase deployment runbook; production daemon verified on port 3000. |

---

## 2. Design System Pass Deliverables (Section 13)

1. **Exact Design Tokens (`src/app/globals.css`):**
   - Palette: `paper` (`#F4F1E8`), `ink` (`#17251C`), `green` (`#16834A`), `lime` (`#B7F28B`), `muted` (`#DDEBDD`), `border` (`#253C2B`), `secondary text` (`#637367`), `amber` (`#E6A23C`), `red` (`#D94C4C`), `white` (`#FFFFFF`).
   - Removed all default gray/blue/purple generic SaaS tokens.
   - Engineering blueprint grid texture background (`radial-gradient(#253C2B15 1px, transparent 1px)`).
   - Hard offset shadows without blur (`4px 4px 0 #253C2B`, `2px 2px 0 #253C2B`, `6px 6px 0 #253C2B`).
   - Sharp 3px focus outline (`outline: 3px solid #16834A !important; outline-offset: 2px !important;`).

2. **Global Typography (`src/app/layout.tsx`):**
   - Headings: `Space_Grotesk` (weights 500, 600, 700) with `-0.02em` tracking.
   - Body: `Inter` (weights 400, 500, 600, 700).
   - Monospace: `JetBrains_Mono` (labels, IDs, metadata, telemetry metrics, and uppercase badges).

3. **Restyled Shared UI Components (`src/components/ui/`):**
   - [`Button`](file:///c:/Users/hp/Desktop/proofloom/src/components/ui/button.tsx): 2px solid `#253C2B` border, radius 2px, hard offset shadow, hover translation (`translate(-1px, -1px)`), active press (`translate(1px, 1px)`).
   - [`Card`](file:///c:/Users/hp/Desktop/proofloom/src/components/ui/card.tsx): 2px solid border, 4px hard offset shadow, optional interactive hover shift.
   - [`Input`](file:///c:/Users/hp/Desktop/proofloom/src/components/ui/input.tsx): 2px solid border, monospace font, 3px focus outline, no soft blur.
   - [`Select`](file:///c:/Users/hp/Desktop/proofloom/src/components/ui/select.tsx): Custom brutalist dropdown with 2px border and monospace options.
   - [`Badge`](file:///c:/Users/hp/Desktop/proofloom/src/components/ui/badge.tsx): Uppercase monospace chip with bold 2px borders and palette variants.
   - [`Table`](file:///c:/Users/hp/Desktop/proofloom/src/components/ui/table.tsx): Tabular engineering grid with `#F4F1E8` headers and crisp row borders.
   - [`Tabs`](file:///c:/Users/hp/Desktop/proofloom/src/components/ui/tabs.tsx): Brutalist tab switcher with active `#16834A` background and `#B7F28B` text.
   - [`Dialog`](file:///c:/Users/hp/Desktop/proofloom/src/components/ui/dialog.tsx): Solid 60% ink backdrop (no glassmorphism), 6px offset shadow modal with close button.

4. **Reusable Domain Components (`src/components/ui/`):**
   - [`SectionLabel`](file:///c:/Users/hp/Desktop/proofloom/src/components/ui/section-label.tsx): Numbered uppercase mono heading (e.g. `01 — SYSTEM OVERVIEW`).
   - [`StatusLED`](file:///c:/Users/hp/Desktop/proofloom/src/components/ui/status-led.tsx): Pulsing hardware indicator (`live`, `demo`, `processing`, `critical`, `idle`).
   - [`SeverityChip`](file:///c:/Users/hp/Desktop/proofloom/src/components/ui/severity-chip.tsx): `CRITICAL` red, `HIGH` amber, `MEDIUM` lime outline, `LOW` muted, `INFO` outline.
   - [`MetricPanel`](file:///c:/Users/hp/Desktop/proofloom/src/components/ui/metric-panel.tsx): Big telemetry readouts with uppercase mono labels, health status color, and telemetry subtext.
   - [`IdTag`](file:///c:/Users/hp/Desktop/proofloom/src/components/ui/id-tag.tsx): Monospaced technical ID / audit hash tag.

5. **App Shell & Mobile Drawer (`src/components/shell/AppShell.tsx`):**
   - Fixed desktop sidebar with 10 numbered navigation items in uppercase JetBrains Mono.
   - Active navigation item in `#16834A` background with `#B7F28B` text and 2px border.
   - Persistent header: demo banner, organisation indicator (`Nova Creative`), global search, notifications popover with unread counter, `+ NEW AUDIT` button, and `LIVE AI` / `DEMO MODE` status LED.
   - Mobile: Responsive hamburger toggle opening a full slide-out drawer with 2px borders and active item indicators.

6. **Rebuilt Overview Page (`src/app/(app)/overview/page.tsx`):**
   - Dense engineering control room layout:
     - 6x `MetricPanel` telemetry readouts (Integrity Index, Audits Completed, Pending Review, Critical Findings, Verified Claims, Issues Resolved).
     - Live Audit Telemetry Feed table.
     - Knowledge Source Health & Verification Index module.
     - Systemic Brand Drift Radar module.
     - Immutable activity log terminal feed.
     - Engineering footnote.

---

## 3. Phase 2 Deliverables (Core Product)

1. **File Parser Service ([`src/lib/parser/index.ts`](file:///c:/Users/hp/Desktop/proofloom/src/lib/parser/index.ts)):**
   - Server-side text extraction for PDF (`unpdf`), DOCX (`mammoth`), and TXT (UTF-8).
   - Strict size gating (≤ 10MB) and MIME-type validation.
   - Dedicated upload endpoint: `POST /api/upload/parse`.

2. **AI Provider Abstraction ([`src/lib/ai/index.ts`](file:///c:/Users/hp/Desktop/proofloom/src/lib/ai/index.ts)):**
   - `generateStructured<T>()` with Zod schema validation and single retry.
   - Native Google Gemini REST integration (`gemini-2.5-flash` with `response_mime_type: "application/json"`).
   - Deterministic offline demo fallback (`callDemoStructured`) for zero-key/offline operation.
   - Enforces `organisation_settings.ai_external_allowed` before making external network calls.

3. **Deterministic & Evidence Engines ([`src/lib/audit/`](file:///c:/Users/hp/Desktop/proofloom/src/lib/audit/)):**
   - [`claim-extraction.ts`](file:///c:/Users/hp/Desktop/proofloom/src/lib/audit/claim-extraction.ts): Regular expressions and heuristics for percentages, multipliers (`3x`), business counts, superlatives (`#1`), and literal substring offset validation.
   - [`evidence.ts`](file:///c:/Users/hp/Desktop/proofloom/src/lib/audit/evidence.ts): Strict Decision Table implementation (Scenario A 300% vs 18% -> `CONTRADICTED`, Scenario C 8,000 vs 12,400 -> `OUTDATED`, tolerance variance calculation, `NO APPROVED EVIDENCE FOUND` fallback).
   - [`brand-voice.ts`](file:///c:/Users/hp/Desktop/proofloom/src/lib/audit/brand-voice.ts): Disallowed aggressive words (`destroy`, `crush`) and hype terms (`revolutionary`, `game-changing`).
   - [`terminology.ts`](file:///c:/Users/hp/Desktop/proofloom/src/lib/audit/terminology.ts): Disallowed phrase replacements and required performance disclaimer verification (`Results based on an internal pilot; individual results may vary.`).
   - [`accessibility.ts`](file:///c:/Users/hp/Desktop/proofloom/src/lib/audit/accessibility.ts): Flesch Reading Ease algorithm, long sentence check (>30 words), and CTA checks.
   - [`scoring.ts`](file:///c:/Users/hp/Desktop/proofloom/src/lib/audit/scoring.ts): 100-point transparent score model with category deductions and renormalisation across checked dimensions.

4. **Staged Execution Pipeline ([`src/lib/audit/pipeline.ts`](file:///c:/Users/hp/Desktop/proofloom/src/lib/audit/pipeline.ts)):**
   - Serverless-safe architecture: executes 1 stage per request (`export const maxDuration = 60`).
   - 7 exact stages: `[01] CONTENT INGESTION`, `[02] CLAIM EXTRACTION`, `[03] SOURCE VERIFICATION`, `[04] BRAND VOICE ANALYSIS`, `[05] TERMINOLOGY INSPECTION`, `[06] ACCESSIBILITY CHECK`, `[07] FINAL RISK ASSESSMENT`.
   - Dedicated endpoint: `POST /api/audits/[id]/run-stage`.

5. **Content Studio ([`src/app/(app)/studio/page.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/app/(app)/studio/page.tsx)):**
   - Pre-filled Scenario presets (A, B, C, D).
   - Metadata form (Title, Department, Content Type, Platform, Context, Objective).
   - Document upload dropzone (PDF, DOCX, TXT) with live word and character counts.
   - Mode switcher: `LIVE AI (GEMINI)` vs `DEMO ANALYSIS MODE`.

6. **Audit Findings Report ([`src/app/(app)/audits/[id]/page.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/app/(app)/audits/[id]/page.tsx)):**
   - Live runner animation during stage processing with stage LEDs and progress indicator.
   - Hero score gauge (0-100) with decision badge (`READY FOR REVIEW` or `REVISION REQUIRED`).
   - Dimension score breakdown cards (Voice, Claims, Terminology, Accessibility, Visual `NOT CHECKED`).
   - Inline submission viewer with color-coded highlighted text spans linked to findings.
   - Interactive findings drawer with severity filters, authoritative citations, and suggested rewrites.

---

## 4. Phase 3 Deliverables (Differentiators)

1. **Claim Provenance Chain ([`src/app/(app)/provenance/page.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/app/(app)/provenance/page.tsx) & [`src/components/provenance/ClaimProvenanceChain.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/components/provenance/ClaimProvenanceChain.tsx)):**
   - 5-stage visual pipeline: `01 SUBMITTED CLAIM` &rarr; `02 EXTRACTION` &rarr; `03 SOURCE MATCH` &rarr; `04 COMPARISON` &rarr; `05 RESULT`.
   - Displays exact benchmark names, values, variance percentages, expiry states, and literal substring offsets.
   - Displays `NO APPROVED EVIDENCE FOUND` whenever an empirical claim lacks authoritative vault backing.
   - Reassessment Workbench: Brand Managers and Reviewers can associate candidate evidence facts and trigger deterministic re-evaluation via [`reassessClaimAction`](file:///c:/Users/hp/Desktop/proofloom/src/app/actions/provenance.ts).

2. **Intent-Preserving Rewrites Engine ([`src/app/actions/rewrites.ts`](file:///c:/Users/hp/Desktop/proofloom/src/app/actions/rewrites.ts)):**
   - Per-finding actions in Audit Report:
     - **Accept Rewrite**: Calls `public.accept_rewrite` database RPC, generates Version N+1, marks finding resolved, leaves Version 1 untouched.
     - **Word-Level Diff Modal**: Interactive visual highlighting additions (lime `#B7F28B`) and deletions (red `#D94C4C`) using `diffWordsWithSpace`.
     - **Dismiss Finding**: Requires documented justification (&ge; 10 chars) and records immutable activity log.

3. **Brand Knowledge Vault ([`src/app/(app)/knowledge/page.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/app/(app)/knowledge/page.tsx) & [`src/components/knowledge/KnowledgeVaultTabs.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/components/knowledge/KnowledgeVaultTabs.tsx)):**
   - 6 functional tabs:
     - `01 APPROVED FACTS`: Numeric benchmarks, expiry trackers, and expiring-soon alerts (&le; 30 days).
     - `02 TERMINOLOGY`: Disallowed vs approved mappings with severity and rationale.
     - `03 BRAND GUIDELINES`: Published voice and tone guidelines.
     - `04 APPROVED ASSETS`: Official logos, brand colors (#F4F1E8, #17251C, #B7F28B, #16834A).
     - `05 APPROVED EXAMPLES`: Gold-standard copy samples across LinkedIn and web.
     - `06 DISCLAIMERS & POLICIES`: Mandatory legal disclaimer rules.
   - Full CRUD modal dialogs wired to server actions ([`src/app/actions/knowledge.ts`](file:///c:/Users/hp/Desktop/proofloom/src/app/actions/knowledge.ts)).

4. **Brand Memory Court ([`src/app/actions/challenges.ts`](file:///c:/Users/hp/Desktop/proofloom/src/app/actions/challenges.ts)):**
   - Interactive "CHALLENGE (COURT)" workflow directly on finding cards.
   - Validates rationale (&ge; 15 chars) and optional campaign context.
   - Adjudication decisions supported: `UPHOLD`, `REVERSE`, `ACCEPT_AS_EXCEPTION`, `REQUEST_EVIDENCE`, `PROPOSE_GUIDELINE_CHANGE`.
   - Immutable persistence in `finding_challenges` and `challenge_decisions`.

---

## 5. Phase 4 Deliverables (Governance)

1. **Review Queue Workbench ([`src/app/(app)/reviews/page.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/app/(app)/reviews/page.tsx) & [`src/components/reviews/ReviewQueueWorkbench.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/components/reviews/ReviewQueueWorkbench.tsx)):**
   - Interactive two-pane sign-off workbench:
     - Left pane: Submissions queue with live status chips (`READY_FOR_REVIEW`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `REVISION_REQUIRED`), departments, creator metadata, and assigned reviewer chips.
     - Right pane: Inspected submission details, latest audit score, version body preview, critical finding alerts, reviewer assignment dropdown (Brand Manager/Admin only), and formal decision recording form.
   - Brand Memory Court queue tab with pending challenge adjudication modal.

2. **Database-Enforced Critical Approval Gate ([`src/app/actions/governance.ts`](file:///c:/Users/hp/Desktop/proofloom/src/app/actions/governance.ts)):**
   - Enforces PostgreSQL function `record_approval_decision(p_content_item_id, p_decision, p_reason, p_is_override, p_override_reason)`:
     - If unresolved `CRITICAL` findings exist, approval is strictly blocked.
     - Only users with `role = 'admin'` can supply `p_is_override = true` with a mandatory justified rationale (&ge; 15 characters).
     - All approval actions log immutable events to `approval_decisions` and `activity_logs`.

3. **Audit History Console ([`src/app/(app)/audits/page.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/app/(app)/audits/page.tsx) & [`src/components/audits/AuditHistoryView.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/components/audits/AuditHistoryView.tsx)):**
   - Filterable, searchable table displaying all automated and human-reviewed checks.
   - Multi-criteria filters: Text query (Title, Dept, Audit ID), Status (`COMPLETED`, `PROCESSING`, `QUEUED`, `REQUIRES_REVIEW`, `FAILED`), Department, and Content Type.
   - Summary telemetry bar: Total Audits, Pass Rate (&ge; 80%), Average Compliance Score, and Total Critical Flaws Found.
   - Direct link to full audit report (`/audits/[id]`).

4. **Team & Access Workbench ([`src/app/(app)/team/page.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/app/(app)/team/page.tsx) & [`src/components/team/TeamWorkbench.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/components/team/TeamWorkbench.tsx)):**
   - Live roster table showing team members, email, department, role badges, and capabilities.
   - Role Management dropdown for Admins (`updateMemberRoleAction`).
   - "INVITE TEAM MEMBER" modal dialog for Admins (`addTeamMemberAction`).
   - Complete 4-tier Permissions Matrix reference guide (Creator, Reviewer, Brand Manager, Admin).

5. **Notifications Popover ([`src/components/shell/NotificationsPopover.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/components/shell/NotificationsPopover.tsx)):**
   - Bell icon with real-time unread badge counter in persistent app header.
   - Brutalist popover card showing recent notifications (e.g. reviewer assignments, sign-off updates).
   - "MARK READ" and click-through links (`/reviews?item=...`).

6. **Phase 4 Test Suite ([`tests/governance.test.ts`](file:///c:/Users/hp/Desktop/proofloom/tests/governance.test.ts)):**
   - 11 unit tests verifying review queue role capabilities, critical override rules, minimum rationale lengths, and database gate simulations.
   - Total test suite at 44/44 passing across 11 test suites.

---

## 6. Phase 5 Deliverables (Intelligence)

1. **Brand Drift Radar Workbench ([`src/app/(app)/drift/page.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/app/(app)/drift/page.tsx) & [`src/components/drift/BrandDriftWorkbench.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/components/drift/BrandDriftWorkbench.tsx)):**
   - Multi-department systemic drift cluster detection.
   - Executive telemetry: Active Drift Clusters, Total Violations, Drift Velocity (`+14.2% / 30d`), and Analyzed Audit Corpus.
   - Severity & Category Filter pills: `ALL`, `EXPIRED STATS`, `VOICE DEVIATIONS`, `REPEATED CLAIMS`.
   - Dynamic Corpus Scanner: `scanForDriftAction` scans historical findings across the organization and aggregates newly emerged patterns.
   - Investigation Modal with root-cause analysis, one-click Brand Knowledge Vault link, and status adjudication (`RESOLVED` / `ACCEPTED_EXCEPTION` via `updateDriftStatusAction`).

2. **Governance Insights Dashboard ([`src/app/(app)/insights/page.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/app/(app)/insights/page.tsx) & [`src/components/insights/GovernanceInsightsView.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/components/insights/GovernanceInsightsView.tsx)):**
   - Recharts-powered corporate governance intelligence console:
     - **Audit Volume & Compliance Trends:** Composite Line Chart showing monthly audit velocity and average integrity index (0-100).
     - **Department Compliance Breakdown:** Horizontal Bar Chart benchmarking compliance across Product Marketing, Brand Governance, Growth, Demand Generation, and Legal.
     - **Violations by Dimension Donut Chart:** Categorical distribution across Claims, Voice, Terminology, and Accessibility.
     - **Top Recurring Violations Table:** Ranked by frequency with severity badges and recommended fixes.
   - One-Click Exporters:
     - `EXPORT .MD`: Generates an executive governance report in Markdown.
     - `EXPORT .JSON`: Generates raw telemetry metrics and department breakdown in structured JSON.

3. **Phase 5 Automated Test Suite ([`tests/intelligence.test.ts`](file:///c:/Users/hp/Desktop/proofloom/tests/intelligence.test.ts)):**
   - 4 unit tests verifying pattern clustering heuristics, department average compliance calculations, and markdown report generation.

---

## 7. Phase 6 Deliverables (Finish & Deploy)

1. **Governance Settings Workbench ([`src/app/(app)/settings/page.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/app/(app)/settings/page.tsx) & [`src/components/settings/SettingsWorkbench.tsx`](file:///c:/Users/hp/Desktop/proofloom/src/components/settings/SettingsWorkbench.tsx)):**
   - AI Engine Analysis configuration and live status indicator.
   - External AI request privacy toggle (`organisation_settings.ai_external_allowed`) with comprehensive zero-retention enterprise privacy disclosure.
   - Configurable scoring weights (`voice`, `claims`, `terminology`, `accessibility`, `visual`) with live validation strictly requiring sum = 100%.
   - Severity point deduction calibration (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`).
   - Claim tolerance percentage (0 - 50%) and audit history retention duration (minimum 30 days).
   - Role-based write gating: strictly Admin-only with read-only badges and demo switcher prompts for non-admins.
   - Server action: [`updateOrganisationSettingsAction`](file:///c:/Users/hp/Desktop/proofloom/src/app/actions/settings.ts).

2. **Master Documentation & Deployment Runbook:**
   - Rewrote [`README.md`](file:///c:/Users/hp/Desktop/proofloom/README.md) as the flagship presentation document with product philosophy, tech stack, 10 core modules, local run steps, 4 demo personas, and step-by-step Vercel + Supabase deployment runbook.
   - `.env.example` verified with full variable listings and zero leaked credentials.
   - `.gitignore` verified ensuring all `.env*` files and secrets are never committed.

3. **Phase 6 Automated Test Suite ([`tests/settings.test.ts`](file:///c:/Users/hp/Desktop/proofloom/tests/settings.test.ts)):**
   - 6 unit tests verifying scoring weights sum validation, claim tolerance boundaries, retention minimums, and admin permission restrictions.
   - Entire platform test suite verified at **54/54 tests passing across 13 test suites**.

---

## 8. How to Run Locally

```bash
# 1. Run migrations against database
npx tsx scripts/migrate.ts

# 2. Seed database
npm run seed

# 3. Run automated test suite
npx vitest run

# 4. Start production server
npm run build && npm run start
```

Open [http://localhost:3000](http://localhost:3000) or [http://localhost:3000/demo](http://localhost:3000/demo).

---

## 9. Live Production Deployment Status

- **Status:** **LIVE & HEALTHY** (HTTP 200 OK)
- **Production URL:** [https://proofloom-six.vercel.app](https://proofloom-six.vercel.app)
- **Deployment Hash / Alias:** `proofloom-b11zpqeqk-2k24cs1o2411627-1320.vercel.app` &rarr; `proofloom-six.vercel.app`
- **Vercel Project:** `2k24cs1o2411627-1320/proofloom`
- **Database Backend:** Supabase Cloud PostgreSQL with Row-Level Security (`wbpcebryqqlmztyumlil.supabase.co`)
- **Configured Production Secrets / Environment Variables:**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `GEMINI_API_KEY`
  - `AI_PROVIDER` (`gemini`)
  - `AI_MODEL` (`gemini-2.5-flash`)
  - `DEMO_MODE_ENABLED` (`true`)
  - `DEMO_PASSWORD`
  - `NEXT_PUBLIC_APP_URL` (`https://proofloom-six.vercel.app`)
  - `MAX_UPLOAD_MB` (`10`)
  - `AI_MAX_REQUESTS_PER_USER_PER_HOUR` (`100`)
- **Live Health Verification:**
  - `GET /` &rarr; `200 OK` (Edge Prerendered with custom fonts, neo-brutalist theme, and security headers)
  - `GET /login` &rarr; `200 OK` (Preloaded woff2 fonts and CSP)
  - `GET /demo` &rarr; Demo switcher operational for all 4 roles.
