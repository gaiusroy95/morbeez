# Stage 2 — Unified Correction Spine

Migration: `20260648000000_ai_training_events.sql`

## Purpose

Every human correction — regardless of which UI surface it came from — writes to `ai_training_events`. This is the supervised learning dataset for diagnosis corrections.

## Table: `ai_training_events`

| Column | Purpose |
|--------|---------|
| `ai_prediction` | What AI predicted |
| `ai_confidence` | Score at prediction time |
| `ai_top_k` | Ranked hypotheses JSONB |
| `human_action` | approve_ai / correct_ai / partial_match / … |
| `human_final_label` | Gold label after review |
| `correction_reason` | Learning notes |
| `review_surface` | case_review / farmer_feedback / … |
| `confidence_before` / `confidence_after` | Confidence delta |

## Wired surfaces

| Surface | Service method | Trigger |
|---------|----------------|---------|
| Case review | `recordFromCaseReview` | `agronomistCaseReviewService.submitReview` |
| Farmer feedback | `recordFromFarmerFeedback` | `farmerExperienceLearningService.review` |

## Query example

```sql
SELECT ai_prediction, human_final_label, human_action, review_surface
FROM ai_training_events
WHERE ai_prediction IS DISTINCT FROM human_final_label
ORDER BY reviewed_at DESC;
```

## Next stage

Stage 3 adds `crop_images` table + Image Review UI.
