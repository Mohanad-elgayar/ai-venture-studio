# BIM Coordination Center — Enterprise BIM & Clash Management Dashboard

A working web application for BIM managers to run coordination meetings with the Client, PMC, Lead Consultant and Main Contractor: clash matrix, clash register, model coordination, deliverables (MIDP/TIDP), ISO 19650 / BEP compliance, progress, risks, imports and formal reports.

> **Demo data:** the app starts with a clearly labelled, entirely **fictional** demo project ("DEMO — Harbourfront Mixed-Use Development"). Every page, export and PDF carries a *DEMO DATA* banner. Use **Project & Access → Start a blank project** to report on real data only.

## Quick start

```bash
cd bim-dashboard
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (metrics, matrix, importers)
npm run build        # production build in dist/ (static, deployable anywhere)
```

Single self-contained HTML file (all code, styles and demo data inlined; opens by double-click, no server):

```bash
npm run build:single   # -> release/BIM-Coordination-Center.html
```

End-to-end smoke test (50 checks: navigation, filters, matrix drill-down, edits, permissions, imports, all exports and reports, responsive layouts):

```bash
npm run build && npx vite preview --port 4173 &
BASE_URL=http://localhost:4173 node e2e/smoke.cjs
```

## Modules

| Module | What it does |
|---|---|
| **Executive Overview** | 12 KPI cards (with change vs previous period), overall BIM health score with transparent components, performance trend, weekly clash resolution, open vs closed, severity distribution, discipline contribution, hotspots, critical/overdue list. Every card drills into the filtered register. |
| **Clash Matrix** | Interactive 10×10 discipline matrix (ARC, STR, MEC, ELE, PLB, FF, HVAC, INF, LND, CIV). Views: Total / Open / Critical / Resolved / Overdue. Hard / Soft / Clearance filter. Colour by worst severity or count intensity. Click a cell (or a discipline total) → searchable, sortable, paginated clash list → edit. CSV / Excel / PDF matrix report. |
| **Clash Management** | Full register with all required fields, 8 statuses, 4 severities, P1–P4 priorities. Add / edit / delete, assign, change status, resolution notes, comments, full change history, bulk update, overdue tracking, repeat-clash tracking, CSV / Excel export. |
| **Model Coordination** | Received / under review / approved / rejected / pending update, federation matrix (building × discipline), submission timeline, revision history per model, record new submissions, per-discipline progress. |
| **BIM Deliverables** | BEP (pre/post-contract), MIDP, TIDP, model deliveries, coordination & clash reports, 4D, COBie, as-built, O&M. Planned vs actual S-curve, variance, approval tracking, add/edit/delete. |
| **Compliance & Quality** | ISO 19650, BEP, naming, federation, information quality, LOD/LOI, shared coordinates, model audit, IFC export, model health. **Categories without recorded evidence are shown as NOT VERIFIED — compliance is never assumed.** Naming compliance is also checked automatically against the ISO 19650 pattern. |
| **Progress & Performance** | Overall and component progress, weekly/monthly trends recomputed historically, per-discipline comparison, monthly performance table. |
| **Risks & Issues** | Computed risk indicators (critical coordination, repeated clashes, overdue issues, delayed submissions, missing information, design dependencies, outstanding consultant comments), 5×5 heat map, risk register and coordination issue register (CRUD). |
| **Reports & Export** | Executive, Clash Matrix, Weekly Progress and Monthly Performance reports as generated **PDF**, **print-friendly** page, **Excel report pack** and CSV. Each includes project name, reporting period, prepared by, issue date, KPI summary, charts, outstanding issues, key observations (auto-generated, editable) and action items (derived, editable). |
| **Data Import** | Excel (.xlsx), CSV, **Navisworks Clash Detective XML**, **Navisworks HTML (Tabular)**, and coordination issue / deliverable registers. Column-mapping UI with auto-suggestions, defaults, row-level validation preview, duplicate detection (within file and against existing IDs, skip or update), validation report download. |
| **Project & Access** | Buildings / zones / levels / packages, users & roles, companies, reporting periods, JSON backup / restore, reset to demo, start blank project, permission matrix. |

Global filters (project, reporting period, discipline, building, zone, level, package) apply to every KPI, chart, matrix, table and report. Light and dark themes; collapsible sidebar; designed for 1920×1080 and responsive down to tablet.

## How the numbers are calculated

All metrics are pure functions in `src/lib/metrics.ts` (unit-tested in `metrics.test.ts`). Nothing is hardcoded.

**Reporting date (as-of).** The reporting period sets the as-of date (period end, capped at today). *Live* (default) = last 7 days to today, so edits show immediately; weekly and monthly periods support formal reporting.
- A record is in scope if it existed on/before the as-of date.
- A clash is **closed** only if its status is Resolved/Closed **and** its resolution date is on/before the as-of date; otherwise it is open (so historic reports are reproducible).
- **Overdue** = open and due date before the as-of date.

**Matrix.** Discipline pairs are normalised (A ≤ B in discipline order) on save and import, so a pair is never counted twice; the matrix shows the lower triangle, the diagonal holds same-discipline clashes. Cells sum to the unique total. The *Involved* column counts a clash once for each of its two disciplines (documented on screen). Matrix view totals are tested to equal the KPI cards.

| KPI | Definition |
|---|---|
| Open / Closed / Total | as above |
| Critical clashes | open, severity Critical |
| High priority | open, priority P1 or P2 |
| Resolution rate | closed ÷ total |
| Overdue issues | overdue clashes + overdue coordination issues |
| Deliverables submitted / approved | actual date / review date on or before as-of |
| Model coordination progress | models whose latest submission is Approved ÷ registered models |
| Overall BIM progress | 30% model development (author-reported) + 25% model coordination + 25% clash resolution + 20% deliverables approved (components without data are excluded from the weighting) |
| BIM health | weighted: resolution 30%, open-within-due 20%, critical exposure 15%, deliverables on time 20%, verified compliance 15% |
| Compliance score | (Pass + 0.5 × Observation) ÷ checks, per category; unverified categories excluded and labelled |

## Architecture

- **React 18 + TypeScript + Vite**, Tailwind CSS, Recharts, lucide icons.
- **ExcelJS** (xlsx read/write), **PapaParse** (CSV), **jsPDF + autotable** (vector PDF reports). Heavy libraries are lazy-loaded.
- `src/types.ts` — domain model. `src/data/` — store (React context), repository layer, demo generator. `src/lib/` — metrics, exports, PDF, report builder, permissions. `src/importers/` — parsers, field mapping, validation. `src/pages/` — modules.

### Data layer

`src/data/repository.ts` provides two interchangeable repositories:

- **Local (default)** — data stored in the browser (localStorage). Zero setup; single user per browser. Use JSON backup/restore to move data.
- **Supabase** — enabled when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set (see `.env.example`). Users sign in with Supabase Auth; roles come from `profiles.role` and are enforced by **Row Level Security**.

### Connecting Supabase

1. Create a Supabase project and run `supabase/migrations/20261116000000_bim_dashboard_schema.sql` (SQL editor or `supabase db push`).
2. Copy `.env.example` to `.env.local` and fill in the URL and anon key; rebuild.
3. Create users in Supabase Auth — a `Viewer` profile is created automatically. Promote at least one user to `Admin` or `BIM Manager` (`update profiles set role='BIM Manager' where email='…'`).
4. Sign in as that user and set up the project in **Project & Access** (or restore a JSON backup), then import data.

Schema: `projects`, `disciplines`, `companies`, `profiles` (users), `reporting_periods`, `bim_models`, `model_submissions`, `clash_records`, `clash_history`, `bim_deliverables`, `coordination_issues`, `risk_register`, `compliance_checks` — with foreign keys, enum/date CHECK constraints, unique clash IDs per project, indexes for matrix/register queries, and `updated_at` triggers.

RLS: every signed-in user with a profile can read; BIM Coordinators+ create/edit; only Admin/BIM Manager delete or change project setup; Discipline Leads can update **only status/resolution notes** on clashes assigned to them or their discipline (enforced by policy + trigger); clash history is append-only and cannot be written in another user's name.

### Roles

| Role | Rights |
|---|---|
| Admin, BIM Manager | everything, incl. delete, project setup, reset/restore |
| BIM Coordinator | create/edit clashes and registers, import |
| Discipline Lead | update status/notes on own-discipline clashes |
| Viewer (Client, PMC) | read-only dashboards and exports |

In local mode, *Acting as* in the top bar previews each role (UI-level only — local mode is not a security boundary).

## Importing Navisworks clash reports

In Navisworks **Clash Detective → Report**, export **XML** (recommended) or **HTML (Tabular)**. The importer reads clash name/GUID, test name, status (New / Active / Reviewed / Approved / Resolved → New / Active / Pending Review / Closed / Resolved), description (Hard / Hard (Conservative) / Clearance / Duplicates), distance, grid location (grid + level), clash point, found / approved dates, item layers / names / source files and comments. Disciplines are inferred from the test name (e.g. `MEC vs STR`) or item sources/layers; severity can be derived from penetration depth. Clash IDs are built as `<TEST>-<ClashName>` so re-imports update or skip rather than duplicate. Sample files are in `public/samples/` (fictional).

This is a **file-based** import. There is **no live API integration** with Navisworks or Autodesk Construction Cloud.

## Verification performed

- 33 unit tests: KPI consistency (open + closed = total), matrix no-double-counting for all 5 views, matrix totals = KPI cards, filter partitioning, as-of reconstruction, deterministic demo data, CSV/XML/HTML import mapping, duplicate & invalid-date rejection, day-first date parsing.
- 50-check Playwright smoke test on the production build (see above).
- The SQL migration was executed on PostgreSQL 16 with a stubbed Supabase `auth` schema; the full demo dataset was loaded through the app's own row mapping (all constraints satisfied) and RLS was exercised for Viewer, Discipline Lead, Coordinator, Manager and anonymous users.

## Known limitations

- The Supabase client path (sign-in, load/save through PostgREST) has **not been run against a live Supabase project** — the schema, constraints and RLS were verified directly on PostgreSQL, and the local mode is the tested path.
- Supabase mode loads tables into the browser; suitable for tens of thousands of clashes. Larger programmes should move aggregation server-side (views / RPC).
- Local mode: browser storage only (~5 MB), no multi-user sharing.
- Compliance reflects recorded audit checks plus the automated naming check; the app does not open model files.
- `.xls` (legacy) and BCF files are not imported — save as `.xlsx`/`.csv`.
- Model development % is as reported by the authoring party.
- Demo dates are shifted relative to today so the demo always looks current.
