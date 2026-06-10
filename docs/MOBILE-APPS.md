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
# From repo root — install all workspaces
npm install

# API (required)
cd backend && npm run dev

# Copy env per app (use your LAN IP for physical devices)
cp apps/farmer/.env.example apps/farmer/.env
cp apps/telecaller/.env.example apps/telecaller/.env
# ...

# Start an app
npm run dev:farmer
```

Set `EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:3000` in each app's `.env`.

Farmer app also supports `EXPO_PUBLIC_SHOP_URL` for the Shop WebView tab.

## Warehouse RBAC

Apply migration `20260687000000_warehouse_mobile_rbac.sql` and assign role `warehouse` or `picker_packer` to pick/pack staff.

## Web console

The production staff SPA remains in `frontend/` (Vercel). Mobile apps call the same API at `/morbeez-staff/api/v1`.

## Feature parity (vs web)

| App | Status | Notes |
|-----|--------|-------|
| **Farmer** | Core portal parity | Home, orders, tracking, reviews, address, advisory, reports, support, field photo upload, WhatsApp CTAs. Shop tab hidden (web uses external Shopify). Native Crop Doctor not ported. |
| **Telecaller** | High parity | 12-tab lead detail, workspace KPIs, escalations toggle, call log, notes, WhatsApp, tasks. Bulk actions, new-lead modal, and deep CRM modals remain web-only. |
| **Warehouse** | Core fulfillment parity | Stats, queue filters, sync/repair, barcode lookup + confirm-pick, rack progress, label verify, mark packed, AWB, exceptions. Batch assign panel and print URLs are web-only. |
| **Field Pro** | Core parity | Full visit form (questionnaire, GPS, photos, disease/severity), agronomist queue with AI suggest → draft → submit. Case review / image review tabs remain web-only. |
