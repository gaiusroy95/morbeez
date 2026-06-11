# WMS + OMS (Warehouse & Order Management)

Backend module for **Shopify storefront orders** + **Morbeez warehouse stock** (batch, rack, pick/pack, GST invoices, COD, NDR/RTO).

## Architecture

```
Shopify order webhook
  → commerce_orders + commerce_order_lines
  → reserve stock (FEFO batches)
  → pick list (rack + batch per line)
  → pack verify (barcode or manual tick)
  → tax invoice (CGST/SGST or IGST)
  → Shiprocket AWB (after pack)
  → tracking webhooks → NDR/RTO exceptions
  → COD reconciliation
```

**API base:** `/morbeez-staff/api/v1/os/warehouse`  
**RBAC module:** `warehouse` (read/write per role)

## Setup

1. Apply migration:
   ```bash
   supabase db push
   ```
2. Set env on Render (`backend/.env.example`):
   - `COMPANY_GSTIN`, `COMPANY_STATE` (for CGST/SGST vs IGST)
   - `ENABLE_SHIPROCKET_AFTER_PACK=true` (ship only after pack)
   - `ENABLE_OMS_AUTO_CONFIRM=true` (auto reserve + pick on order)
3. Seed stock via **Purchase Order → Goods Receipt** (creates batches + rack locations).

## Key endpoints

| Area | Method | Path |
|------|--------|------|
| Overview | GET | `/overview` |
| Live stock | GET | `/stock` |
| Locations | POST | `/locations` |
| Purchase order | POST | `/purchase-orders` |
| Goods received | POST | `/goods-receipts` |
| OMS orders | GET | `/orders?omsStatus=picking` |
| Confirm order | POST | `/orders/:id/confirm` |
| Pick lists | GET | `/pick-lists` |
| Manual verify line | POST | `/pick-lists/:id/lines/:lineId/verify` |
| Barcode scan | POST | `/pack-sessions/:id/scan` |
| Complete pack | POST | `/pick-lists/:id/complete-pack` |
| Tax invoice | POST | `/orders/:id/invoice` |
| Quotation | POST | `/quotations` |
| NDR/RTO | GET | `/exceptions` |
| COD pending | GET | `/cod/pending` |
| Finance | GET | `/finance/dashboard` |

## Mobile Pick & Pack (`apps/warehouse`)

| Screen | API |
|--------|-----|
| Dashboard | `GET /fulfillment/stats` (picking, packing, readyDispatch, awaitingTracking buckets) |
| Picking queue | `GET /fulfillment/queue` |
| Rack pick | `POST /fulfillment/orders/:id/pack-session`, pack-session lookup/confirm |
| Packing | `POST …/package/*`, `POST …/mark-packed`, `POST …/verify-label`, `POST …/rebuild-pick-list` |
| Print docs | `GET /documents/:type/:id` (in-app HTML viewer), `POST …/mark-label-printed` |
| Label batches (manager) | `GET/POST /fulfillment/employees`, `assignable-orders`, `assign-batch`, `label-batches/*` |
| Dispatch | `POST …/generate-awb`, `POST …/dispatch-rack`, dispatch-session scan, `confirm-dispatch` |
| LR update | `POST …/manual-logistics` (`notifyCustomer: true` → WhatsApp via `shipment.dispatched`) |
| Timeline | `GET /fulfillment/orders/:id/timeline` |

## GST logic

- **Same state** (customer state = `COMPANY_STATE`): CGST 50% + SGST 50% of GST amount
- **Other state**: IGST 100%

## Workflow status (`commerce_orders.oms_status`)

`pending` → `confirmed` → `picking` → `packed` → `shipped` → `delivered` → `completed`

## Shopify integration

- Orders still originate in **Shopify** (or Razorpay checkout → Shopify).
- Morbeez backend is **source of truth for warehouse stock** (batches, reserved, damaged, returned).
- Shopify `inventory_quantity` can stay in sync separately via existing product wizard; WMS batches are authoritative for fulfillment.

## Not yet in UI

Mobile covers floor pick/pack/dispatch/LR; web admin remains source for packaging rules admin, batch label print, returns inspection, and finance dashboards.
