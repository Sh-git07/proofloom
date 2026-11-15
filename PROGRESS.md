# PROOFLOOM — PROGRESS & DEPLOYMENT RUNBOOK

> **Tagline:** Where every brand claim has a thread of proof.  
> **Architecture:** Next.js (App Router) + TypeScript + Tailwind CSS (Neo-Brutalist) + Supabase (Postgres, Auth, Storage, RLS) + Gemini AI Engine.

---

## 1. Phase Status Overview

| Phase | Description | Status | Verification & Gates |
|---|---|---|---|
| **Phase 1: Foundation & Design System Pass** | Scaffold, Env Validation, Database Migrations, RLS, Auth, Seed, Neo-Brutalist Engineering Control Room UI | **COMPLETE** | `npm run build` passes; `npm run lint` passes (0 errors, 0 warnings); all migrations applied to Supabase; `npm run seed` verified; RLS multi-tenant isolation test passes; permission matrix tests pass; demo login for 4 roles wired; complete Neo-Brutalist design tokens, shared UI components, AppShell with mobile drawer, and dense control room Overview console. |
| **Phase 2: Core Product** | Content Studio, Uploads, Staged Audit Pipeline, Deterministic Engine + Gemini, Scoring, Findings Report | **READY TO START** | Awaiting user "go". |
| **Phase 3: Differentiators** | Claim Provenance Chain, Intent-Preserving Rewrite, Knowledge Vault CRUD, Brand Memory Court | Planned | - |
| **Phase 4: Governance** | Review Queue, Server-Enforced Approval Function + Critical Override, Notifications, Activity Log | Planned | - |
| **Phase 5: Intelligence** | Systemic Brand Drift Radar, Governance Insights, Recharts Analytics | Planned | - |
| **Phase 6: Finish & Deploy** | Settings, Landing Page Polish, Security Checklist, Vercel & Supabase Cloud Deployment | Planned | - |

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
   - Persistent header: demo banner, organisation indicator (`Nova Creative`), global search, notifications bell with unread count, `+ NEW AUDIT` button, and `LIVE AI` / `DEMO MODE` status LED.
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

## 3. How to Run Locally

```bash
# 1. Run migrations against database
npx tsx scripts/migrate.ts

# 2. Seed database
npm run seed

# 3. Run automated test suite
npm test

# 4. Start production server
npm run build && npm run start
```

Open [http://localhost:3000](http://localhost:3000) or [http://localhost:3000/demo](http://localhost:3000/demo).
