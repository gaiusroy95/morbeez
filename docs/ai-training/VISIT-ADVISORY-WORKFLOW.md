# Visit Advisory Workflow — v12 Screen Flow

This document maps the **Morbeez AI advisory spec** to the **12-screen visit wizard** implemented across agronomist mobile, partner mobile, and staff web console.

**Wizard version:** `v12`  
**Shared step flow:** `packages/shared/src/visit-wizard/step-flow.ts`

## Diagnosis envelope (integrity)

All visit and WhatsApp diagnosis responses use a **DiagnosisEnvelope** contract:

- `source`: `model` | `vision` | `verified_reuse` | `insufficient_evidence`
- Ranked `hypotheses` with **Unknown** uncertainty bucket (weights sum to 100%)
- `escalationRequired` when evidence is insufficient

See [DIAGNOSIS-INTEGRITY-POLICY.md](./DIAGNOSIS-INTEGRITY-POLICY.md).

## Wizard screens (12)

| # | Step ID | Name | Purpose |
|---|---------|------|---------|
| 1 | `intakeTriage` | Intake + Triage | Farmer context, visit type, block assessment, L1–L4 triage |
| 2 | `photos` | Photo collection | Field + symptom photos, voice note, QC |
| 3 | `fieldIntelligence` | Field intelligence | Measurements, soil, weather, field activity (web + mobile) |
| 4 | `dynamicQA` | Dynamic Q&A | Screening + adaptive questions; confidence 68%→85% |
| 5 | `aiDiagnosis` | AI diagnosis | Ranked issues, evidence, root cause (read-only) |
| 6 | `diagnosisFinalization` | Diagnosis finalization | Approve / modify / reject + final diagnosis text |
| 7 | `recommendationBuilder` | Recommendation builder | Rec groups + optional economics panel (staff/agronomist) |
| 8 | `scheduleCompatibility` | Schedule + compatibility | Day plan + tank-mix safety |
| 9 | `farmerCommunication` | Farmer communication | WhatsApp preview + confirm |
| 10 | `visitSummary` | Visit summary | Quality score, GPS, evidence counts |
| 11 | `followUpPlanning` | Follow-up planning | Monitoring plan + prior rec outcomes |
| 12 | `learningSubmit` | Learning + submit | Training manifest preview + submit |

### Deprecated standalone steps (v11 and earlier)

| Legacy step | Replaced by |
|-------------|-------------|
| `overview`, `aiTriage` | `intakeTriage` |
| `followUp` | `dynamicQA` |
| `aiAnalysis` | `aiDiagnosis` |
| `agronomistReview`, `finalDiagnosis` | `diagnosisFinalization` |
| `additionalPhotos` | inline in `photos` / Q&A photo requests |
| `economicOptimizer` | panel inside `recommendationBuilder` |
| `recPlanning` | `recommendationBuilder` |
| `applicationSchedule`, `recApproval` | `scheduleCompatibility` |
| `whatsappPreview` | `farmerCommunication` |
| `summary` (follow-ups) | split: `visitSummary` + `followUpPlanning` |
| `monitoringPlan` | `followUpPlanning` |
| `caseClosure` | `learningSubmit` |

Legacy draft step IDs are mapped via `normalizeVisitWizardStep()` in `@morbeez/shared`.

## Dynamic confidence engine

- **Distribution:** hypotheses + Unknown bucket sum to 100%
- **Target:** ≥85% top-hypothesis confidence before diagnosis
- **Per-answer updates:** `POST /visits/ai-case/:id/answer`
- **State:** `GET /visits/ai-case/:id/confidence-state`
- **Screening init:** `POST /visits/ai-case/:id/screen`
- **Fallback:** `POST /visits/ai-case/:id/reanalyze`

## Server drafts

- `PUT /visits/sessions/:sessionId/draft` — upsert wizard state
- `GET /visits/sessions/:sessionId/draft` — load
- `GET /visits/drafts` — list for Visit Command Center
- `DELETE /visits/sessions/:sessionId/draft` — clear on submit

Table: `visit_wizard_drafts` (migration `20260804000000_visit_wizard_drafts.sql`).

## Backend services

| Spec | Service / route |
|------|-----------------|
| Diagnosis orchestrator | `diagnosis-orchestrator.service.ts` |
| Confidence engine | `visit-ai-confidence-engine.service.ts` |
| Visit AI orchestrator | `visit-ai-orchestrator.service.ts` |
| Draft persistence | `visit-wizard-draft.service.ts` |
| Learning closure | `visit-case-closure.service.ts` |

## Partner restrictions

- Same 12-step flow; economics panel and full compatibility approval hidden
- Confidence % stripped via `partner-response-sanitizer.ts`
- Submits `pending_expert_review`

## E2E verification (ginger demo)

Farmer **+916282873542** — see [GINGER-ADVISORY-SAMPLES.md](./GINGER-ADVISORY-SAMPLES.md).

1. `intakeTriage`: L1–L4 + visit classification
2. `dynamicQA`: confidence progress to ≥85%
3. `diagnosisFinalization`: L4 blocks auto-approve
4. Submit on `learningSubmit`; verify WhatsApp + outcome loop

```bash
supabase db push
```
