# Stage 7 — Training Export Pipeline

## Purpose

Export labeled operational data for offline model training, evaluation, and label QA — closing the loop from Stages 2–6.

## Service

`backend/src/services/core/training-export.service.ts`

| Method | Purpose |
|--------|---------|
| `getDashboardStats` | Correction rate, label accuracy, image QA, outcome success |
| `listQaFlags` | Auto-detected label mismatches and pending reviews |
| `setQaFlag` | Persist QA state in `metadata` on events/images |
| `exportDataset` | JSON (all) or CSV (single dataset) |

## API (Agronomist OS)

| Method | Path |
|--------|------|
| GET | `/os/agronomist/training-export/dashboard?days=30` |
| GET | `/os/agronomist/training-export/qa-flags?limit=40` |
| PATCH | `/os/agronomist/training-export/qa-flag` |
| GET | `/os/agronomist/training-export?dataset=all&format=json` |

### Export query params

| Param | Values | Default |
|-------|--------|---------|
| `dataset` | `events`, `images`, `samples`, `all` | `all` |
| `format` | `json`, `csv` | `json` |
| `since` | ISO datetime | 365 days ago |
| `limit` | 1–10000 | 2000 |

### QA flag body

```json
{
  "entityType": "training_event",
  "entityId": "uuid",
  "flag": "approved",
  "notes": "optional"
}
```

Flags: `needs_review`, `approved`, `excluded` — stored in row `metadata`.

## Datasets exported

### `events` — `ai_training_events`

Columns include: surface, source, crop, AI prediction/confidence, human action/label, `labelMatch`, QA flag, correction reason.

### `images` — `crop_images`

Columns include: crop, DAP, AI vs agronomist label, severity, review status, symptoms, URLs.

### `samples` — `ai_learning_samples`

Columns include: crop, disease label, severity, outcome, application confirmed, weather summary.

## Dashboard KPIs

| KPI | Source |
|-----|--------|
| Correction rate | `correct_ai` / `partial_match` on training events |
| Label accuracy | AI prediction === human final label |
| Image correction rate | `correct_ai` on reviewed images |
| Outcome success | `better` + `partial` on `recommendation_records` |
| QA queue | Flagged metadata + auto-detected mismatches |

## UI

**Agronomist Hub → Training export tab**

- Period selector (7–180 days)
- KPI cards
- Download: all JSON, per-dataset CSV
- QA flags table with Approve / Flag / Exclude actions

## Weather columns (Stage 8)

Exports include `rainfallMm`, `humidityPct`, `weatherRiskScore`, etc. when snapshots are linked. Dataset `weather` exports raw snapshots. See `STAGE8-WEATHER-CORRELATION.md`.
