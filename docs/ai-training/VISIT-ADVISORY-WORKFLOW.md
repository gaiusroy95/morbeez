# Visit Advisory Workflow — Spec to Wizard Mapping

This document maps the **16-step Morbeez AI advisory spec** to the **12 UI wizard steps** implemented across agronomist mobile, partner mobile, and staff web console.

## Wizard steps (UI)

| UI step | Spec steps | Agronomist / Web | Partner |
|---------|------------|------------------|---------|
| `overview` | 1 — Farm + crop + history | Full + history timeline | Read-only farm context |
| `photos` | 2 — Photos + QC | Capture + validate/retake | Same (no BI scores) |
| `measurements` | 3 — Field measurements | Grouped by category | Same |
| `soilWeather` | 4 — Soil & weather | Full soil panel + weather | Read-only, scores stripped |
| `issues` | (intake) | Issue cards | Same |
| `aiAnalysis` | 5 — AI analysis | Full + confidence | Analyze only, no confidence |
| `followUp` | 7 — AI Q&A | Questions + reanalyze | Partner API parity |
| `finalDiagnosis` | 8 — Final diagnosis | Consolidated read-only list | Same |
| `recPlanning` | 9–10 — Rec groups + day plan | Group editor + AI draft rec | Draft groups only |
| `recApproval` | 11–12 — Approval + compatibility | Approve/modify + compat panel | **Skipped** (expert review) |
| `review` | 6 — Expert review | Approve/modify/reject | Acknowledge → pending expert |
| `summary` | 13–14 — Monitoring + WhatsApp preview | Monitoring schedule + submit | Draft submit |

## Backend services

| Spec | Service / route |
|------|-----------------|
| Photo QC | `POST /visits/photos/validate` |
| Environment | `GET /visits/environment?farmerId&blockId` |
| Rec groups | `recommendation_groups` + `recommendation-group.service.ts` |
| Compatibility | `POST /visits/recommendations/compatibility-check` |
| Monitoring | `monitoring-plan.service.ts` → `monitoring_plan_items` |
| WhatsApp / outcome | Existing `recommendation-follow-up.service.ts` + communication on approve |
| Callbacks | `visit-advisory-escalation.service.ts` + automation worker jobs |
| Learning closure | `visit-case-closure.service.ts`, `POST /visits/:findingId/close-case`, training bundle export |

## Partner restrictions

- Draft recommendations only (`pending_expert_review`)
- No approve/reject/train-AI in UI
- Confidence and BI scores stripped via `partner-response-sanitizer.ts`
- `recApproval` step hidden in partner wizard

## Phase completion

- **Phase 1:** Steps 1–8 — overview, photos QC, measurements, soil/weather, AI, Q&A, final diagnosis
- **Phase 2:** Steps 9–14 — rec groups, compatibility, monitoring, WhatsApp/outcome linkage on submit
- **Phase 3:** Steps 15–16 — callback automation, case closure + training export

Apply migrations before using group/monitoring/escalation features:

- `20260719000000_visit_advisory_phase3.sql`
- `20260720000000_recommendation_groups.sql`
- `20260722000000_ginger_advisory_soil_samples.sql` — demo farmer + 3 ginger blocks with lab reports

See [GINGER-ADVISORY-SAMPLES.md](./GINGER-ADVISORY-SAMPLES.md) for scenario IDs, block UUIDs, and expected AI outcomes.
