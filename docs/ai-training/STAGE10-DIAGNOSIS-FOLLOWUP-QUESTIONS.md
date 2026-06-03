# STAGE 10 — Diagnosis follow-up questions (learned cases)

## Goal

Before running full Crop Doctor, WhatsApp can ask **1–2 short follow-up questions** derived from **similar verified cases** in `advisory_reuse_cases` (staff-approved / good-outcome reuse). Answers enrich the symptom text so reuse matching and AI diagnosis are more accurate — without waiting for a human agronomist.

## Flow

1. Farmer sends a crop problem (text, or photo + caption).
2. If `ENABLE_DIAGNOSIS_FOLLOW_UP=true` and `ENABLE_AI_REUSE_CACHE=true`, and there are at least `DIAGNOSIS_FOLLOW_UP_MIN_CASES` (default 3) similar cases for that crop:
   - Session state → `diagnosis_intake`
   - WhatsApp sends intro + up to 2 yes/no buttons (`dfq.yes.*` / `dfq.no.*`) and optionally a photo request
3. Farmer answers; on completion state returns to `diagnosis` and **Crop Doctor** runs with enriched symptoms (includes best matching issue label hint).
4. `aiReuseService.tryReuse` inside Crop Doctor may still return a cached verified advisory if the enriched text matches strongly.

## Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `ENABLE_DIAGNOSIS_FOLLOW_UP` | `true` | Master switch |
| `ENABLE_AI_REUSE_CACHE` | `true` | Required — similarity source |
| `DIAGNOSIS_FOLLOW_UP_MAX_QUESTIONS` | `2` | Cap on yes/no questions (photo counts separately) |
| `DIAGNOSIS_FOLLOW_UP_MIN_CASES` | `3` | Minimum similar verified cases to start intake |
| `DIAGNOSIS_FOLLOW_UP_STRONG_MATCH` | `0.88` | Skip intake when top match is already very strong |

## Code

- `backend/src/services/whatsapp/pipeline/diagnosis-follow-up.service.ts`
- Router: `diagnosis_intake` + `dfq.*` in `whatsapp-scenario-router.service.ts`
- Pipeline: `startIntake` before text/image diagnosis in `whatsapp-inbound.pipeline.ts`

## Testing (live)

1. Ensure several **approved** case reviews for the same crop exist (reuse cases promoted via learning loop).
2. From a test farmer WhatsApp, describe symptoms similar to those cases (e.g. ginger leaf spots).
3. Expect 1–2 follow-up questions before the “analyzing” / advisory reply.
4. Answer Yes/No (or send photo / type `skip`).
5. Confirm final advisory aligns with the closest learned issue.

## Relation to training export

Training export builds datasets for **future model training**. This stage uses **already verified reuse rows** on every message — no export file required.
