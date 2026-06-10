# Morbeez mobile apps

Four focused Expo apps replace the old single `mobile/` staff console mirror.

## Apps

| App | Folder | Command | Auth |
|-----|--------|---------|------|
| **Farmer** (client) | `apps/farmer` | `npm run dev:farmer` | Farmer JWT (email or OTP) |
| **Telecaller** | `apps/telecaller` | `npm run dev:telecaller` | Staff JWT + `telecaller_crm` |
| **Pick & Pack** | `apps/warehouse` | `npm run dev:warehouse` | Staff JWT + `warehouse` write |
| **Field Pro** | `apps/field` | `npm run dev:field` | Staff JWT + `agronomist` |

Shared code: `packages/shared`, `packages/ui-native`.

## Setup

```bash
npm install
cd backend && npm run dev
cp apps/farmer/.env.example apps/farmer/.env
npm run dev:farmer
```

Set `EXPO_PUBLIC_API_BASE_URL` in each app's `.env`.

## Farmer app — mockup-aligned structure

**Bottom tabs:** Home · Market · ROI · Shop · Profile

**Home dashboard:** today's market rate, financial summary, tasks, weather alerts, quick actions (scan, expense, activity, fields, recommendations).

**Stack screens:** fields list, field add/edit, field details, **ROI quick expense (icon grid + amount pad)**, labour entry, harvest close, crop history, AI scan + result + history, market trend charts, recommendations, activities, orders, notifications, shop checkout.

**ROI daily flow:** Open ROI tab → see DAP, Spent, Expected, Profit for active crop season → tap **Add expense** → pick dynamic type tile → enter amount → saved to season ledger. Harvest closes season into crop history.

Fields and AI Scan are reachable from Home quick actions (not tab bar items).

## Farmer API (mobile)

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/v1/auth/otp/send`, `POST /api/v1/auth/otp/verify`, `POST /api/v1/auth/login` |
| ROI season | `GET /api/v1/farmer/portal/roi/season/active`, `GET …/expense-types`, `GET …/labour-types`, `POST …/expenses`, `POST …/labour`, `POST …/harvest`, `GET …/history`, `POST …/purchase-order` |
| Portal summary | `GET /api/v1/farmer/portal/summary` — `todayMarket`, `finance`, `tasks` |
| Market | `GET /api/v1/farmer/portal/market/crops`, `GET .../market/dashboard?crop=&market=`, `GET .../market/trends?crop=&market=&range=`, `GET .../market/mandi-comparison?crop=`, `GET .../market/crop-comparison?market=` |
| ROI | `GET /api/v1/farmer/portal/roi/dashboard` — `breakdown`, `seasonLabel`; `POST …/roi/entries` |
| Crop ops | `/api/v1/farmer/portal/blocks`, `PATCH …/blocks/:id`, `/scan`, `/scans`, `/activities`, `/recommendations` |
| Store | `GET /api/v1/store/products`, `GET /api/v1/store/banners`, `GET /api/v1/store/recommendations`, checkout `POST /api/v1/checkout/razorpay/*`, `POST /api/v1/checkout/cod/create` (JWT) |

Checkout line-item prices are validated server-side against Shopify variant prices. COD orders are tagged `mobile,cod` and synced to OMS.

## Staging smoke (20-screen walkthrough)

```bash
API_BASE_URL=… FARMER_EMAIL=… FARMER_PASSWORD=… node scripts/farmer-smoke.mjs
```

Manual checklist after deploy:

1. Login (OTP or email)
2. Home cards: market rate, finance strip, tasks, weather
3. Market tab: crop + mandi selectors; Overview · Trends (YoY overlay) · Multi-crop compare · Mandi compare; trend detail screen
4. ROI tab: hero profit, donut breakdown, add expense
5. Fields from Home → field detail inline tabs → add to cart from reco
6. AI Scan from Home → result → recommendation / shop CTA
7. Shop: banners, recommended row, category filters, PDP buy-now → checkout
8. Profile menu → orders filter tabs → order timeline
9. Notifications grouped sections
10. Language switch (en / hi / ml)

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

## Feature parity (vs web)

| App | Status | Notes |
|-----|--------|-------|
| **Farmer** | Mockup-aligned | OTP login, market/ROI tabs, charts, shop polish, i18n en/hi/ml, offline cache |
| **Telecaller** | Partial CRM | Lead workspace tabs vs full web panel. |
| **Warehouse** | Fulfillment core | Queue, barcode, pick confirm. |
| **Field** | Visit + review | Agronomist finding queue. |

## Warehouse RBAC

Apply migration `20260687000000_warehouse_mobile_rbac.sql` for pick/pack staff roles.

## Web console

Staff continue to use the web admin at `/admin` for CRM, agronomy, and OMS workflows not mirrored on mobile.
