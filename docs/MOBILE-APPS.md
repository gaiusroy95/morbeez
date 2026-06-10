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

## Farmer app — production structure

**Bottom tabs:** Home · Fields · AI Scan · Shop · Profile

**Stack screens:** field add/edit, field details + timeline, AI scan result + history, recommendations, activities, orders, soil reports, ROI (+ add entry), weather/market, notifications, native shop (catalog → cart → Razorpay/COD checkout).

## Farmer API (mobile)

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/v1/auth/otp/send`, `POST /api/v1/auth/otp/verify`, `POST /api/v1/auth/login` |
| Portal | `/api/v1/farmer/portal/blocks`, `PATCH …/blocks/:id`, `/scan`, `/scans`, `/activities`, `/roi/entries` |
| Store | `GET /api/v1/store/products`, checkout `POST /api/v1/checkout/razorpay/*`, `POST /api/v1/checkout/cod/create` (JWT) |

Checkout line-item prices are validated server-side against Shopify variant prices. COD orders are tagged `mobile,cod` and synced to OMS.

## Production env matrix (backend)

| Variable | Purpose |
|----------|---------|
| `ENABLE_AI_CROP_DOCTOR=true` | AI scan tab live |
| `ENABLE_RAZORPAY_CHECKOUT=true` | Online checkout |
| `FARMER_SCAN_DAILY_QUOTA` | Per-farmer daily scan cap (default 20) |
| `UPLOAD_BODY_LIMIT_BYTES` | Scan/photo route body limit (default 10MB) |
| `AUTH_RATE_LIMIT_MAX` | Stricter auth route rate limit |

Apply migration `20260688000000_farmer_otp_mobile_source.sql` for OTP table + `mobile` activity source.

## Release runbook (EAS)

1. Run staging smoke: `API_BASE_URL=… FARMER_EMAIL=… FARMER_PASSWORD=… node scripts/farmer-smoke.mjs`
2. Backend deploy: env vars above, run Supabase migrations, verify `GET /health` shows `features.aiCropDoctor` and `connectivity.shopify`
3. `cd apps/farmer && npx eas build --platform android --profile production`
4. Staged rollout in Play Console; monitor backend 5xx on `/scan` and `/checkout`

## Tests

- Backend: `cd backend && npm test` (includes `tests/farmer-portal/production-readiness.test.ts`)
- Farmer app: `cd apps/farmer && npm test`

## Feature parity (vs web)

| App | Status | Notes |
|-----|--------|-------|
| **Farmer** | Production-ready MVP | OTP login, COD + Razorpay, server-validated checkout, i18n en/hi/ml, offline cache, field CRUD |
| **Telecaller** | Partial CRM | Lead workspace tabs vs full web panel. |
| **Warehouse** | Fulfillment core | Queue, barcode, pick confirm. |
| **Field** | Visit + review | Agronomist finding queue. |

## Warehouse RBAC

Apply migration `20260687000000_warehouse_mobile_rbac.sql` for pick/pack staff roles.

## Web console

Staff SPA in `frontend/`. Mobile apps call `/morbeez-staff/api/v1` or farmer `/api/v1`.
