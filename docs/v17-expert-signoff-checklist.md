# MORBEEZ v17 Expert Sign-Off Checklist

Use this checklist before enabling `MAIOS_REASONING_SHADOW=false` in production for a crop pilot.

## Knowledge content (expert-governed)

- [ ] LR matrix reviewed by lead agronomist for pilot crop
- [ ] Question bank validated against field protocol (no ambiguous double-barrel questions)
- [ ] Management rules contain **active ingredient classes only** — no product SKUs
- [ ] Safety rules cover rain, heat, PHI, and early crop stage for pilot crop
- [ ] `Unknown` prior weight documented and justified

## Gold-case regression gate

Run before each release that touches reasoning:

```bash
cd backend && node --import tsx --test tests/diagnosis-gold-cases.test.ts
```

### Ginger (minimum 4 cases — required)

| Case ID | Expected top diagnosis | Status |
|---------|------------------------|--------|
| `ginger_blast_rain_spindle` | Pyricularia blast | Required pass |
| `ginger_rhizome_rot_waterlogged` | Rhizome rot | Required pass |
| `ginger_thrips_silver` | Thrips | Required pass |
| `ginger_nutrient_yellowing` | Nutrient deficiency | Required pass |

### Tomato (2 cases — pilot)

| Case ID | Expected top diagnosis |
|---------|------------------------|
| `tomato_early_blight_rings` | Early blight |
| `tomato_late_blight_humid` | Late blight |

### Coconut (2 cases — pilot)

| Case ID | Expected top diagnosis |
|---------|------------------------|
| `coconut_bud_rot_rain` | Bud rot |
| `coconut_beetle_damage` | Rhinoceros beetle |

### Brinjal (2 cases — pilot)

| Case ID | Expected top diagnosis |
|---------|------------------------|
| `brinjal_bacterial_wilt` | Bacterial wilt |
| `brinjal_shoot_borer` | borer |

### Banana (minimum 4 cases — required for banana pilot)

| Case ID | Expected top diagnosis | Status |
|---------|------------------------|--------|
| `banana_sigatoka_humid` | Sigatoka | Required pass |
| `banana_panama_wilt` | Panama wilt | Required pass |
| `banana_weevil_borer` | Weevil borer | Required pass |
| `banana_nutrient_yellowing` | Nutrient deficiency | Required pass |

## Staging activation

See `docs/v17-staging-activation.md` for `MAIOS_REASONING_SHADOW=false` rollout steps.

## Channel integration

- [ ] Visit wizard attaches `reasoningSnapshot` on analyze/reanalyze
- [ ] Visit case closure records agronomist-verified label via learning facade
- [ ] Agronomist escalation `submitReview` returns `learningFacadeRecorded: true`
- [ ] WhatsApp crop-doctor passes `visionObservations` + investigation Q&A
- [ ] `POST /api/v1/diagnosis/start` returns `finalReport` on every run

## LLM demotion (only after gold cases pass)

- [ ] `MAIOS_REASONING_SHADOW=false` tested on staging for visit + WhatsApp
- [ ] Agronomist confirms Bayesian top diagnosis matches field judgment on 10 real cases
- [ ] LLM still produces farmer-facing language; diagnosis label comes from posterior

## Learning governance

- [ ] Regional stats update on agronomist verify (visit close)
- [ ] LR matrix **never** auto-updated — confirmed in logs (`lrMatrixUpdated: false`)
- [ ] Expert correction workflow documented for LR matrix changes (manual PR to `*.v1.ts`)

## Sign-off

| Role | Name | Date | Crop pilot |
|------|------|------|------------|
| Lead agronomist | | | |
| Backend lead | | | |
| Product owner | | | |
