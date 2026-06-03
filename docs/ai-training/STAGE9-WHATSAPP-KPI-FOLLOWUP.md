# Stage 9 — Scalable WhatsApp KPI Outcome Follow-up

## Architecture

```text
Recommendation sent
  → Day 1: application check (existing)
  → Day 5–7: structured outcome KPI (4 options + optional photo)
  → AI interprets free-text / photo when needed
  → Success: auto-record outcome + promote reuse memory
  → Failure / uncertain / severe: agronomist "Verify KPI" queue only
  → No response: reminder → flag for human follow-up
```

## Layer 1 — Automated WhatsApp KPI

- **Service:** `recommendation-follow-up.service.ts`
- **Copy:** `recommendation-follow-up-copy.ts` (EN + ML + TA/KN/HI fallback)
- Farmer sees 4 structured options (list or buttons):
  1. Fully improved
  2. Slightly improved
  3. No improvement
  4. Worse
- Optional leaf photo acknowledged and stored on `outcome_kpi.photoUploaded`

## Layer 2 — AI interpretation

- **Service:** `outcome-kpi-interpretation.service.ts`
- Parses button IDs, numbers 1–4, keywords, then optional OpenAI JSON classify
- **Routing:** `outcome-human-routing.service.ts`

Human review triggered for:

- Worsened / no improvement
- High severity case
- Uncertain AI classification (&lt; 60% confidence)
- High-value farmer metadata
- Repeat failed outcomes (90 days)
- Random QA sample (~5%, `REC_OUTCOME_QA_SAMPLE_PCT`)

## Layer 3 — Human verification (selective)

- **Agronomist Hub → Outcome review → Verify KPI** filter
- Columns: `needs_human_outcome_review`, `human_outcome_review_reason`, `outcome_kpi` JSONB
- Manual save clears verification flag and sets `outcome_source = agronomist`

## KPI dashboard

- **UI:** `FollowUpKpiPanel.tsx` on Outcome review tab
- **API:** `GET /os/agronomist/follow-up/kpis?days=30`

## Migration

`20260652000000_whatsapp_kpi_followup.sql`

## Env (optional)

| Variable | Default |
|----------|---------|
| `REC_FOLLOWUP_OUTCOME_DAYS` | 5 |
| `REC_FOLLOWUP_OUTCOME_REMINDER_DAYS` | 2 |
| `REC_FOLLOWUP_MAX_OUTCOME_REMINDERS` | 2 |
| `REC_FOLLOWUP_OUTCOME_NO_RESPONSE_DAYS` | 3 |
| `REC_OUTCOME_QA_SAMPLE_PCT` | 5 |

Requires `ENABLE_ADVISORY_FOLLOW_UPS=true`.
