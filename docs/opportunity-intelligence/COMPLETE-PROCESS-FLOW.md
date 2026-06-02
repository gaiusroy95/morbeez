# Dynamic Farmer + Employee Intelligence — Complete Process Flow

This document maps the business process (Steps 1–15) to the Morbeez implementation. The system is delivered in **phases 0–6**; use this as the single map for onboarding and gap analysis.

## End-to-end flow

```
Farmer interaction
  → System event (farmer_events)
  → Employee attribution (employee_farmer_attribution)
  → Metric engines (engagement, trust, relationship, retention, acre potential)
  → Farmer opportunity score (farmer_scores, 0–100)
  → Employee performance (employee_scores)
  → Dashboards + CRM intelligence panel
  → Business actions (alerts, CRM tasks, prioritization)
  → Continuous learning (recommendation outcomes, nightly recalc)
```

## Step-by-step mapping

| Step | Business intent | Implementation |
|------|-----------------|----------------|
| 1 | Farmer enters system | `farmer.service`, `lead.service`, WhatsApp onboarding |
| 2 | Employee assignment | `leads.assigned_to`, `employeeAttributionCaptureService.trackTelecallerAssigned` |
| 3 | Farmer interaction | WhatsApp pipeline, CRM, ROI, agronomist workflows |
| 4 | System events | `farmer_events` via `farmerEventCaptureService` — see [PHASE1](./PHASE1-EVENT-CAPTURE.md) |
| 5 | Engagement engine | `scoreEngagement()` in `farmer-opportunity-scoring.util.ts` |
| 6 | Trust engine | `scoreTrust()` |
| 7 | Relationship engine | `scoreRelationship()` + attribution touches |
| 8 | Retention engine | `computeRetentionRisk()` → `farmer_retention_tracking` |
| 9 | Acre potential | `scoreAcrePotential()` + `scoreAcreSize()` |
| 10 | Opportunity score | `farmerOpportunityEngineService.scoreFarmer()` — [PHASE3](./PHASE3-OPPORTUNITY-SCORES.md) |
| 11 | Employee performance | `employeePerformanceEngineService` — [PHASE4](./PHASE4-EMPLOYEE-PERFORMANCE.md) |
| 12 | Delayed conversion | `scoreDelayedConversion()` on employee rollup (30–180d orders vs attribution) |
| 13 | Dashboards | Opportunity dashboard + telecaller `FarmerIntelligencePanel` — [PHASE5](./PHASE5-DASHBOARDS.md) |
| 14 | Business actions | Alerts + CRM task enqueue — [PHASE6](./PHASE6-REFINEMENT.md) |
| 15 | Learning loop | Nightly worker + `intelligencePipelineService` (debounced recalc on key events) + `learningLoopService` for advisory outcomes |

## Database tables (required)

| Table | Status |
|-------|--------|
| `farmer_events` | Phase 0 migration `20260637000000` |
| `farmer_scores` | Phase 0 |
| `employee_scores` | Phase 0 |
| `employee_farmer_attribution` | Phase 0 |
| `farmer_score_history` | Phase 0 |
| `farmer_metric_history` | Phase 3 (engagement/trust/relationship/retention snapshots) |
| `farmer_retention_tracking` | Phase 3 |
| `recommendation_history` | Phase 0 |
| `engagement_history` | Represented via `farmer_metric_history` + events |
| `trust_history` | Same |
| `retention_tracking` | `farmer_retention_tracking` |

## Event types (canonical)

Defined in `backend/src/services/intelligence/farmer-event.types.ts`. Captured from WhatsApp, CRM, agronomist, ROI, Shopify, and field workflows.

## APIs (staff)

| Purpose | Path |
|---------|------|
| Farmer score | `GET /os/farmers/:id/opportunity-score` |
| Farmer intelligence profile | `GET /os/telecaller/leads/:id/intelligence` |
| Telecaller workspace intelligence | `GET /os/telecaller/workspace-intelligence` |
| Agronomist workspace intelligence | `GET /os/agronomist/workspace-intelligence` |
| Metric history (engagement/trust/…) | `GET /os/intelligence/opportunity-scores/farmers/:id/metric-history` |
| Recalculate batch | `POST /os/intelligence/opportunity-scores/recalculate` |
| Dashboard | `GET /os/intelligence/opportunity-dashboard/*` |
| Alerts + nurture | `POST .../opportunity-alerts/enqueue-tasks`, `enqueue-nurture` |

## Operations checklist

1. Apply migrations `20260637000000`, `20260638000000`, `20260639000000`.
2. Set `ENABLE_OPPORTUNITY_SCORE_WORKER=true` and `ENABLE_OPPORTUNITY_NURTURE_WHATSAPP=true` (see `.env.example`).
3. Run backfill if needed: `npx tsx scripts/backfill-farmer-events.ts`
4. **Recalculate scores** with `{ "runBusinessActions": true }` or use **Run alerts + CRM tasks** on Opportunity page.
5. **Telecaller CRM** and **Agronomist hub** show intelligence bars after scores exist.

## Phase index

- [PHASE0 — Attribution rules](./PHASE0-ATTRIBUTION-RULES.md)
- [PHASE1 — Event capture](./PHASE1-EVENT-CAPTURE.md)
- [PHASE2 — Attribution](./PHASE2-ATTRIBUTION.md)
- [PHASE3 — Opportunity scores](./PHASE3-OPPORTUNITY-SCORES.md)
- [PHASE4 — Employee performance](./PHASE4-EMPLOYEE-PERFORMANCE.md)
- [PHASE5 — Dashboards](./PHASE5-DASHBOARDS.md)
- [PHASE6 — Alerts & refinement](./PHASE6-REFINEMENT.md)
