# PROOFLOOM

> **Where every brand claim has a thread of proof.**  
> The intelligent verification and governance layer between content creation and publication.

[![Production](https://img.shields.io/badge/Production-Live%20on%20Vercel-16834A?style=flat-square)](https://proofloom-six.vercel.app)
[![Tests](https://img.shields.io/badge/Tests-54%2F54%20Passing-B7F28B?style=flat-square&labelColor=17251C)](https://proofloom-six.vercel.app)

---

## Live Deployment

- **Production URL:** [https://proofloom-six.vercel.app](https://proofloom-six.vercel.app)
- **Instant Demo Switcher:** [https://proofloom-six.vercel.app/demo](https://proofloom-six.vercel.app/demo)
- **Database:** Supabase Cloud (PostgreSQL 15 + RLS + Custom RPCs)
- **Hosting:** Vercel Edge & Serverless Cloud Functions

---

## What is PROOFLOOM?

PROOFLOOM is an AI-powered Brand Governance and Brand Integrity Platform built for modern enterprise marketing and communications teams. Rather than acting as a generic writing assistant, PROOFLOOM acts as an authoritative governance checkpoint:
- It cross-references marketing copy and claims against approved empirical brand facts.
- It detects numeric contradictions and outdated statistics using deterministic mathematical tolerance checks.
- It surfaces intent-preserving rewrites with word-level visual diffing.
- It clusters systemic brand drift across departments.
- It routes contested findings through human adjudication via the **Brand Memory Court**.
- It enforces strict database-backed sign-off gates where critical brand infractions cannot be bypassed without documented administrative overrides.

---

## Tech Stack

- **Framework:** Next.js (App Router, Server Actions, Route Handlers) + TypeScript (Strict)
- **Design System:** Custom Neo-Brutalist Engineering Control Room (Tailwind CSS v4 + PostCSS)
- **Typography:** Space Grotesk (Headings), Inter (Body), JetBrains Mono (Metadata & Telemetry)
- **Database & Auth:** Supabase (PostgreSQL with Row-Level Security, 26 Relational Tables, Custom RPC Functions)
- **AI Engine:** Google Gemini REST API (`gemini-2.5-flash`) with offline deterministic demo fallback
- **Analytics & Visuals:** Recharts + Framer Motion + Lucide React
- **Document Ingestion:** unpdf (Serverless-safe PDF parsing) + mammoth (DOCX) + UTF-8 TXT
- **Test Suite:** Vitest (13 test suites, 54 tests) + ESLint

---

## 10 Core Governance Modules

1. **01 — SYSTEM OVERVIEW (`/overview`):** Telemetry dashboard featuring the Brand Integrity Index, audit activity feeds, knowledge base health, and live drift alerts.
2. **02 — CONTENT STUDIO (`/studio`):** Submission ingestion workbench supporting file uploads (PDF, DOCX, TXT) and 4 pre-configured scenario presets (Scenarios A, B, C, D) with dual AI/Demo execution modes.
3. **03 — AUDIT HISTORY (`/audits`):** Searchable, filterable audit archive with status, department, and content type facets.
4. **04 — BRAND KNOWLEDGE VAULT (`/knowledge`):** 6-tab centralized governance library covering Approved Facts (with expiry warnings), Terminology, Guidelines, Assets, Examples, and Mandatory Legal Disclaimers.
5. **05 — CLAIM PROVENANCE (`/provenance`):** 5-stage SVG visual pipeline (`Submitted Claim` &rarr; `Extraction` &rarr; `Source Match` &rarr; `Comparison` &rarr; `Result`) with interactive fact reassessment workbench.
6. **06 — REVIEW QUEUE (`/reviews`):** Human governance sign-off workbench with database-enforced critical override gates and the Brand Memory Court challenge queue.
7. **07 — BRAND DRIFT RADAR (`/drift`):** Systemic pattern clustering across departments, tracking drift velocity (+14.2%/30d), expired metric reuse, and root-cause remediation workflows.
8. **08 — GOVERNANCE INSIGHTS (`/insights`):** Recharts executive intelligence console with monthly volume/compliance trend lines, department comparisons, dimension donut charts, and one-click `.md` / `.json` exporters.
9. **09 — TEAM & ACCESS (`/team`):** Multi-tier RBAC roster (Creator, Reviewer, Brand Manager, Admin) with admin role modification and team member invitations.
10. **10 — GOVERNANCE SETTINGS (`/settings`):** Configurable scoring weights (must sum to 100%), severity deduction points, numerical claim tolerance percentage, and external AI privacy toggles.

---

## Quick Start & Local Run

### Prerequisites
- Node.js 20+
- npm

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-org/proofloom.git
cd proofloom
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and add your Supabase and Gemini keys:
```bash
cp .env.example .env.local
```
Minimum required keys:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key # Optional: platform falls back to offline deterministic rules
AI_PROVIDER=gemini
AI_MODEL=gemini-2.5-flash
NEXT_PUBLIC_APP_URL=http://localhost:3000
DEMO_MODE_ENABLED=true
DEMO_PASSWORD=ChangeMe-Demo-2026!
```

### 3. Apply Database Migrations & Seed Data
```bash
# Run PostgreSQL migrations
npx tsx scripts/migrate.ts

# Seed demo benchmark data (Nova Creative organisation + 4 test roles + 4 benchmark scenarios)
npm run seed
```

### 4. Run Automated Test Suite
```bash
npx vitest run
```

### 5. Start Production Server
```bash
npm run build
npm run start
```
Open [http://localhost:3000](http://localhost:3000) or navigate directly to the Demo Portal at [http://localhost:3000/demo](http://localhost:3000/demo).

---

## Demo Roles (Instant Sign-In at `/demo`)

When `DEMO_MODE_ENABLED=true`, navigate to `/demo` to log in with one click as any of the 4 benchmark personas:
- **Alex Vance (Admin):** Executive level. Full settings control, database critical override authority, team management.
- **Morgan Riley (Brand Manager):** Brand Governance. Knowledge Vault CRUD, guidelines management, reviewer assignments.
- **Sam Taylor (Reviewer):** Legal & Compliance. Content review sign-off workbench, Brand Memory Court challenge rulings.
- **Casey Jordan (Creator):** Product Marketing. Content draft submissions, audit execution, intent-preserving rewrite adoption.

---

## Deployment Guide

### Deploying Database on Supabase Cloud
1. Create a new Supabase project at [https://supabase.com](https://supabase.com).
2. Copy your Project URL, Anon Key, and Service Role Key from **Project Settings &rarr; API**.
3. Apply the migrations in order:
   - `supabase/migrations/20261115000001_initial_schema.sql` (Tables, constraints, indexes)
   - `supabase/migrations/20261115000002_functions_and_rls.sql` (RLS policies, `record_approval_decision`, `accept_rewrite`, `submit_for_review`)
4. Run the seed script:
   ```bash
   npm run seed
   ```

### Deploying Frontend on Vercel
1. Push your repository to GitHub or GitLab.
2. Import the project into [Vercel](https://vercel.com).
3. Set the Environment Variables in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY` (optional)
   - `AI_PROVIDER=gemini`
   - `AI_MODEL=gemini-2.5-flash`
   - `DEMO_MODE_ENABLED=true`
   - `DEMO_PASSWORD=ChangeMe-Demo-2026!`
   - `NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app`
4. Click **Deploy**. Vercel will build and deploy the Next.js application.

---

## License

Proprietary enterprise software built for brand governance. All rights reserved.
