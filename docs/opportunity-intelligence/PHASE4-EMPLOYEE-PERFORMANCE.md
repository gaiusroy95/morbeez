# Phase 4 — Employee performance scores

System-generated **0–100 performance scores** per `employee_profiles` row, replacing lead-count placeholders on the Employees page.

## Modules

| File | Role |
|------|------|
| `employee-performance-scoring.util.ts` | Pure scoring + breakdown + labels |
| `employee-performance-engine.service.ts` | Load signals, compute, persist |
| `opportunity-score-store.service.ts` | `upsertEmployeeScore` / `getEmployeeScore` |

Nightly batch runs **after** farmer opportunity scoring (same IST 02:00–04:59 worker).

## Score components (max points)

| Component | Max | Signals |
|-----------|-----|---------|
| Engagement growth | 20 | Attributed farmer inbound trend, outbound, CRM tasks done |
| Relationship quality | 20 | Avg `relationship_score` on attributed farmers |
| Retention quality | 15 | % farmers `healthy` / `watch` in retention tracking |
| Trust building | 15 | ROI / applied rec events, approvals |
| Delayed conversion | 10 | `conversion_assist` attributions (180d) |
| Farmer reactivation | 10 | `reactivation` attributions |
| Knowledge contribution | 5 | Recommendation milestones, activity evidence |
| Farmer satisfaction | 5 | Positive recommendation outcomes |

## Fairness

- **Leaderboard** (`GET .../performance-scores/employees/top`) only includes employees with **≥ 10** attributed farmers.
- Scores below that threshold still calculate and show in the Employees UI with a “building sample” notice.

## Staff UI

`staffAdminService` reads `employee_scores` when present:

- `performanceSource`: `engine` | `estimated`
- `attributedFarmerCount`, `leaderboardEligible`
- Real `performanceBreakdown` (8 bars) and `performanceFactors` on employee detail

Orphan admin users without HR profiles keep estimated scores until a profile exists.

## APIs

| Method | Path |
|--------|------|
| GET | `/morbeez-staff/api/v1/os/intelligence/performance-scores/employees/:employeeProfileId` |
| GET | `/morbeez-staff/api/v1/os/intelligence/performance-scores/employees/top` |
| POST | `/morbeez-staff/api/v1/os/intelligence/opportunity-scores/recalculate` |

Recalculate body extensions:

```json
{
  "employeeProfileId": "uuid",
  "includeEmployees": true,
  "limit": 200
}
```

## Manual run

Nightly worker handles both farmer + employee batches. To refresh employees only:

```ts
import { runEmployeePerformanceScoresNow } from './farmer-opportunity-score.worker.js';
await runEmployeePerformanceScoresNow({ limit: 200 });
```

## Next

[Phase 5 — Dashboards & CRM](./PHASE5-DASHBOARDS.md): Opportunity console page, district/at-risk lists, telecaller farmer intelligence panel.
