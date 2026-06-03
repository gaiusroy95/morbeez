# Stage 1 — Structured Input Foundation

Extends existing tables with canonical AI training fields. Migration: `20260647000000_ai_training_structured_inputs.sql`.

## What was added

### Farmers (`farmers`)

| Column | Type | Enum |
|--------|------|------|
| `farming_style` | TEXT | traditional, semi_commercial, commercial, organic, mixed |
| `experience_level` | TEXT | beginner, intermediate, experienced, expert |

Note: `crop_experience_years` already exists from FEX v2.

### Field findings (`crm_field_findings`)

| Column | Purpose |
|--------|---------|
| `finding_type` | Structured classification |
| `severity` | mild / moderate / severe |
| `affected_area_pct` | 0–100 |
| `ai_prediction` | AI label before human correction |
| `final_confirmed_issue` | Gold label after agronomist confirm |
| `weather_context` | JSONB snapshot summary |
| `weather_snapshot_id` | FK → `weather_snapshots` |

### Field activities (`cultivation_activities`)

| Column | Purpose |
|--------|---------|
| `dosage_structured` | JSONB `{ product, rate, method, frequency }` |
| `labour_used` | JSONB array of labour entries |
| `weather_snapshot_id` | FK → `weather_snapshots` |

### Weather (`weather_snapshots`) — new table

Captured automatically when field findings are created (if block linked).

| Column | Spec mapping |
|--------|--------------|
| `rainfall_mm` | rainfall |
| `humidity_pct` | humidity |
| `temperature_c` | temperature |
| `soil_moisture_pct` | soil moisture (future sensor integration) |
| `disease_alerts` | disease outbreak alerts |

Service: `backend/src/services/core/weather-snapshot.service.ts`

## API changes

Telecaller field finding create/patch accepts optional structured fields via `structuredFieldFindingSchema`:

- `findingType`, `severity`, `affectedAreaPct`
- `aiPrediction`, `finalConfirmedIssue`

## Next stage

Stage 2 adds `ai_training_events` as the unified correction spine.
