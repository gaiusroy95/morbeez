# Phase 3 — Farmer opportunity scores

Nightly (and on-demand) engine that computes a **0–100 opportunity score** per farmer from events, profile, recommendations, commerce, and attribution. Results land in `farmer_scores`, `farmer_score_history`, `farmer_retention_tracking`, and `farmer_metric_history`.

## Modules

| File | Role |
|------|------|
| `farmer-opportunity-scoring.util.ts` | Pure scoring functions + retention bands |
| `farmer-opportunity-engine.service.ts` | Load signals, compute, persist |
| `farmer-opportunity-score.worker.ts` | IST 02:00–04:59 nightly batch (500 farmers/run) |

## Score components (max points)

| Component | Max | Signals |
|-----------|-----|---------|
| Engagement | 20 | Inbound WhatsApp replies, photos/voice (30d) |
| Trust | 15 | ROI entries, applied recs, paid orders, positive outcomes |
| Acre size | 15 | `total_acreage` or sum of block acreage |
| Acre potential | 20 | Blocks, multi-crop, acreage captured |
| Relationship | 10 | Lead assignee, attribution touches, CRM follow-ups |
| Advisory cooperation | 10 | Communicated/applied recommendations, AI sessions |
| Crop value | 5 | High-value crops (cardamom, pepper, …) |
| Referral influence | 5 | Non-organic referral / campaign source |

Each run stores explainable `factors[]` on the score row.

## Retention snapshot

`farmer_retention_tracking` updated per farmer:

| Days since last inbound | Band |
|-------------------------|------|
| ≤ 7 | `healthy` |
| 8–14 | `watch` |
| 15–30 | `at_risk` |
| > 30 | `churned` |

## APIs

| Method | Path | Notes |
|--------|------|-------|
| GET | `/morbeez-staff/api/v1/farmers/:id/opportunity-score` | Cached; `?recalculate=true` forces refresh |
| GET | `/morbeez-staff/api/v1/os/intelligence/opportunity-scores/farmers/:farmerId` | Score + retention row |
| GET | `/morbeez-staff/api/v1/os/intelligence/opportunity-scores/top` | Leaderboard (`limit`, `minScore`) |
| POST | `/morbeez-staff/api/v1/os/intelligence/opportunity-scores/recalculate` | `{ farmerId?, limit?, dryRun? }` |

Requires `intelligence` module access.

## Worker

- Env: `ENABLE_OPPORTUNITY_SCORE_WORKER` (default `true`, off in `NODE_ENV=test`)
- Batch priority: farmers with `farmer_events` in last 90 days, then stale `farmer_scores`
- Manual: `runFarmerOpportunityScoresNow()` or POST recalculate endpoint

## Phase 4

See [PHASE4-EMPLOYEE-PERFORMANCE.md](./PHASE4-EMPLOYEE-PERFORMANCE.md).
