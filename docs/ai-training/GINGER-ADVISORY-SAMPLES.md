# Ginger Advisory — Sample Soil Reports & Test Scenarios

Sample data for visit wizard **Soil & weather** step, AI diagnosis QA, and end-to-end advisory workflow testing.

## Apply sample data

```bash
supabase db push
```

Migrations:

- `20260722000000_ginger_advisory_soil_samples.sql` — 3 ginger blocks + soil reports
- `20260723000000_ginger_advisory_retarget_farmer.sql` — removes demo farmer if present; binds samples to **+916282873542**

## Target farmer

| Field | Value |
|-------|--------|
| Phone | **+916282873542** (also matches `6282873542`) |
| Blocks | 3 ginger scenario plots added under this farmer |

Open this farmer in the agronomist or partner app — you should see three new ginger blocks:

| Scenario | Block name | Block ID |
|----------|------------|----------|
| S1 Rhizome Rot | Ginger S1 — Rhizome Rot | `e0000000-0000-4000-8000-000000000011` |
| S2 K/Mg Deficiency | Ginger S2 — K/Mg Deficiency | `e0000000-0000-4000-8000-000000000012` |
| S3 Waterlogging E2E | Ginger S3 — Waterlogging E2E | `e0000000-0000-4000-8000-000000000013` |

---

## Scenario 1 — Rhizome Rot Risk (~90 DAS)

| Parameter | Value | Status |
|-----------|-------|--------|
| pH | 5.8 | Good |
| EC | 0.6 dS/m | Normal |
| Organic Carbon | 0.9% | Good |
| N / P / K | 280 / 42 / 310 kg/ha | Adequate |
| Calcium | 350 ppm | Good |
| Zinc | 1.2 ppm | Good |

**Tests:** disease detection + photo validation after wet weather.

---

## Scenario 2 — Potassium & Magnesium Deficiency

| Parameter | Value | Status |
|-----------|-------|--------|
| pH | 7.3 | Normal |
| Organic Carbon | 0.45% | Low |
| Potassium | 85 kg/ha | Deficient |
| Magnesium | 45 ppm | Deficient |

**Tests:** soil-report-driven nutrient diagnosis (not disease).

---

## Scenario 3 — Waterlogging E2E (~120 DAS)

| Parameter | Value | Status |
|-----------|-------|--------|
| pH | 8.2 | High |
| EC | 2.2 dS/m | High |
| N / P / K | 110 / 18 / 95 kg/ha | Low |
| Zinc | 0.3 ppm | Deficient |

**Tests:** full 16-step workflow — multi-issue, rec groups, monitoring, Q&A.

---

## Code reference

`backend/src/domain/advisory/ginger-advisory-samples.ts` — structured metrics for tests (`GINGER_ADVISORY_SAMPLE_PHONE`).

After `supabase db push`, start a visit on any sample block → **Soil** step shows the lab panel from `crm_soil_reports.metrics`.
