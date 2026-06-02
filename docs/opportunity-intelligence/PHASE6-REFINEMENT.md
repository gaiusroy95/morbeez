# Phase 6 — Refinement, alerts & specialized leaderboards

Turns scores into **operational actions**: retention alerts, CRM task enqueue, calibrated weights, and brief §13 specialty leaderboards.

## Database

Migration: `supabase/migrations/20260638000000_opportunity_intelligence_phase6.sql`

| Table | Purpose |
|-------|---------|
| `opportunity_intelligence_config` | Singleton weight overrides + alert thresholds |
| `opportunity_intelligence_alerts` | Daily idempotent alerts (farmer + employee cohort) |

## Alert types

| Type | Trigger |
|------|---------|
| `farmer_at_risk` | `farmer_retention_tracking.risk_band = at_risk` |
| `farmer_churned` | `risk_band = churned` |
| `high_opportunity_idle` | Score ≥ threshold, no events 14d |
| `employee_at_risk_cohort` | ≥35% of attributed farmers at risk/churned |

Nightly worker (after score batch, IST 02:00–04:59):

1. `generateDailyAlerts()`
2. `enqueueRetentionTasks()` when `autoCreateCrmTasks` is true

## APIs

| Method | Path |
|--------|------|
| GET/PATCH | `/os/intelligence/opportunity-config` |
| GET | `/os/intelligence/opportunity-alerts` |
| POST | `/os/intelligence/opportunity-alerts/generate` |
| POST | `/os/intelligence/opportunity-alerts/enqueue-tasks` |
| POST | `/os/intelligence/opportunity-alerts/:id/acknowledge` |
| POST | `/os/intelligence/opportunity-alerts/:id/dismiss` |
| GET | `/os/intelligence/performance-scores/employees/top-relationship-builders` |
| GET | `/os/intelligence/performance-scores/employees/high-retention` |
| GET | `/os/intelligence/opportunity-scores/farmers/:farmerId/trend` |
| GET | `/os/intelligence/performance-scores/employees/:id/trend` |

## Weight calibration

PATCH `opportunity-config` with partial `farmerWeightOverrides` / `employeeWeightOverrides`. Next **recalculate** applies rescaling via `applyFarmerWeightOverrides` / `applyEmployeeWeightOverrides` (component points scaled to new caps; totals still capped at 100).

## Console UI

**Intelligence → Opportunity** — new tabs:

- **Alerts** — open alerts, acknowledge
- **Relationship** — top relationship builders
- **Retention** — high retention quality employees
- Actions: **Run alerts + CRM tasks**, **Recalculate scores**

## CRM integration

`createTelecallerTask` boosts priority when `farmer_retention_tracking` is `at_risk` or `churned` (before legacy health score).

## Fairness (from original plan)

- Specialty leaderboards still require **≥10** attributed farmers.
- Employee cohort alerts only for profiles meeting that sample size.

## Related

- [Phase 5 — Dashboards](./PHASE5-DASHBOARDS.md)
- [Phase 0 — Attribution rules](./PHASE0-ATTRIBUTION-RULES.md)
