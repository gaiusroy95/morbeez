# Morbeez mobile apps

Three focused Expo apps replace the old single `mobile/` staff console mirror.

| App | Folder | Command | Auth |
|-----|--------|---------|------|
| **Farmer** (client) | `apps/farmer` | `npm run dev:farmer` | Farmer JWT (email or OTP) |
| **Pick & Pack** | `apps/warehouse` | `npm run dev:warehouse` | Staff JWT + `warehouse` write |
| **Agronomist** | `apps/agronomist` | `npm run dev:agronomist` | Staff JWT + `agronomist` (OTP or email) |
| **Telecaller** | `apps/telecaller` | `npm run dev:telecaller` | Staff JWT + `telecaller_crm` |
| **Partner** | `apps/partner` | `npm run dev:partner` | Partner JWT (OTP or password) |

Shared code: `packages/shared`, `packages/ui-native`.

## Setup

```bash
npm install
cd backend && npm run dev
cp apps/farmer/.env.example apps/farmer/.env
npm run dev:farmer
```

Set `EXPO_PUBLIC_API_BASE_URL` in each app's `.env`.

**OTP login:** Farmer, warehouse, and agronomist apps default to mobile OTP. WhatsApp delivers the code in production — set `WHATSAPP_OTP_TEMPLATE` on the backend (approved Meta/Ads Gyani template with one body variable for the code). Staff OTP requires the employee's mobile in HR (`employee_profiles.personal_mobile`). Apply migration `20260688000000_farmer_otp_mobile_source.sql` and `20260689000000_staff_otp_challenges.sql`.

## Farmer app — mockup-aligned structure

**Bottom tabs:** Home · ROI · Shop · Profile

**Home dashboard:** crop & market selectors, hero card (DAP, growth stage, current rate, YoY), embedded market analytics chart (30D/90D/1Y/2Y), weather alert banner, quick actions (AI Scan, Activities, My Fields, Recommendations).

**Market tab:** removed from bottom navigation; market analytics live on Home. Stack route `/(tabs)/market` remains for legacy deep links.

**Stack screens:** fields list, field add/edit, field details, **ROI transactions (add expense / add income)**, expense book, analytics, start/finish crop cycle, crop history, AI scan + result + history, market trend charts, recommendations, activities, orders, notifications, shop checkout.

**ROI v1 flow:** Open ROI tab → crop/block filters (when multi-field) → financial summary (profit/ROI hidden until first income) → harvest summary → sub-tabs (Overview · Transactions · Expense Book · Analytics · History) → **Add Transaction** → expense or harvest sale → multiple harvest sales keep season active → **Finish Crop Cycle** archives to history → **Start New Cycle** on same block. Field detail ROI tab is scoped to that block.

Fields and AI Scan are reachable from Home quick actions (not tab bar items).

## Warehouse app — mockup-aligned structure

**Bottom tabs:** Dashboard · Picking · Packing · Dispatch · More (role-filtered)

| Role | Visible tabs |
|------|----------------|
| `picker_packer` | Picking, More |
| `packer` | Packing, More |
| `dispatcher` | Dispatch, More |
| `warehouse` / manager / admin | All tabs |

**Stack flows:** pick rack screen → rack complete → pack form → print documents → packing complete → dispatch / LR update → order timeline + documents.

**Shared client:** `packages/shared/src/api/warehouse-client.ts` — typed wrappers for fulfillment APIs.

**Camera barcode:** `components/BarcodeScanner.tsx` on pick, pack label verify, and legacy order screen (BT wedge `TextInput` fallback).

### Warehouse API (mobile)

Base: `/morbeez-staff/api/v1/os/warehouse`

| Area | Endpoints |
|------|-----------|
| Dashboard | `GET /fulfillment/stats` |
| Queues | `GET /fulfillment/queue`, `POST /fulfillment/sync-inventory` |
| Pick | `GET /fulfillment/orders/:id`, `POST …/pack-session`, `POST /fulfillment/pack-sessions/:id/lookup-barcode`, `POST …/confirm-pick` |
| Pack | `POST …/package/*`, `POST …/mark-packed`, `POST …/verify-label`, `POST …/rebuild-pick-list` |
| Dispatch | `POST …/generate-awb`, `POST …/dispatch-rack`, dispatch-session scan, `confirm-dispatch` |
| LR | `GET /masters?type=manual_courier`, `POST …/manual-logistics` (`notifyCustomer`) |
| Label batches | `GET/POST /fulfillment/employees`, `assignable-orders`, `assign-batch`, `label-batches/*` |
| Timeline | `GET /fulfillment/orders/:id/timeline`, `GET /documents/:type/:id` (in-app print viewer) |

### Warehouse EAS

```bash
cd apps/warehouse
npx eas init   # once — links projectId into app.json extra.eas
npx eas build --platform android --profile preview
```

Set `EXPO_PUBLIC_API_BASE_URL` in `eas.json` (preview + production). Root route `app/index.tsx` redirects into role default tab after login. Run `npx expo-doctor` — should pass 21/21 (`.expo/` is gitignored, not committed).

### Warehouse smoke checklist

1. Login as warehouse staff
2. Dashboard stats load (picking / packing / ready dispatch buckets)
3. Manager: More → Assign & print labels → create batch → print stack
4. Picking: start session → barcode lookup → confirm pick → rack complete
5. Packing: shipping method → package override → confirm → mark packed
6. Label verify (batch orders) → print checklist → in-app document viewer
7. Dispatch: generate AWB, assign rack, confirm shipped scan
8. Manual LR update → Save & notify customer (WhatsApp via backend event)
9. Order timeline + authenticated print viewer

## Agronomist app — visits + farmer intelligence

**Visit model:** A **scheduled visit** is a `crm_tasks` reminder (`task_type = visit`). A **completed visit record** is a row in `crm_field_findings` (optionally linked to `agronomist_visit_sessions`). Farmer workspace **Field Findings** tab and block **Field findings** tab are read-only timelines derived from the same structured visit records — not manually duplicated entries. Submit via **Start visit** (structured multi-issue form at `/visit`). The global bottom **Visits** tab remains the agronomist daily queue; farmer workspace uses **Field Findings** for intelligence.

**Bottom tabs:** Dashboard · Farmers · Visits · Tasks · Profile

**Stack flows:** farmer workspace (Field Findings tab + 8 other tabs) · farm visit (check-in → structured issues → check-out) · visit detail · finding review · AI case review · route planner · map view

**Shared client:** `packages/shared/src/api/agronomist-client.ts`

**Contexts:** `AgronomistDashboardProvider`, `AgronomistQueueProvider` (prefetch dashboard + unified tasks)

### Agronomist API (mobile)

Base field: `/morbeez-staff/api/v1/os/field` · agronomist: `/morbeez-staff/api/v1/os/agronomist`

| Area | Endpoints |
|------|-----------|
| Dashboard | `GET /mobile/dashboard` |
| Farmers | `GET /mobile/farmers`, `GET /farmers/search`, `GET /farmers/:id/blocks` |
| Workspace | `GET /farmers/:id/workspace-summary`, **`GET /farmers/:id/workspace-dashboard`**, `GET /farmers/:id/documents`, `GET /farmers/:id/intelligence` |
| Farmer workspace tabs | **`GET /farmers/:id/visits`**, **`GET /farmers/:id/orders`**, **`GET /farmers/:id/whatsapp-history`**, **`POST /farmers/:id/calls`**, **`POST /farmers/:id/reminders`**, `GET|POST /farmers/:id/notes`, `GET /farmers/:id/follow-ups`, `GET|POST /farmers/:id/soil-reports`, `POST /farmers/:id/field-activities`, `GET /farmers/:id/call-log-summary`, `GET /farmers/:id/interactions` |
| Tasks | `GET /mobile/tasks`, `GET /callbacks`, `PATCH /callbacks/:id`, **`PATCH /operations/tasks/:id/complete`**, `GET /mobile/escalations` |
| Visits | `POST /visits/sessions`, `PATCH /visits/sessions/:id/check-out`, `POST /visits`, **`POST /visits/v2`**, **`GET /visits/:findingId`**, `GET /visits/recent`, **`POST /visits/context`**, **`POST /visits/analyze`**, **`GET|POST /visits/ai-case/:id/questions`**, **`POST /visits/ai-case/:id/reanalyze`**, **`POST /visits/ai-case/:id/recommend`**, **`GET /visits/similar-cases`**, **`GET /visits/case-library`** |
| Field masters | `GET /issue-master`, `GET /measurement-templates/:cropType`, `POST /issue-follow-up-questions` |
| Review | `GET /queue`, `GET /findings/:id`, `POST /drafts`, `GET /cases`, `POST /cases/:id/review` |
| Routes | `GET|POST /routes`, `POST /routes/:id/stops`, `POST /routes/:id/optimize` |
| Profile | `GET /mobile/profile`, `GET /workspace-intelligence` |

Apply migrations `20260704000000_field_findings_v2.sql`, **`20260705000000_advisory_reuse_field_origin.sql`**, **`20260715000000_visit_ai_foundation.sql`**, and **`20260716000000_visit_ai_perfection.sql`** for structured visits, field-origin reuse indexing, visit AI tables, and Q&A library columns. Set `ENABLE_STRUCTURED_FIELD_VISITS=true` on backend (default).

**Visit AI wizard (agronomist):** Overview → Photos (crop-specific types + optional voice-note transcript) → Measures → Issues → **AI Analysis** (image signal, confidence bands, similar cases with outcomes) → **Follow-up Q&A** (WhatsApp-grade questions; skip when ≥90% confidence) → **Recommendation draft** (custom review days 1–365) → **Agronomist Review** (escalation hints) → Summary & Submit. Recommendations are created as **draft** until the agronomist approves or modifies on the Review step; WhatsApp sends only after approve/correct actions. Training export JSON includes rich **`visitAiCases`** (photos paths, measurements, block assessment, outcomes).

**Visit AI telecaller / follow-up triggers (visit-origin recs use `metadata.visitOrigin: true`):**

| Trigger | Telecaller task | Escalation |
|--------|-----------------|------------|
| Approve + `escalate_urgent` review | Urgent visit escalation | High severity + low confidence |
| No application reply (reminders exhausted) | Recommendation follow-up required | — |
| Outcome: no improvement | Reassessment required | Via visit AI session when linked |
| Outcome: worsened | Urgent — crop worsened | Urgent via visit AI session when linked |
| Application: need help | Telecaller callback | — |

**Visit AI staging deploy:** apply migrations above on Supabase staging → set backend env → run `node backend/scripts/visit-ai-smoke.mjs` with `STAFF_TOKEN`, `FARMER_ID`, `BLOCK_ID` → agronomist mobile E2E: ginger visit with photos, disease issue, modify rec, confirm no WhatsApp until approve.

**Partner vs agronomist submit:** Partner visits always create **draft** recommendations for expert review. Agronomist visits use the same draft-first pattern through the in-visit Review gate (no auto-send on submit).

### Agronomist smoke checklist

1. Login as agronomist staff (mobile OTP or email + password)
2. Dashboard widgets load; tap stat → Tasks/Farmers filtered
3. Farmers: search, filter chips, open workspace
4. Workspace tabs: Overview (KPI cards deep-link to Field Findings for visit/issue metrics), Calls, Blocks, **Field Findings** (status filters + timeline → `/visit/[findingId]`), Recommendations, Orders, Follow-ups, Notes, Team. **Start visit** (header or Field Findings footer) opens `/visit` with block picker when multiple blocks exist.
5. Block detail: Add activity, Add soil test, Start visit (structured multi-issue form with inline recs + measurements)
6. Submit visit with 2+ issues → appears on farmer **Field Findings** tab and block Field findings; tap → visit detail (issues, photos, recs by issue, outcomes)
7. Tasks: unified list (visits, follow-ups, finding review, AI cases)
8. Finding review: AI suggest → draft → submit
9. Routes: create route → add stop → optimize → Open Maps
10. Map: nearby farmer pins
11. Profile stats + sign out
12. Follow-up automation: communicated rec → WhatsApp buttons → status visible in Follow-ups tab
13. Backfill (staging): `node scripts/backfill-field-findings-v2.mjs --dry-run`
14. Training export JSON includes `reuseCaseStats` split by `source_type` and **`visitAiCases`** with hypotheses, Q&A, and review actions
15. Visit AI: complete analyze → Q&A (or skip when high confidence) → rec draft with custom review days → approve on Review → farmer receives approved rec + optional visit summary WhatsApp
16. Automated: from `backend/`, run `node --import tsx --test tests/visit-ai-perfection.test.ts`; API smoke `node scripts/visit-ai-smoke.mjs` with env vars

### Agronomist EAS

```bash
cd apps/agronomist
cp .env.example .env
npx eas build --platform android --profile preview
```

## Telecaller app — CRM + call intelligence

**Bottom tabs:** Dashboard · Farmers · Follow-ups · Notifications · Profile

**Stack flows:** lead workspace (6 tabs) · call detail (read-only AI) · block workspace

**Shared client:** `packages/shared/src/api/telecaller-client.ts`

**Contexts:** `TelecallerDashboardProvider` (dashboard + offline call upload queue)

### Telecaller API (mobile)

Base: `/morbeez-staff/api/v1/os/telecaller`

| Area | Endpoints |
|------|-----------|
| Dashboard | `GET /mobile/dashboard` (overview, QC, action queue, today's tasks) |
| Farmers | `GET /mobile/leads/operational`, `GET /leads/queue-summary` |
| Workspace | `GET /mobile/leads/:id/workspace-summary`, `GET /leads/:id/farmer-profile`, `GET /leads/:id/intelligence`, `GET /leads/:id/blocks`, `GET /leads/:leadId/blocks/:blockId/workspace` |
| Interactions | `GET /leads/:id/timeline`, `GET /leads/:id/interactions`, `GET /calls/:callId`, `POST /exotel/click-to-call` |
| Follow-ups | `GET /mobile/follow-ups?grouped=true`, `PATCH /tasks/:id/complete`, `PATCH /tasks/:id` |
| Notifications | `GET /mobile/notifications` |
| Notes / tasks | `GET|POST /leads/:id/notes`, `POST /leads/:id/tasks` |

See [telecaller-mobile smoke checklist](./telecaller-mobile/README.md).

### Telecaller smoke checklist

1. Login as telecaller staff
2. Dashboard: today's work, revenue, action queue, today's tasks
3. Farmers: search + filter chips + FarmerCard quick actions
4. Workspace: Overview KPIs, Interactions timeline, Blocks drill-down, Recommendations, Orders, Notes
5. Call detail: read-only AI summary, transcript, QC, create follow-up from action items
6. Follow-ups: complete/snooze grouped tasks
7. Notifications inbox with tap-through
8. Profile: monthly revenue stats (no hidden admin performance scores)

### Telecaller EAS

```bash
cd apps/telecaller
cp .env.example .env
npx eas build --platform android --profile preview
```

## Farmer API (mobile)

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/v1/auth/otp/send`, `POST /api/v1/auth/otp/verify`, `POST /api/v1/auth/login` |
| ROI v1 | `GET …/roi/summary`, `GET …/roi/context`, `GET …/roi/categories`, `POST …/roi/categories`, `POST …/roi/harvest-sale`, `POST …/roi/income`, `POST …/roi/season/:id/finish`, `POST …/roi/season/start`, `GET …/roi/transactions`, `GET …/roi/expense-book`, `GET …/roi/analytics`, `PATCH|DELETE …/roi/transactions/:id`, `GET …/roi/history?v=2` |
| ROI legacy | `GET …/roi/season/active`, `POST …/expenses`, `POST …/labour`, `POST …/harvest` (deprecated wrappers) |
| Portal summary | `GET /api/v1/farmer/portal/summary` — `todayMarket`, `finance`, `tasks` |
| Market | `GET /api/v1/farmer/portal/market/crops`, `GET .../market/dashboard?crop=&market=`, `GET .../market/trends?crop=&market=&range=`, `GET .../market/mandi-comparison?crop=`, `GET .../market/crop-comparison?market=` |
| ROI dashboard | `GET /api/v1/farmer/portal/roi/summary` (preferred); `GET …/roi/dashboard` deprecated alias |
| Crop ops | `/api/v1/farmer/portal/blocks`, `PATCH …/blocks/:id`, `/scan`, `/scans`, `/activities`, `/recommendations` |
| Store | `GET /api/v1/store/products`, `GET /api/v1/store/banners`, `GET /api/v1/store/recommendations`, checkout `POST /api/v1/checkout/razorpay/*`, `POST /api/v1/checkout/cod/create` (JWT) |

Checkout line-item prices are validated server-side against Shopify variant prices. COD orders are tagged `mobile,cod` and synced to OMS.

## Staging smoke (20-screen walkthrough)

```bash
API_BASE_URL=… FARMER_EMAIL=… FARMER_PASSWORD=… node scripts/farmer-smoke.mjs
```

Manual checklist after deploy:

1. Login (OTP or email)
2. Home: crop/market selectors → hero card → trend chart → weather alert → quick actions
3. Change crop or market on Home → hero price, DAP context, and chart refresh
4. Market stack screen (legacy): crop + mandi selectors; Overview · Trends · Multi-crop compare · Mandi compare; trend detail screen
5. ROI tab: filters (multi-block), honest profit gating, harvest summary, add transaction, finish/start cycle
6. Fields from Home → field detail inline tabs → add to cart from reco
7. AI Scan from Home → result → recommendation / shop CTA
8. Shop: banners, recommended row, category filters, PDP buy-now → checkout
9. Profile menu → orders filter tabs → order timeline
10. Notifications grouped sections
11. Language switch (en / hi / ml)
12. OTP login → force-quit app → reopen → still logged in (session persists)

### Farmer ROI v1 smoke checklist

1. Single block farmer: no crop/block filters, no Expense Book tab
2. Multi-block farmer: crop and block filters appear; Expense Book tab visible
3. Add expense with smart defaults; change crop → block dropdown updates
4. Three harvest sales → totals correct → season still active
5. Finish crop cycle → COMPLETE confirm (+ password if set) → success modal → appears in History
6. Analytics donut chart shows category segments with center total
7. Field detail ROI tab scoped to that block (not primary block only)
8. Tap transaction → edit amount/date; All | Expense | Income ledger filters
9. History screen: Active Cycles | Completed Cycles tabs; completed cards show ROI %
10. Legacy `/roi/quick-expense` routes redirect to add-expense form

## Production env matrix (backend)

| Variable | Purpose |
|----------|---------|
| `ENABLE_AI_CROP_DOCTOR=true` | AI scan live |
| `ENABLE_RAZORPAY_CHECKOUT=true` | Online checkout |
| `FARMER_SCAN_DAILY_QUOTA` | Per-farmer daily scan cap (default 20) |
| `UPLOAD_BODY_LIMIT_BYTES` | Scan/photo route body limit (default 10MB) |
| `AUTH_RATE_LIMIT_MAX` | Stricter auth route rate limit |

Apply migration `20260688000000_farmer_otp_mobile_source.sql` for OTP table + `mobile` activity source.

## Release runbook (EAS)

1. Run staging smoke (above)
2. Backend deploy: env vars above, run Supabase migrations, verify `GET /health`
3. `cd apps/farmer && npx eas build --platform android --profile production`
4. Staged rollout in Play Console; monitor backend 5xx on `/scan` and `/checkout`

## Tests

- Backend: `cd backend && npm test`
- Farmer app: `cd apps/farmer && npm test && npm run typecheck`
- Warehouse app: `cd apps/warehouse && npm test && npm run typecheck`
- Agronomist app: `cd apps/agronomist && npm run typecheck`
- Telecaller app: `cd apps/telecaller && npm run typecheck`
- Partner app: `cd apps/partner && npm run typecheck`
- Partner ecosystem backend: `cd backend && node --import tsx --test tests/partner-communication.test.ts tests/sales-opportunity.test.ts tests/commission-engine.test.ts`

## Feature parity (vs web)

| Surface | Mobile → web (staff `/agronomist`, `/telecaller`) | Web-only (unchanged) |
|---------|-----------------------------------------------------|----------------------|
| **Visit AI 9-step wizard** | `/agronomist/visit` — shared `@morbeez/shared/visit-wizard` validation | — |
| **Visit detail** | `/agronomist/visits/:findingId` | AI review hub case library links here |
| **Farmer workspace (agronomist)** | `/agronomist` Farmers tab → 9 tabs (overview, calls, blocks, findings, recs, follow-ups, notes, team, orders) | — |
| **Route planner + map** | `/agronomist/routes`, `/agronomist/map` | — |
| **Telecaller follow-ups hub** | `/telecaller` Follow-ups tab (`listFollowUpSections`) | — |
| **Sales opportunities inbox** | Telecaller workspace panel | — |
| **Application tracking on blocks** | Blocks tab overview (agronomist farmer workspace) | — |
| **AI review / QC / bulk CRM** | — | `/agronomist/ai-review`, telecaller Call QC, operations broadcasts |
| **Warehouse / partner / farmer portal** | Out of scope for this parity pass | `/warehouse`, `/partners`, Shopify farmer portal |

Staff web reuses `@morbeez/shared` `agronomistClient` / `telecallerClient` with token bridge (`frontend/src/lib/staff-shared-bridge.ts`).

### Staff web E2E checklist (staging)

1. Log in as agronomist → `/agronomist` dashboard loads via shared client.
2. Farmers tab → open farmer workspace → **Start visit** → complete Visit AI wizard (draft-first through review).
3. Case library / visit detail → `/agronomist/visits/:findingId` renders submitted visit.
4. Route planner → create route, optimize, open in Google Maps.
5. Farmer map → nearby assigned farmers list with map links.
6. Log in as telecaller → **Follow-ups** tab → sections load; complete and snooze 1d work.
7. Telecaller workspace → sales opportunities panel loads and status update works.
8. Regression: `/agronomist/ai-review` image/outcome/export queues unchanged.
9. Backend smoke after deploy: `node backend/scripts/visit-ai-smoke.mjs`

| App | Status | Notes |
|-----|--------|-------|
| **Farmer** | Mockup-aligned | OTP login, market/ROI tabs, charts, shop polish, i18n en/hi/ml, offline cache |
| **Warehouse** | Production parity | Tabs, pick/pack/dispatch/LR, in-app print, label verify, batch assign, WhatsApp LR notify |
| **Agronomist** | Visit + review + web parity | OTP login, dashboard, farmer workspace, visits, unified tasks, route planner; **web field ops on `/agronomist`** |
| **Telecaller** | Production CRM + web parity | Farmers tab, lead workspace, call intelligence, follow-ups, notifications, sales opp inbox; **web Follow-ups tab on `/telecaller`** |
| **Partner** | Production shell | Dashboard, farmers workspace (7 tabs), visits (GPS), tasks, notifications, lead offers, earnings |

## Partner app

**Bottom tabs:** Dashboard · Farmers · Tasks · Visits · Notifications · Profile

**Farmer workspace tabs:** Overview · Blocks · Visit history · Recommendations · Sales opportunities · Team · Notes

**Key flows:**

- GPS check-in at field (`expo-location`) → structured visit submit → **draft recommendations** for agronomist review (same review gate as staff agronomist app — partner parity planned)
- Partner creates sales opportunity → telecaller dashboard inbox + status updates
- Internal team timeline shared with telecaller and expert apps
- Referral QR on `app/referral.tsx` for event enrollment attribution

See [`docs/partner-ecosystem/COMMUNICATION.md`](../partner-ecosystem/COMMUNICATION.md).

## Warehouse RBAC

Apply migration `20260687000000_warehouse_mobile_rbac.sql` for pick/pack staff roles.

## Web console

Staff continue to use the web admin at `/admin` for CRM, agronomy, and OMS workflows not mirrored on mobile.
