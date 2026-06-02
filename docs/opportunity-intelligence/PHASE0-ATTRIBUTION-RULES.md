# Opportunity Intelligence — Phase 0 attribution rules

Product sign-off baseline for Phase 1–2 instrumentation. All scores remain **system-generated**; managers do not enter ratings.

## Employee identity

- **Canonical FK:** `employee_profiles.id` on `farmer_events` and `employee_farmer_attribution`.
- **Resolution:** Staff actions use `admin_users.id` or email (`leads.assigned_to`) → resolved via `employeeProfileResolveService`.

## Attribution types

| Type | When created | Typical role | Default weight |
|------|----------------|--------------|----------------|
| `telecaller_assigned` | Lead assigned / first outbound CRM or WhatsApp | telecaller | 0.20 |
| `first_engagement` | First meaningful two-way WhatsApp (farmer reply) after assign | telecaller | 0.35 |
| `relationship_owner` | Primary ongoing owner (longest active assign window) | telecaller | 0.25 |
| `advisory` | Agronomist case review save, verified recommendation, field finding | agronomist | 0.40 |
| `conversion_assist` | Order paid within 180d while attribution active | both | 0.30 |
| `reactivation` | Farmer was inactive 30d+ then re-engaged after employee touch | telecaller / agronomist | 0.25 |

Weights are **not** required to sum to 1 across employees; engines use them for fractional credit on delayed conversion.

## Multi-touch example

```text
Telecaller assigns lead → telecaller_assigned
Farmer replies on WhatsApp → first_engagement (telecaller)
Agronomist approves recommendation → advisory (agronomist)
Order 90 days later → conversion_assist credited to both (weighted)
```

## Farmer events → attribution (Phase 1)

| Event | Attribution side-effect |
|-------|-------------------------|
| `MESSAGE_REPLY` (inbound) | Bump `first_engagement` / `relationship_owner` for assignee |
| `RECOMMENDATION_APPROVED` | `advisory` for approving agronomist |
| `ORDER_CONVERTED` | `conversion_assist` for active attributions in window |
| `FARMER_REACTIVATED` | `reactivation` for employee who sent last outbound before reply |

## Farmer opportunity score (0–100)

| Component | Max points |
|-----------|------------|
| Engagement | 20 |
| Trust | 15 |
| Acre size | 15 |
| Acre potential | 20 |
| Relationship | 10 |
| Advisory cooperation | 10 |
| Crop value | 5 |
| Referral influence | 5 |

Populated by metrics engines in Phase 3 into `farmer_scores`.

## Employee performance score (0–100)

| Metric | Max points |
|--------|------------|
| Engagement growth | 20 |
| Relationship quality | 20 |
| Retention quality | 15 |
| Trust building | 15 |
| Delayed conversion influence | 10 |
| Farmer reactivation | 10 |
| Knowledge contribution | 5 |
| Farmer satisfaction | 5 |

Populated in Phase 4 into `employee_scores`. Replaces placeholder lead-count scoring on Employees page.

## Delayed conversion window

- **180 days** from `first_touch_at` / `last_touch_at` on attribution row.
- Commerce order linked to farmer → split credit by active attributions (not only current `leads.assigned_to`).

## Fairness

- No employee leaderboard until **≥ 10** attributed farmers (configurable in Phase 4).
- Scores include `factors[]` JSON for explainability.

## Schema

Migration: `supabase/migrations/20260637000000_opportunity_intelligence_phase0.sql`

Backend modules: `backend/src/services/intelligence/`

## Next phases

1. **Phase 1** — Event capture (`farmer_events`) — see [PHASE1-EVENT-CAPTURE.md](./PHASE1-EVENT-CAPTURE.md).
2. **Phase 2** — Attribution upserts — see [PHASE2-ATTRIBUTION.md](./PHASE2-ATTRIBUTION.md).
3. **Phase 3** — Farmer opportunity scores — see [PHASE3-OPPORTUNITY-SCORES.md](./PHASE3-OPPORTUNITY-SCORES.md).
4. **Phase 4** — Employee performance scores — see [PHASE4-EMPLOYEE-PERFORMANCE.md](./PHASE4-EMPLOYEE-PERFORMANCE.md).
