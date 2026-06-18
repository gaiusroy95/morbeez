# Visit Advisory Workflow — Spec to Wizard Mapping

This document maps the **16-step Morbeez AI advisory spec** to the **16 UI wizard steps** implemented across agronomist mobile, partner mobile, and staff web console.

## Wizard steps (UI)

| # | UI step | Spec | Agronomist / Web | Partner |
|---|---------|------|------------------|---------|
| 1 | `overview` | Farm + crop + history | Full + history timeline | Read-only farm context |
| 2 | `photos` | Photos + QC | Capture + validate/retake (blur, coverage, min field + symptom) | Same (no BI scores) |
| 3 | `measurements` | Field measurements | Grouped by category | Same |
| 4 | `soilWeather` | Soil & weather | Full soil panel + weather | Read-only, scores stripped |
| 5 | `aiAnalysis` | AI multi-issue | `POST /visits/analyze-visit` — evidence, severity, root cause, initial recs | Sanitized multi-issue analyze |
| 6 | `agronomistReview` | Expert review | Approve / modify / reject (mandatory fields) | Read-only acknowledge + manual correction |
| 7 | `followUp` | AI Q&A | Gated on modify/reject/low confidence; reanalyze after answers | Same (partner API) |
| 8 | `additionalPhotos` | More photos | Photo requests from Q&A; capture per type | Same |
| 9 | `finalDiagnosis` | Final diagnosis | Consolidated list | Same |
| 10 | `recPlanning` | Rec groups | Group editor + AI draft rec | Draft groups only |
| 11 | `applicationSchedule` | Day 0/7/14/21 plan | Timeline editor | Same |
| 12 | `recApproval` | Compatibility | Approve/modify + compat panel | **Hidden** (expert review) |
| 13 | `monitoringPlan` | Monitoring | Preview via `POST /visits/monitoring-plan/preview` | Local fallback schedule |
| 14 | `whatsappPreview` | WhatsApp preview | `POST /visits/whatsapp-preview` + confirm | Skipped (sent after expert review) |
| 15 | `summary` | Final checks | GPS, follow-up outcomes | Same |
| 16 | `caseClosure` | Learning manifest | Read-only capture manifest; **submit here** | Draft submit |

### Step flow (gated paths)

```
aiAnalysis → agronomistReview
  → approve + high confidence → finalDiagnosis (skips followUp)
  → modify / reject / low confidence → followUp → additionalPhotos? → finalDiagnosis
  → recPlanning → applicationSchedule → recApproval → monitoringPlan → whatsappPreview → summary → caseClosure
```

## Backend services

| Spec | Service / route |
|------|-----------------|
| Photo QC | `POST /visits/photos/validate` (+ `coverage`) |
| Multi-issue AI | `POST /visits/analyze-visit` |
| Environment | `GET /visits/environment?farmerId&blockId` |
| Rec groups | `recommendation_groups` + `recommendation-group.service.ts` |
| Compatibility | `POST /visits/recommendations/compatibility-check` |
| Monitoring preview | `POST /visits/monitoring-plan/preview` → persisted on submit + `visit_monitoring_progression` job |
| WhatsApp preview | `POST /visits/whatsapp-preview`; send on submit after confirm |
| Evidence inbound | `visit-evidence-inbound.service.ts` via WhatsApp router |
| Outcome / callbacks | `recommendation-follow-up.service.ts` + `scheduleEscalationJob` → `visit_callback_escalation` worker |
| Learning closure | `visit-case-closure.service.ts` on submit + `POST /visits/:findingId/close-case` |

## Partner restrictions

- Draft recommendations only (`pending_expert_review`)
- No `recApproval` step; `whatsappConfirmed: true` in validation
- Confidence and BI scores stripped via `partner-response-sanitizer.ts`
- Submit on `caseClosure` without default `approve_ai`

## E2E verification (ginger demo)

Farmer **+916282873542** — three ginger blocks with soil samples (see [GINGER-ADVISORY-SAMPLES.md](./GINGER-ADVISORY-SAMPLES.md)).

1. Complete steps 1–5: expect 1–N issues (e.g. Bacterial Leaf Spot, Nitrogen Deficiency) with evidence cards.
2. Step 6: approve one issue, modify another → only modified issue gets Q&A.
3. Steps 8–11: rec groups + day schedule.
4. Steps 13–16: monitoring preview, WhatsApp preview, summary, learning manifest → submit.
5. Post-submit: farmer WhatsApp, outcome buttons, worse → callback task.

Apply migrations before using group/monitoring/escalation features:

- `20260719000000_visit_advisory_phase3.sql`
- `20260720000000_recommendation_groups.sql`
- `20260722000000_ginger_advisory_soil_samples.sql`
- `20260723000000_ginger_advisory_retarget_farmer.sql`
