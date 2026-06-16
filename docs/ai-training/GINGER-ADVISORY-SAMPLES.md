# Ginger Advisory — Sample Soil Reports & Test Scenarios

Sample data for visit wizard **Soil & weather** step, AI diagnosis QA, and end-to-end advisory workflow testing.

## Apply sample data

```bash
supabase db push
```

Migration: `supabase/migrations/20260722000000_ginger_advisory_soil_samples.sql`

## Demo farmer

| Field | Value |
|-------|--------|
| Name | Ginger Advisory Demo |
| Phone | +919876543210 |
| Village | Sulthan Bathery |
| District | Wayanad |
| Farmer ID | `e0000000-0000-4000-8000-000000000001` |

Search **"Ginger Advisory Demo"** in agronomist or partner app to start a visit on any sample block.

---

## Scenario 1 — Rhizome Rot Risk

| | |
|--|--|
| **Block** | Ginger S1 — Rhizome Rot |
| **Block ID** | `e0000000-0000-4000-8000-000000000011` |
| **Stage** | Vegetative (~90 DAS) |
| **Tests** | Disease detection + photo validation |

### Soil report

| Parameter | Value | Status |
|-----------|-------|--------|
| pH | 5.8 | Good |
| EC | 0.6 dS/m | Normal |
| Organic Carbon | 0.9% | Good |
| Nitrogen | 280 kg/ha | Adequate |
| Phosphorus | 42 kg/ha | Adequate |
| Potassium | 310 kg/ha | Adequate |
| Calcium | 350 ppm | Good |
| Zinc | 1.2 ppm | Good |

**Field observations:** yellowing patches, wilting, pseudostems collapsing  
**Weather:** heavy rainfall ~10 days  
**Expected AI issue:** Rhizome Rot (~78% confidence in spec)

---

## Scenario 2 — Potassium & Magnesium Deficiency

| | |
|--|--|
| **Block** | Ginger S2 — K/Mg Deficiency |
| **Block ID** | `e0000000-0000-4000-8000-000000000012` |
| **Stage** | Rhizome Development |
| **Tests** | Soil-report-driven diagnosis (not disease) |

### Soil report

| Parameter | Value | Status |
|-----------|-------|--------|
| pH | 7.3 | Normal |
| EC | 0.5 dS/m | Normal |
| Organic Carbon | 0.45% | Low |
| Nitrogen | 260 kg/ha | Adequate |
| Phosphorus | 35 kg/ha | Adequate |
| Potassium | 85 kg/ha | Deficient |
| Magnesium | 45 ppm | Deficient |
| Zinc | 0.8 ppm | Normal |

**Field observations:** leaf edge scorching, yellow margins, reduced vigor  
**Expected issues:** Potassium Deficiency, Magnesium Deficiency

---

## Scenario 3 — Waterlogging E2E (recommended full workflow test)

| | |
|--|--|
| **Block** | Ginger S3 — Waterlogging E2E |
| **Block ID** | `e0000000-0000-4000-8000-000000000013` |
| **Stage** | ~120 DAS |
| **Tests** | Multi-issue, Q&A, rec groups, monitoring, callbacks |

### Soil report

| Parameter | Value | Status |
|-----------|-------|--------|
| pH | 8.2 | High |
| EC | 2.2 dS/m | High |
| Organic Carbon | 0.28% | Low |
| Nitrogen | 110 kg/ha | Low |
| Phosphorus | 18 kg/ha | Low |
| Potassium | 95 kg/ha | Low |
| Calcium | 140 ppm | Low |
| Zinc | 0.3 ppm | Deficient |

**Field observations:** standing water, yellowing, stunted growth, soft rhizomes  
**Expected issues:** Waterlogging, Early Rhizome Rot, N deficiency, Zn deficiency

---

## Why these three?

| Scenario | What it validates |
|----------|-------------------|
| S1 Rhizome Rot | Disease + photos + wet weather context |
| S2 K/Mg Deficiency | Lab-driven nutrient diagnosis |
| S3 Waterlogging | Full 16-step workflow in one visit |

## Code reference

Structured samples (for tests): `backend/src/domain/advisory/ginger-advisory-samples.ts`

After migration, open visit wizard → **Soil** step on any sample block to see the full lab panel populated from `crm_soil_reports.metrics`.
