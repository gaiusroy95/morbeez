# MAIOS v17 Reasoning Integration

**Status:** Integrated as an **additive layer** on MAIOS v12 — existing case builder, gates, module fusion, and LLM advisory paths are **not replaced**.

## Philosophy alignment

| v17 spec | Integration |
|----------|-------------|
| Knowledge Service | `maiosKnowledgeService` + `domain/maios-reasoning/knowledge/ginger.v1.ts` |
| Context Engine | `maiosContextEvidenceService` (wraps `disease-weather-rules`, regional priors) |
| Image / observations | `maiosEvidenceRepositoryService` (vision label + optional feature list) |
| Evidence Engine | Evidence repository merge |
| Bayesian Engine | `maiosBayesianEngineService` (LR matrix, **not** LLM ranking) |
| Evidence Gap (EVSI) | `maiosEvsiEngineService` |
| Decision Engine | `maiosDecisionEngineService` (LOCK / CONTINUE) |
| Explainability | `maiosExplainabilityEngineService` |
| Scientific Management | `maiosScientificManagementService` (Domain 8 — IPM/cultural/chemical classes from knowledge) |
| Safety Engine | `maiosSafetyEngineService` (Domain 9 — weather, crop stage, PHI checks) |
| Final Report | `maiosFinalReportService` (Domain 10 — farmer + agronomist summaries) |
| Learning | `maiosLearningFacadeService` (Domain 11 — visit close + agronomist case review; **LR matrix never auto-updated**) |
| Image observations | `visitVisionObservationsService` + `plantIdVisionFeaturesService` (Domain 2 — crop-aware Plant.id + vision JSON) |

## Where it runs

```
caseBuilderService.buildCase()
  → existing MAIOS v12 pipeline (unchanged)
  → maiosReasoningPipelineService.run()   // additive
  → optional enrichHypotheses() when shadow off
  → MaiosCase.reasoning snapshot attached

visitAiOrchestratorService.analyze() / reanalyze()
  → existing LLM hypothesis path (unchanged)
  → maiosReasoningAdapterService.fromVisit()   // additive
  → reasoning on API response + visit_ai_cases.metadata.reasoningSnapshot
  → getQuestions() / persistVisitFollowUpQuestions() prepends EVSI-ranked question via maiosEvsiVisitBridgeService

cropDoctorService.diagnose() (WhatsApp)
  → existing OpenAI advisory path (unchanged — language + treatment text)
  → caseBuilderService.buildCase() with farmerAnswers + visionObservations
  → cropDoctorReasoningBridgeService.applyBayesianDiagnosis() when shadow off
  → MaiosCase.reasoning on DiagnoseResult.maiosCase
  → post-diagnosis Q&A uses EVSI via maiosEvsiWhatsappBridgeService (LLM fallback when no EVSI candidate)
```

Entry: `backend/src/services/case/case-builder.service.ts`

## Feature flags

| Env | Default | Effect |
|-----|---------|--------|
| `ENABLE_MAIOS_REASONING` | `true` | Run v17 pipeline after v12 build |
| `MAIOS_REASONING_SHADOW` | `true` | Attach `reasoning` to case; **do not** replace fused hypotheses |
| `ENABLE_STRUCTURED_VISION` | `true` | Parse structured lesion features from visit vision JSON |

Set `MAIOS_REASONING_SHADOW=false` to blend Bayesian posterior into `diagnostics.hypotheses` (60% Bayesian / 40% existing). Visit wizard uses the same flag via `applyBayesianToVisitHypotheses`. WhatsApp uses `cropDoctorReasoningBridgeService.applyBayesianDiagnosis()` to override `probableIssue` and `confidence` while keeping LLM farmer summaries and treatment text.

## Output shape

`MaiosCase.reasoning` (`MaiosReasoningSnapshot`):

- `evidence[]` — normalized evidence repository
- `prior` / `posterior` — Bayesian distributions
- `decision` — LOCK or CONTINUE
- `explanation` — supporting / rejected / missing
- `nextEvidence` — EVSI-ranked question or photo slot
- `management` — scientific plan when decision is LOCK (null otherwise)
- `safety` — PASS/REJECT validation of management plan
- `finalReport` — structured v17 report with farmer/agronomist summaries

## Ginger knowledge v1

LR matrix and question bank: `ginger.v1.ts`, `banana.v1.ts`, `tomato.v1.ts`, `coconut.v1.ts`, `brinjal.v1.ts`, `default.v1.ts` (fallback for other crops)

Expert sign-off checklist: `docs/v17-expert-signoff-checklist.md`

Expert-governed only — **no automatic LR retraining**.

## Tests

```bash
cd backend && node --import tsx --test tests/maios-reasoning.test.ts tests/diagnosis-v17.test.ts tests/diagnosis-gold-cases.test.ts
```

## v17 Diagnosis API

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/diagnosis/start` | Start evidence-driven case (Bayesian, no LLM ranking) |
| `POST /api/v1/diagnosis/:sessionId/answers` | Submit farmer answers, re-run pipeline |
| `GET /api/v1/diagnosis/:sessionId/report` | Fetch `DiagnosisFinalReport` |

Requires internal API key (same as `/api/v1/advisory/diagnose`).

## Not yet wired (future, no rewrite)

- Full Plant.id API structured `similar_images` lesion geometry (heuristic label → feature mapping is implemented for pilot crops)

## Related existing services (still used)

- `evidence-quality.service.ts` — EQS / photo slots
- `case-gates.service.ts` — MAIOS route gates
- `multi-model-fusion.service.ts` — hypothesis enrichment
- `disease-weather-rules.service.ts` — context priors
