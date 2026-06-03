# Stage 0 — AI Training Standardization Charter

This document locks the data contract for Morbeez AI training. All new UI fields and API payloads must use canonical enums from `backend/src/domain/ai-training/`.

## Principle

**Bad structured data = bad AI.** Prefer dropdowns, controlled classifications, and master tables over free-text where a taxonomy exists.

## Spec → database mapping

| Spec entity | Supabase table | Notes |
|-------------|----------------|-------|
| Farmers | `farmers` | Soil/irrigation on `farm_blocks` |
| CropBlocks | `farm_blocks` | DAP computed from `planting_date` |
| FieldFindings | `crm_field_findings` | Stage 1 adds structured columns |
| CropImages | *(Stage 3)* | Interim: `advisory-images` bucket |
| FieldActivities | `cultivation_activities` | Types in `field_activity_types` |
| Recommendations | `recommendation_records` | Links to `ai_advisory_sessions` |
| RecommendationOutcomes | `recommendation_records` + `ai_learning_samples` | Stage 5 adds dedicated UI |
| Weather | `weather_snapshots` | Stage 1 |
| EscalationCorrections | `agronomist_escalations` | Stage 2 adds `ai_training_events` |
| Confidence engine | `ai_advisory_sessions` | Stage 4 adds lifecycle flags |

Full field-level map: `backend/src/domain/ai-training/schema-map.ts`.

## Canonical enums

Defined in `backend/src/domain/ai-training/enums.ts` and mirrored in `backend/console-ui/src/lib/ai-training-enums.ts`.

| Enum | Values | Used by |
|------|--------|---------|
| `FindingType` | disease, pest, nutrient_deficiency, … | Field findings |
| `ReviewSeverity` | mild, moderate, severe | Case review UI |
| `RecordSeverity` | low, medium, high | DB storage |
| `RecommendationOutcome` | better, partial, no_improvement, unknown | Outcomes |
| `ReviewAction` | approve_ai, correct_ai, partial_match, escalate_urgent | Case review |
| `ConfidenceAction` | auto_send, employee_review, escalate | Routing |

## Severity mapping

UI uses `mild | moderate | severe`. Database uses `low | medium | high`.

```typescript
import { mapUiSeverityToRecord, mapRecordSeverityToUi } from 'backend/src/domain/ai-training';
```

## Confidence routing

| Confidence | Action | Env var |
|------------|--------|---------|
| ≥ 95% | `auto_send` | `AI_AUTO_SEND_THRESHOLD` (default 0.95) |
| 80–94% | `employee_review` | `AI_REVIEW_THRESHOLD` (default 0.80) |
| < 80% | `escalate` | — |

Implementation: `backend/src/domain/ai-training/confidence-routing.ts`

Legacy `AI_ESCALATION_THRESHOLD` defaults to 0.80 (aligned with review threshold).

## API validators

Zod schemas in `backend/src/domain/ai-training/validators.ts`:

- `caseReviewBodySchema` — agronomist case review
- `recordOutcomeBodySchema` — recommendation outcomes
- `structuredFieldFindingSchema` — field findings (Stage 1+)

## Staged rollout

| Stage | Focus | Status |
|-------|-------|--------|
| 0 | Standardization charter | **Done** |
| 1 | Structured input foundation | **Done** |
| 2 | Unified correction spine (`ai_training_events`) | **Done** |
| 3 | Image review UI + `crop_images` | **Done** |
| 4 | Confidence lifecycle columns | **Done** |
| 5 | Outcome review UI | **Done** |
| 6 | Interaction + finding UI perfection | **Done** |
| 7 | Training export pipeline | **Done** |
| 8 | Weather correlation intelligence | **Done** |

## Rules for contributors

1. Import enums from `@/domain/ai-training` (backend) or `@/lib/ai-training-enums` (console-ui) — do not inline string literals.
2. New dropdown options → add to enum + migration CHECK constraint if persisted.
3. Free-text is allowed for narrative fields (`notes`, `observations`) but not for classification fields (`finding_type`, `severity`, `outcome`).
4. When adding a new training entity, update `schema-map.ts` first.
