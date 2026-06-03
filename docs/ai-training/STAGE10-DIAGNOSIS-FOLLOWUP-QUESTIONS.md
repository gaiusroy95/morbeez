# STAGE 10 — Sequential follow-up intelligence (operational AI)

## What this implements (from Morbeez AI intelligence spec)

| Feature | Implementation |
|---------|----------------|
| **Sequential follow-up** | One question at a time on WhatsApp (`diagnosis_intake` state) |
| **Dynamic / reasoning questions** | `diagnosis-follow-up-reasoning.engine.ts` — weather, crop stage, issue family, spray history |
| **Conditional branching** | e.g. rain=yes → ask last fungicide spray |
| **Clickable buttons** | Yes/No, spray timing (7d / 14d+ / not yet) |
| **Smart image requests** | Close leaf photo, rhizome photo when rot suspected |
| **Similar case intelligence** | Matches `advisory_reuse_cases` with Malayalam/regional normalization |
| **Weather-aware** | Uses `contextPack` humidity/rain signals in questions + intro |
| **Crop stage (DAP)** | Late-stage questions when DAP ≥ 120 |
| **Confidence intelligence** | ≥90% + photo → skip follow-up; 70–90% → follow-up; &lt;70% → follow-up + escalate hint |
| **Learning memory** | Promotes to reuse on case review **submit for approval** (approve/correct/partial) |

## Confidence routing (pre-diagnosis)

| Match confidence | Typical action |
|------------------|----------------|
| **≥ 90%** + photo | Direct diagnosis / reuse (no follow-up) |
| **70–90%** | 2–3 sequential follow-up questions |
| **&lt; 70%** | Follow-up + agronomist escalation hint after intake |

## Code

- `diagnosis-follow-up-reasoning.engine.ts` — question planner + branching
- `diagnosis-follow-up.service.ts` — WhatsApp session, similar-case search, intake
- `whatsapp-scenario-router.service.ts` — `dfq.*` button handling
- `agronomist-case-review.service.ts` — indexes verified answers on submit for approval

## Env

```
ENABLE_DIAGNOSIS_FOLLOW_UP=true
ENABLE_AI_REUSE_CACHE=true
ENABLE_AI_CROP_DOCTOR=true
DIAGNOSIS_FOLLOW_UP_MIN_CASES=1
DIAGNOSIS_FOLLOW_UP_MAX_QUESTIONS=3
DIAGNOSIS_FOLLOW_UP_STRONG_MATCH=0.9
```

## Client test (English)

See `CLIENT-AI-TRAINING-TEST-GUIDE.md` — section **Test diagnosis follow-up (Farmer A → Farmer B)**.  
Use the **English** copy-paste messages for Farmer A (3 cases) and Farmer B.
