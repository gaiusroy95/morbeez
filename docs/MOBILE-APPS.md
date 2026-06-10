# Morbeez mobile apps

Four focused Expo apps replace the old single `mobile/` staff console mirror.

## Apps

| App | Folder | Command | Auth |
|-----|--------|---------|------|
| **Farmer** (client) | `apps/farmer` | `npm run dev:farmer` | Farmer JWT |
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

## Farmer app — MVP structure

**Bottom tabs:** Home · Fields · AI Scan · Shop · Profile

**Stack screens:** field details, AI scan result, recommendations, activities, orders, soil reports, ROI, weather/market, notifications, shop catalog/checkout.

**Backend:** `/api/v1/farmer/portal/blocks`, `/scan`, `/recommendations`, `/activities`, `/roi/entries`, `/weather`, `/market-prices`, plus existing store + Razorpay checkout.

## Feature parity (vs web)

| App | Status | Notes |
|-----|--------|-------|
| **Farmer** | MVP rebuild | AI-first crop ops + native shop. OTP login UI ready (backend OTP v1.1). COD checkout UI placeholder. |
| **Telecaller** | Partial CRM | Lead workspace tabs vs full web panel. |
| **Warehouse** | Fulfillment core | Queue, barcode, pick confirm. |
| **Field** | Visit + review | Agronomist finding queue. |

## Warehouse RBAC

Apply migration `20260687000000_warehouse_mobile_rbac.sql` for pick/pack staff roles.

## Web console

Staff SPA in `frontend/`. Mobile apps call `/morbeez-staff/api/v1` or farmer `/api/v1`.
