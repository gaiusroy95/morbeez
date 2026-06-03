# Stage 5 — Outcome Review UI

Migration: `20260651000000_recommendation_outcomes.sql`

## Purpose

Close the AI training loop by recording **whether recommendations actually worked** — the effectiveness learning layer.

## New columns on `recommendation_records`

| Column | Spec mapping |
|--------|--------------|
| `recovery_days` | Days to visible recovery |
| `farmer_outcome_feedback` | Farmer-reported result |
| `agronomist_outcome_feedback` | Expert field assessment |
| `issue_resolved` | Boolean ground truth |
| `outcome_recorded_by` | Reviewer audit |

## Service

`backend/src/services/core/outcome-review.service.ts`

| Method | Purpose |
|--------|---------|
| `listQueue` | Pending / overdue / recorded recommendations |
| `getDetail` | Full context + follow-up status |
| `recordOutcome` | Structured outcome → `ai_learning_samples` |

## Queue filters

| Filter | Shows |
|--------|-------|
| `pending` | Communicated/applied, no outcome yet |
| `overdue` | Applied 5+ days ago, still no outcome |
| `all` | Already recorded outcomes |

## API

| Method | Path |
|--------|------|
| GET | `/agronomist/outcome-review?filter=pending` |
| GET | `/agronomist/outcome-review/:id` |
| POST | `/agronomist/outcome-review/:id/record` |

## UI

**Agronomist Hub → Outcome review tab**

- Queue with pending count
- Recommendation text + issue + AI confidence
- WhatsApp follow-up farmer response (if any)
- Structured outcome picker: Resolved / Partial / No improvement / Unknown
- Recovery days, farmer feedback, agronomist assessment
- **Save outcome & next** — batch review flow

## Training loop

On save:
1. Updates `recommendation_records` with structured outcome
2. Completes `recommendation_follow_ups` outcome_check phase
3. Upserts `ai_learning_samples`
4. Promotes to reuse cache when outcome is better/partial

## Next stage

Stage 7 — Training export pipeline (`ai_training_events`, `crop_images`, `ai_learning_samples`).
