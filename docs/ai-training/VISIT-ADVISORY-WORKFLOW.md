# Visit Advisory Workflow — Spec to Wizard Mapping

This document maps the **Morbeez AI advisory spec** to the **visit wizard steps** implemented across agronomist mobile, partner mobile, and staff web console.

## Diagnosis envelope (integrity)

All visit and WhatsApp diagnosis responses use a **DiagnosisEnvelope** contract:

- `source`: `model` | `vision` | `verified_reuse` | `insufficient_evidence`
- Ranked `hypotheses` only when source is inference or verified reuse
- `escalationRequired` when evidence is insufficient (no synthetic fallback labels)

See [DIAGNOSIS-INTEGRITY-POLICY.md](./DIAGNOSIS-INTEGRITY-POLICY.md).

## Wizard steps (UI)

| # | UI step | Spec | Agronomist / Web | Partner |
|---|---------|------|------------------|---------|
| 1 | `overview` | Farm + crop + history + visit type | Full + plot intelligence summary | Read-only farm context |
| 2 | `photos` | Photos + QC | Capture + validate/retake | Same |
| 3 | `measurements` | Field measurements | Grouped by category | Same |
| 4 | `soilWeather` | Soil & weather | Full soil panel + weather | Read-only |
| 5 | `aiTriage` | AI triage L1–L4 | `POST /visits/triage-preview` — routes workflow | Same |
| 6 | `aiAnalysis` | AI multi-issue | `POST /visits/analyze-visit` via diagnosis orchestrator | Sanitized analyze |
| 7 | `agronomistReview` | Expert review | Approve blocked on L4 | Read-only + correction |
| 8 | `followUp` | AI Q&A | Gated by triage + review action | Same |
| 9 | `additionalPhotos` | More photos | Photo requests from Q&A | Same |
| 10 | `finalDiagnosis` | Final diagnosis | Consolidated list | Same |
| 11 | `economicOptimizer` | Cost vs recovery | `POST /visits/recommendation-options/preview` | Hidden |
| 12 | `recPlanning` | Rec groups | Group editor + AI draft rec | Draft groups only |
| 13 | `applicationSchedule` | Day plan | Timeline editor | Same |
| 14 | `recApproval` | Compatibility | Approve/modify + compat panel | **Hidden** |
| 15 | `monitoringPlan` | Monitoring | Preview API | Local fallback |
| 16 | `whatsappPreview` | WhatsApp preview | Preview + confirm | Skipped |
| 17 | `summary` | Final checks | GPS, follow-up outcomes | Same |
| 18 | `caseClosure` | Learning manifest | Submit + variant tracking | Draft submit |

### Step flow (triage-gated)

```
soilWeather → aiTriage → aiAnalysis → agronomistReview
  L1 + approve + high confidence → may skip followUp
  L2/L3 → mandatory followUp
  L4 → block auto-approve; escalate required
  → finalDiagnosis → economicOptimizer? → recPlanning → … → caseClosure
```

## Backend services

| Spec | Service / route |
|------|-----------------|
| Diagnosis orchestrator | `diagnosis-orchestrator.service.ts` |
| Triage preview | `POST /visits/triage-preview` |
| Multi-issue AI | `POST /visits/analyze-visit` |
| Plot digital twin | `GET /blocks/:blockId/plot-intelligence` |
| Economic optimizer | `POST /visits/recommendation-options/preview` |
| Outcome intelligence | `GET /os/agronomist/outcome-intelligence` |
| Regional threat radar | `GET /os/field/regional-threat-radar` |
| Agronomist copilot | `POST /os/agronomist/copilot/ask` |
| Environment | `GET /visits/environment?farmerId&blockId` |
| Rec groups | `recommendation_groups` + `recommendation-group.service.ts` |
| Learning closure | `visit-case-closure.service.ts` + outcome-confirmed promotion |

## Partner restrictions

- Draft recommendations only (`pending_expert_review`)
- No `recApproval` or `economicOptimizer` steps
- Confidence and BI scores stripped via `partner-response-sanitizer.ts`

## E2E verification (ginger demo)

Farmer **+916282873542** — three ginger blocks with soil samples (see [GINGER-ADVISORY-SAMPLES.md](./GINGER-ADVISORY-SAMPLES.md)).

1. Complete overview through `aiTriage`: expect L1–L4 level and routed path.
2. `aiAnalysis`: issues must declare `diagnosisSource`; insufficient evidence shows escalation UI.
3. `agronomistReview`: L4 cannot use Approve AI.
4. Optional `economicOptimizer` before rec planning.
5. Submit on `caseClosure`; verify WhatsApp + outcome loop.

Apply migrations before intelligence layers:

- `20260724000000_ai_os_intelligence_layers.sql`
