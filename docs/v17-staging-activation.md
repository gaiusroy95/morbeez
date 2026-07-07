# MORBEEZ v17 Staging Activation Guide

Use this guide to enable Bayesian-owned diagnosis on staging **after** gold-case tests pass and expert sign-off is complete.

## Automated pre-flight (run first)

From the repo root:

```bash
cd backend && node --import tsx scripts/v17-staging-validate.ts
```

This script:

1. Checks `ENABLE_MAIOS_REASONING`, `ENABLE_STRUCTURED_VISION`, and `MAIOS_REASONING_SHADOW`
2. Runs the gold-case regression gate (ginger, banana, tomato, coconut, brinjal)
3. Prints the manual field checklist below

Set staging env vars **before** running if you want a green env check:

```bash
export ENABLE_MAIOS_REASONING=true
export ENABLE_STRUCTURED_VISION=true
export MAIOS_REASONING_SHADOW=false
```

On Windows PowerShell:

```powershell
$env:ENABLE_MAIOS_REASONING="true"
$env:ENABLE_STRUCTURED_VISION="true"
$env:MAIOS_REASONING_SHADOW="false"
```

## Prerequisites

1. All tests green:

```bash
cd backend && node --import tsx --test tests/diagnosis-gold-cases.test.ts tests/maios-reasoning.test.ts tests/plant-id-vision-features.test.ts
```

2. Expert sign-off checklist completed: `docs/v17-expert-signoff-checklist.md`

## Staging environment variables

Set on the staging API host (Render / `.env.staging`):

```bash
# Core reasoning (defaults true — confirm explicitly on staging)
ENABLE_MAIOS_REASONING=true
ENABLE_STRUCTURED_VISION=true

# LLM demotion — Bayesian owns diagnosis ranking + probableIssue
MAIOS_REASONING_SHADOW=false
```

Keep `MAIOS_REASONING_SHADOW=true` in production until pilot sign-off.

## Verification checklist (staging)

### Visit wizard

1. Run a ginger field visit with photos + Q&A.
2. Confirm API response includes `reasoning.finalReport`.
3. Confirm top hypothesis matches Bayesian posterior (not LLM order).
4. Confirm first follow-up question matches EVSI knowledge pack when `decision.action=CONTINUE`.
5. Close case with agronomist verify → check logs for `MAIOS v17 agronomist-verified visit outcome recorded`.

### WhatsApp crop-doctor

1. Send diagnosis with photo + symptoms (test ginger, tomato, banana, coconut pilots).
2. Confirm `maiosCase.reasoning` on session metadata.
3. Confirm `probableIssue` matches posterior top label (shadow off).
4. When confidence is below review threshold, confirm post-diagnosis Q&A uses EVSI question (knowledge pack text, `fromEvsi: true` in session).

### Structured vision (Plant.id path)

1. Send crop photo via WhatsApp or visit wizard.
2. Confirm `maiosCase.reasoning.evidence` includes vision keys (e.g. `symptom:concentric_rings` for tomato, `symptom:yellow_streak` for banana).
3. Plant.id disease names should map to structured features without LLM re-ranking.

### Escalation case review

1. Approve or correct an escalated case in agronomist OS.
2. Confirm API response `learningFacadeRecorded: true`.
3. Confirm regional issue stat incremented (`lrMatrixUpdated: false` in logs).

### v17 diagnosis API

```bash
curl -X POST "$API_BASE/api/v1/diagnosis/start" \
  -H "x-api-key: $INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone":"919999999999","cropType":"ginger","symptomsText":"Spindle lesions after rain"}'
```

Expect `finalReport`, `nextEvidence`, and `posterior` in response.

Repeat for `cropType` = `banana`, `tomato`, `coconut`, `brinjal`.

## Rollback

Set `MAIOS_REASONING_SHADOW=true` and redeploy. No database migration required — reasoning is additive metadata only.

Verify rollback:

```bash
# After redeploy with shadow=true
curl .../diagnosis/start  # reasoning attached; LLM still owns visit/WhatsApp ranking
```

## Production promotion criteria

- [ ] 10 real-field cases reviewed by agronomist — Bayesian top matches expert judgment ≥8/10
- [ ] Gold cases pass on CI for pilot crop(s) — **14 cases** (4 ginger + 4 banana + 2 tomato + 2 coconut + 2 brinjal)
- [ ] Sign-off table completed in `docs/v17-expert-signoff-checklist.md`
- [ ] Rollback tested on staging
- [ ] `v17-staging-validate.ts` exits 0 with staging env vars set

## Pilot crop matrix

| Crop | Knowledge pack | Gold cases | Vision features |
|------|----------------|------------|-----------------|
| Ginger | `ginger.v1.ts` | 4 | spindle, grey center, black dots, silver streak, soft rot |
| Banana | `banana.v1.ts` | 4 | yellow/parallel streak, wilt, borer hole |
| Tomato | `tomato.v1.ts` | 2 | concentric rings, water-soaked, yellowing |
| Coconut | `coconut.v1.ts` | 2 | bud rot, beetle damage, wilt, yellowing |
| Brinjal | `brinjal.v1.ts` | 2 | wilt, borer hole, concentric rings |

Other crops use `default.v1.ts` fallback until expert packs are added.
