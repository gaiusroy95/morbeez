# STAGE 10 — Sequential follow-up intelligence (operational AI)

## What this implements (from Morbeez AI intelligence spec)

| Feature | Implementation |
|---------|----------------|
| **Sequential follow-up** | One question at a time on WhatsApp (`diagnosis_intake` state) |
| **Expert follow-up library** | Each expert approval saves 1–3 AI-generated questions + intake Q&A to `learned_follow_up_questions` |
| **Reuse as-is** | Similar farmer complaint → expert-saved questions sent verbatim first; AI adds more only if needed |
| **Dynamic extra questions** | After saved queue, OpenAI plans new questions when more evidence is needed |
| **Clickable buttons** | Yes/No, spray timing (7d / 14d+ / not yet) |
| **Similar case intelligence** | Matches `advisory_reuse_cases` with Malayalam/regional normalization |
| **Weather-aware** | Uses `contextPack` humidity/rain signals in intro |
| **Confidence intelligence** | ≥90% + photo → skip follow-up; 70–90% → follow-up; &lt;70% → follow-up + escalate hint |
| **Learning memory** | Promotes diagnosis to reuse on case review **submit for approval** |

## Expert review → follow-up learning loop

```
Agronomist submits case (approve / correct / partial + submit for approval)
        ↓
Save WhatsApp intake Q&A (if any) to learned_follow_up_questions
        ↓
AI generates 1–3 NEW questions for this symptom + diagnosis (skips duplicates)
        ↓
Next farmer with similar complaint → saved questions reused AS-IS
        ↓
Farmer answers → AI may ask more → Crop Doctor uses ALL answers for diagnosis
```

## Confidence routing (pre-diagnosis)

| Match confidence | Typical action |
|------------------|----------------|
| **≥ 90%** + photo | Direct diagnosis / reuse (no follow-up) |
| **70–90%** | 2–3 sequential follow-up questions |
| **&lt; 70%** | Follow-up + agronomist escalation hint after intake |

## Code

- `expert-follow-up-learning.service.ts` — generate + persist on case review; lookup for farmer intake
- `diagnosis-follow-up-question.generator.ts` — AI planner for additional questions after saved queue
- `diagnosis-follow-up-reasoning.engine.ts` — intro, field investigation summary, post-intake payload
- `diagnosis-follow-up.service.ts` — WhatsApp session, saved-question queue, one-question-at-a-time intake
- `agronomist-case-review.service.ts` — triggers expert follow-up save on submit for approval

## Env

```
ENABLE_DIAGNOSIS_FOLLOW_UP=true
ENABLE_AI_REUSE_CACHE=true
ENABLE_AI_CROP_DOCTOR=true
OPENAI_API_KEY=...
DIAGNOSIS_FOLLOW_UP_MIN_CASES=1
DIAGNOSIS_FOLLOW_UP_MAX_QUESTIONS=3
DIAGNOSIS_FOLLOW_UP_STRONG_MATCH=0.9
```

## Client test (English)

See `CLIENT-AI-TRAINING-TEST-GUIDE.md` — section **Test diagnosis follow-up (Farmer A → Farmer B)**.  
Use the **English** copy-paste messages for Farmer A (3 cases) and Farmer B.
