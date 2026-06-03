# Stage 8 — Weather Correlation Intelligence

## Purpose

Link **weather at event time** to field findings, corrections, and training exports so Morbeez AI can learn rainfall–disease patterns from operational data.

## Auto-capture points

Open-Meteo forecast is persisted to `weather_snapshots` when:

| Event | `event_type` | Wired in |
|-------|--------------|----------|
| Field finding | `field_finding` | `telecaller-admin.createFieldFinding` (Stage 1) |
| Crop image enqueue | `field_finding` | `crop-image-review.enqueue` (Stage 3) |
| AI advisory session | `ai_session` | `crop-doctor.diagnose`, telecaller escalation |
| CRM recommendation | `recommendation` | `crm-farmer.createRecommendation` |
| Recommendation record | `recommendation` | `recommendation-records.create` |
| Field activity | `field_activity` | `whatsapp-os-admin.createFieldActivity` |
| Training correction | `ai_session` / `field_finding` | `ai-training-event.record` (metadata + link) |

Training events **reuse** field-finding weather when `fieldFindingId` is set; otherwise capture fresh and store in `metadata.weatherSnapshotId` / `weatherContext`.

## Correlation analytics

`backend/src/services/core/weather-correlation.service.ts`

`GET /os/agronomist/weather-correlation?days=90`

Returns:

- Rainfall bands (dry / light / moderate / heavy) with disease–pest rate per band
- Post–heavy-rain disease rate vs dry baseline
- High-humidity (≥80%) disease signal rate
- Weather capture coverage by entity type
- Actionable `insights[]` for agronomists

## Training export (Stage 7 extension)

All export datasets now include weather columns where linked:

- `rainfallMm`, `rainfallForecastMm`, `humidityPct`, `temperatureC`, `weatherRiskScore`, `diseaseAlerts`
- New dataset: `weather` — raw `weather_snapshots` table
- JSON `all` export includes `weather` array

## UI

**Agronomist Hub → Training export** — Weather correlation section:

- Rainfall band table
- Heavy-rain and humidity KPIs
- Insight bullets
- CSV: `weather` dataset

## Training loop

```
Field visit / WhatsApp session
    → weather_snapshots (Open-Meteo)
    → crm_field_findings.weather_context
    → ai_training_events.metadata.weatherContext
    → training export JSON/CSV
    → offline correlation / model features
```

## Rollout

No new migration required — uses `weather_snapshots` from Stage 1.

Apply prior migrations if not yet run: `supabase db push`
