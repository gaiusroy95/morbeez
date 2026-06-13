# Morbeez Partner Program

## Overview

External partners enroll farmers, run field visits, and assist customer experience while Morbeez retains CRM, AI, pricing, and operations.

## Architecture

- **Database:** `supabase/migrations/20260706000000_partner_program_foundation.sql`
- **Admin API:** `/morbeez-staff/api/v1/partners/*`
- **Partner mobile API:** `/morbeez-partner/api/v1/*`
- **Public enrollment:** `POST /api/v1/enroll/partner`, `GET /api/v1/enroll/partner/:code`
- **Admin UI:** Staff console → `/partners`
- **Mobile app:** `apps/partner` (`npm run dev:partner`)

## Ownership model

| Field | Mutable | Purpose |
|-------|---------|---------|
| `enrollment_owner_type` | No | Who brought the farmer in |
| `customer_owner_type` | Yes | Current accountable owner |
| `service_model` | Yes | `remote_advisory` or `partner_assisted` |

## Rollout checklist

1. Apply migration `20260706000000_partner_program_foundation.sql`
2. Run `node scripts/backfill-farmer-ownership.mjs`
3. Set `ENABLE_PARTNER_PROGRAM=true` (default on)
4. Approve partner applications in admin hub
5. Activate partners (`verified` → `training` → `certified` → `active`)
6. Distribute partner mobile app + referral QR

## Smoke tests

- Partner OTP login → dashboard loads
- QR enrollment creates farmer with partner enrollment owner
- Partner field visit → finding with `submitted_by_role=partner`, recs `pending_expert_review`
- Telecaller CRM bundle includes `ownership`
- Lead allocation offers appear for active partners

## Feature flags

- `ENABLE_PARTNER_PROGRAM` — master switch
- `ENABLE_PARTNER_LEAD_ALLOCATION` — merit-based lead offers
- `ENABLE_SALES_OPPORTUNITIES` — partner → telecaller interest handoffs
- `ENABLE_PARTNER_COMMISSION` — order-paid commission ledger
- `ENABLE_UNIFIED_TEAM_TIMELINE` — cross-role farmer team feed

## Ecosystem extensions

Apply migration `20260707000000_partner_ecosystem.sql` for:

- `sales_opportunities`, `commission_master`, `partner_earnings_ledger`
- `partner_events`, `partner_territory_pincodes`
- `partner_training_modules`, certification tables

**Admin hub tabs:** Commission master, Events, 7-stage onboarding, Control tower (farmer team view + fraud signals)

**Docs:** [`docs/partner-ecosystem/COMMUNICATION.md`](../partner-ecosystem/COMMUNICATION.md)
