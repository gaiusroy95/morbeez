# MAIOS v12 — Manual QA Checklist

## Prerequisites

1. Apply migrations: `20260802000000_maios_crop_packs.sql`, `20260803000000_maios_crop_packs_seed.sql`
2. Confirm `.env`: `ENABLE_MAIOS_V12=true`, `MAIOS_DISABLE_GENERIC_OUTCOME=true`
3. Start backend + automation worker (`ENABLE_ADVISORY_AUTOMATION=true`)

## End-to-end flow

1. **WhatsApp diagnosis** — Send crop photo + symptoms for ginger or banana
   - Verify session `metadata.maiosCase` is written (not `gingerSopV3` for new cases)
   - Verify evidence tier, EQS, module scores present

2. **Follow-up intake** — Trigger diagnosis follow-up when evidence is low
   - Verify follow-up question references missing photo slot (evidence gap)

3. **Agronomist review** — Open case in agronomist hub
   - Verify MAIOS panel shows: outcomes, predictive risk, lab, resistance, supply, causal chain (when LLM returns them)

4. **Recovery loop** — After recommendation communicated
   - Verify `maios_recovery_d3/d7/d14` jobs scheduled (not `ginger_sop_recovery_*`)
   - Tap Improved / Same / Worse buttons
   - Worse → telecaller task + `failureType` on case + `ml_gold_queue` row

5. **KPI API** — `GET /morbeez-staff/api/v1/os/analytics/maios?days=30`
   - Verify `casesWithMaios`, `d14RecoveryRate`, `avgEqs` return

6. **Analytics UI** — Open Analytics hub → MAIOS v12 tab
   - KPI cards render from API

## Regression

- `npm run typecheck` passes
- `node --test tests/maios-case.test.ts tests/maios-integration.test.ts tests/ginger-sop.test.ts` passes
