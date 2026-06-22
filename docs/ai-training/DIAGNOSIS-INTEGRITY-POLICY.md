# Diagnosis Integrity Policy

Morbeez AI diagnosis labels must never come from hard-coded rules. Every ranked issue must declare how it was produced.

## Tier A — Diagnosis labels (allowed sources)

| Source | Meaning |
|--------|---------|
| `model` | OpenAI JSON inference from field evidence |
| `vision` | Plant.id or OpenAI vision on visit photos |
| `verified_reuse` | Retrieved from `advisory_reuse_cases` with `outcome_ok` and `reused: true` |

## Tier B — Workflow only (hard-coded thresholds OK)

- `resolveConfidenceAction` gates (auto_send / employee_review / escalate)
- MAIOS triage L1–L4 routing
- Q&A skip when high confidence + approve

## Tier C — Context only (never post-hoc label mutation)

- Disease–weather priors in prompts
- Plot memory, nearby cases, soil summaries
- `computeEvidenceSignals` in visit prompt blocks

## Tier D — Degraded mode (fail closed)

When OpenAI and vision cannot produce evidence-backed hypotheses:

- Return `insufficient_evidence` envelope
- Set `escalationRequired: true`
- Do **not** emit synthetic labels like "Field observation"

## Rejected patterns

- Admin `+20/−15` Q&A score weights (use outcome-learned discriminators instead)
- `computeFusionHints` post-hoc confidence boosts
- Knowledge fallback serving diagnosis for disease-intent messages without verified reuse path
- Canned Q&A banks when AI is unavailable

## API contract

`POST /visits/analyze-visit` returns issues with:

- `diagnosisSource`: `model` | `vision` | `verified_reuse` | `insufficient_evidence`
- `diagnosisEnvelope`: ranked hypotheses + escalation flags

`GET /health` includes `diagnosis.diagnosisDegraded` when `OPENAI_API_KEY` is unset.

## Implementation

- [`backend/src/domain/diagnosis/types.ts`](../../backend/src/domain/diagnosis/types.ts)
- [`backend/src/services/diagnosis/diagnosis-orchestrator.service.ts`](../../backend/src/services/diagnosis/diagnosis-orchestrator.service.ts)
- [`backend/src/services/diagnosis/diagnosis-integrity.util.ts`](../../backend/src/services/diagnosis/diagnosis-integrity.util.ts)
