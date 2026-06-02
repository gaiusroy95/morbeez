# Phase 5 — Dashboards & CRM integration

Console dashboards and telecaller CRM surfaces for the full pipeline:

**Events → Attribution → Engines → Scores → Dashboards**

## Backend

| File | Role |
|------|------|
| `opportunity-intelligence-dashboard.service.ts` | Overview KPIs, district heatmap, top/at-risk farmers, employee leaderboard, farmer profile |
| `os-intelligence.routes.ts` | `GET /os/intelligence/opportunity-dashboard/*` |
| `os-telecaller.routes.ts` | `GET /os/telecaller/leads/:id/intelligence` (CRM read via `telecaller_crm`) |

### Dashboard APIs (`intelligence` read)

| Method | Path | Description |
|--------|------|-------------|
| GET | `.../opportunity-dashboard/overview?days=30` | KPIs, retention bands, score distribution + event volume |
| GET | `.../opportunity-dashboard/districts` | District opportunity heatmap |
| GET | `.../opportunity-dashboard/farmers/top` | Top farmers by score |
| GET | `.../opportunity-dashboard/farmers/at-risk` | At-risk / churned retention rows |
| GET | `.../opportunity-dashboard/farmers/:farmerId` | Full farmer intelligence profile |
| GET | `.../opportunity-dashboard/employees` | Performance leaderboard (≥10 attributed farmers) |

Recalculate (same as Phase 3/4):

`POST /os/intelligence/opportunity-scores/recalculate` with `{ "limit": 500, "includeEmployees": true }` (`intelligence` write).

## Console UI

| Route | Page |
|-------|------|
| `/morbeez-staff/opportunity` | `OpportunityDashboardPage` — tabs: Overview, Districts, Top farmers, At risk, Employees |

Nav: **Intelligence → Opportunity**

## Telecaller CRM

`FarmerIntelligencePanel` on lead profile loads `GET .../telecaller/leads/:leadId/intelligence` and shows:

- Opportunity score (engine or lead-score estimate fallback)
- Retention band + score
- Component breakdown when scored

## Ops checklist

1. Apply migration `20260637000000_opportunity_intelligence_phase0.sql`
2. Run backfill / event capture (Phase 1) in production
3. First score batch: recalculate from Opportunity page or API
4. Enable `ENABLE_OPPORTUNITY_SCORE_WORKER=true` for nightly IST runs

## Next

[Phase 6 — Refinement & alerts](./PHASE6-REFINEMENT.md): daily alerts, CRM task enqueue, weight calibration, relationship/retention leaderboards.

## Related docs

- [Phase 0](./PHASE0-ATTRIBUTION-RULES.md) — schema & attribution rules
- [Phase 3](./PHASE3-OPPORTUNITY-SCORES.md) — farmer opportunity engine
- [Phase 4](./PHASE4-EMPLOYEE-PERFORMANCE.md) — employee performance engine
