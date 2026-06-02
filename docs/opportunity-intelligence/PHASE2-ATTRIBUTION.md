# Phase 2 — Employee–farmer attribution

Multi-touch rows in `employee_farmer_attribution`, driven by Phase 1 farmer events and CRM/agronomist flows. All writes are **fire-and-forget** via `employeeAttributionCaptureService`.

## Module

- `employee-attribution-capture.service.ts` — safe upserts + event reactions
- `employee-attribution.service.ts` — `upsertTouch`, `listEligibleForConversion` (180d window)

## When attributions are created

| Trigger | Attribution type | Role |
|---------|------------------|------|
| Lead create / reassign (`trackLeadAssignment`) | `telecaller_assigned` | telecaller |
| Farmer WhatsApp reply (`MESSAGE_REPLY`) | `first_engagement`, `relationship_owner` (+ inferred assign if missing) | telecaller |
| Recommendation approved | `advisory` | agronomist |
| Case review submitted for approval | `advisory` | agronomist |
| Field finding logged | `advisory` | agronomist |
| Order paid (`ORDER_CONVERTED`) | `conversion_assist` per eligible employee | prior role |
| Farmer reactivated (30d+ gap) | `reactivation` | telecaller / last touch |

## Conversion credit (180 days)

On `ORDER_CONVERTED`, every **active** attribution for that farmer with `last_touch_at` within **180 days** (except existing `conversion_assist` rows) receives a `conversion_assist` upsert — one row per employee. Metadata stores `shopifyOrderId` and the source attribution type.

## Debug APIs

- `GET /morbeez-staff/api/v1/farmers/:id/attributions?activeOnly=true`
- `GET /morbeez-staff/api/v1/farmers/:id/events` (Phase 1)

Requires `intelligence` read access.

## Employee resolution

Staff email or `admin_users` → `employee_profiles.id` via `employeeProfileResolveService`. Role on the row comes from `employee_profiles.role` (defaults to `telecaller` when unknown).

## Phase 3

See [PHASE3-OPPORTUNITY-SCORES.md](./PHASE3-OPPORTUNITY-SCORES.md).

## Next (Phase 4)

Employee performance engine → `employee_scores`.
