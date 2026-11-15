# PROOFLOOM — PROGRESS & DEPLOYMENT RUNBOOK

> **Tagline:** Where every brand claim has a thread of proof.  
> **Architecture:** Next.js (App Router) + TypeScript + Tailwind CSS (Neo-Brutalist) + Supabase (Postgres, Auth, Storage, RLS) + Gemini AI Engine.

---

## 1. Phase Status Overview

| Phase | Description | Status | Verification & Gates |
|---|---|---|---|
| **Phase 1: Foundation** | Scaffold, Env Validation, Database Migrations, RLS, Auth, Seed, App Shell | **COMPLETE** | `npm run build` passes; all migrations applied to Supabase; `npm run seed` verified; RLS multi-tenant isolation test passes; permission matrix tests pass; demo login for 4 roles wired. |
| **Phase 2: Core Product** | Content Studio, Uploads, Staged Audit Pipeline, Deterministic Engine + Gemini, Scoring, Findings Report | **NEXT** | Pending Phase 1 sign-off. |
| **Phase 3: Differentiators** | Claim Provenance Chain, Intent-Preserving Rewrite, Knowledge Vault CRUD, Brand Memory Court | Planned | - |
| **Phase 4: Governance** | Review Queue, Server-Enforced Approval Function + Critical Override, Notifications, Activity Log | Planned | - |
| **Phase 5: Intelligence** | Systemic Brand Drift Radar, Governance Insights, Recharts Analytics | Planned | - |
| **Phase 6: Finish & Deploy** | Settings, Landing Page Polish, Security Checklist, Vercel & Supabase Cloud Deployment | Planned | - |

---

## 2. Phase 1 Accomplishments

1. **Scaffold & Dependencies:**
   - Initialized Next.js App Router with TypeScript (strict), Tailwind CSS, ESLint.
   - Installed `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `react-hook-form`, `framer-motion`, `recharts`, `lucide-react`, `unpdf`, `mammoth`, `diff`, `date-fns`, `vitest`, `tsx`, `pg`.

2. **Environment Validation:**
   - Strict Zod schema in `src/lib/env.ts` verifying all server and client variables with runtime error reporting.
   - Committed `.env.example` with clear documentation; `.env.local` kept gitignored.

3. **Supabase Database Schema & RLS:**
   - Numbered migrations applied to cloud Postgres:
     - `supabase/migrations/20261115000001_initial_schema.sql`: 26 tables, UUID primary keys, foreign keys, indexes, and constraints.
     - `supabase/migrations/20261115000002_functions_and_rls.sql`: STABLE helper functions `is_org_member()` and `org_role()`, immutability triggers on `activity_logs`, `approval_decisions`, `challenge_decisions`, `content_versions`, strict RLS on all 26 tables and storage buckets (`content-uploads`, `knowledge-docs`, `brand-assets`), and transactional RPC stored procedures (`create_content_with_version`, `accept_rewrite`, `submit_for_review`, `record_approval_decision`).

4. **Multi-Tenant Isolation & Permissions Verification:**
   - `tests/isolation.test.ts`: Proves live against the Supabase database that Nova Creative members cannot read Orbit Labs facts or data.
   - `tests/permissions.test.ts`: Verifies full permission matrix across Admin, Brand Manager, Creator, Reviewer roles, including the server-enforced critical override restriction (minimum 15-character justification).

5. **Seeded Demonstration Data (`npm run seed`):**
   - Organization: **Nova Creative**
   - Demo Users (Password: `ChangeMe-Demo-2026!`):
     - Admin: `admin.demo@example.com`
     - Brand Manager: `manager.demo@example.com`
     - Creator: `creator.demo@example.com`
     - Reviewer: `reviewer.demo@example.com`
   - Test Org: **Orbit Labs** (`orbit.user@example.com`)
   - Guidelines, Facts (Pilot 18%, Customer count 12,400, Expired 8,000), Terminology rules, Scenarios A–D, 25 historical audits, 3 drift insights, notifications, and activity logs.

6. **Neo-Brutalist Technical Dashboard Shell:**
   - Palette tokens: Primary green (`#16834A`), Signal lime (`#B7F28B`), Machine black (`#17251C`), Blueprint paper (`#F4F1E8`), Border green (`#253C2B`), Amber (`#E6A23C`), Critical red (`#D94C4C`).
   - Hard offset shadows, 2px borders, Space Grotesk / Inter / JetBrains Mono typography.
   - App shell with 10 fixed numbered navigation routes, live LED system status indicator (`LIVE AI` / `DEMO MODE`), demo banner, and role switcher.

---

## 3. How to Run Locally

```bash
# 1. Run migrations against database
npx tsx scripts/migrate.ts

# 2. Seed database
npm run seed

# 3. Run automated test suite
npm test

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) or [http://localhost:3000/demo](http://localhost:3000/demo).

---

## 4. Known Issues / Notes

- Next.js 16 deprecated `middleware.ts` naming convention in favor of proxy; functioning as intended during build.
- External Google Fonts require network access or local cache; CSP and fonts configured cleanly.
