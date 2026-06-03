# Morbeez AI Training — Client Self-Test Guide

This guide lets your team **run a full AI training test without a developer present**, then **review the results later** in the staff console and export.

**What you are testing:** the closed loop where the system learns from real operations:

```text
Farmer reports issue (WhatsApp)
  → AI predicts diagnosis
  → Staff correct or approve
  → Field data and outcomes are recorded
  → Training data can be exported for model improvement
```

**Time needed:** about **30–45 minutes** for the main path, plus **5–10 minutes** a few days later for outcome review.

---

## 1. Before you start (one-time setup)

Your technical contact (developer or IT) should confirm these are done on the **same environment** you will test (staging or production).

| Requirement | Why it matters |
|-------------|----------------|
| Database migrations applied | Tables such as `ai_training_events`, `crop_images`, `weather_snapshots` must exist |
| API and staff console deployed | Latest build with Agronomist **Training export** tab |
| WhatsApp connected to this API | Farmer messages must reach Morbeez backend |
| **Test farmer** in the system | Phone on WhatsApp must match `farmers.phone` |
| Test farmer has a **crop block** (e.g. ginger) | Better AI context and weather |
| Staff accounts with correct roles | See [Roles](#5-who-does-what) below |

### Staff console URL

Open the Morbeez staff portal in a browser:

```text
https://<YOUR-API-HOST>/morbeez-staff/
```

Examples: your staging API domain or production API domain. **Do not** use a separate Vite-only dev URL unless your developer told you to.

Log in with the accounts your team normally uses (agronomist, telecaller, admin).

### Test farmer checklist

- [ ] Farmer name and phone are correct in CRM / farmer list  
- [ ] `preferred_language` is set (`ml` for Malayalam, `en` for English)  
- [ ] At least one active farm block with crop type (e.g. ginger)  
- [ ] You know the farmer’s phone number for WhatsApp testing  

**Tip:** Use a dedicated test farmer, not a real paying customer, unless your team agrees.

### Optional: confidence thresholds (developer setting)

These environment values control auto-send vs human review (defaults are fine for most tests):

| Setting | Default | Meaning |
|---------|---------|---------|
| `AI_AUTO_SEND_THRESHOLD` | 0.95 | At or above → AI may send without agronomist |
| `AI_REVIEW_THRESHOLD` | 0.80 | Between review and auto → telecaller validation band |
| Below 0.80 | — | Stronger escalation messaging to farmer |

You do not need to change these to complete a training test. For a **richer training record**, agronomists should use **Correct AI** at least once (see Step 3).

---

## 2. What you will do (overview)

| Step | Who | When | Where |
|------|-----|------|--------|
| A | Farmer | Day 0 | WhatsApp |
| B | Agronomist | Day 0 | Staff → **Agronomist Hub** |
| C | Telecaller (optional) | Day 0–2 | Staff → **Telecaller CRM** |
| D | Agronomist | Day 5–14 | **Outcome review** tab |
| E | Admin / lead agronomist | Anytime after B | **Training export** tab |

---

## 3. Step A — Farmer sends an issue on WhatsApp

**Goal:** Create one new AI advisory session with a photo and symptoms.

### Instructions (give to the test farmer or use the test phone yourself)

1. From the **registered** WhatsApp number, send a clear message describing the problem.  
   Example (English): `Ginger leaves have white streaks and yellow spots`  
   Example (Malayalam): `ഇഞ്ചി ഇലയിൽ വെള്ള പട്ടയും മഞ്ഞ പുള്ളിയും ഉണ്ട്`

2. Send **one or two clear photos** of affected leaves (good light, in focus).

3. Follow any bot prompts if shown (crop/plot, etc.).

### What the farmer should receive

- A WhatsApp reply with crop advice (casual, farmer-friendly language).  
- Possibly a note that the agronomist team will review (if confidence is low).

### Quick check (if you have Supabase access)

Within about **1 minute**, your developer can run:

```sql
SELECT id, status, confidence_score, confidence_band, auto_sent, created_at
FROM ai_advisory_sessions
WHERE farmer_id = '<TEST_FARMER_UUID>'
ORDER BY created_at DESC
LIMIT 3;
```

You should see a **new row** with recent `created_at`.

Also:

```sql
SELECT id, status, reason, confidence_at_escalation, created_at
FROM agronomist_escalations
WHERE farmer_id = '<TEST_FARMER_UUID>'
ORDER BY created_at DESC
LIMIT 3;
```

A new **pending** (or open) case should appear for Case review.

**If nothing appears:** WhatsApp webhook or farmer phone mismatch — contact your developer (Section 8).

---

## 4. Step B — Agronomist reviews the case (core training step)

**URL:** `https://<YOUR-API-HOST>/morbeez-staff/agronomist`  
**Tab:** **Case review**

### 4.1 Open the queue

1. Log in as an **agronomist** (or role with agronomist hub access).  
2. Open **Agronomist Hub** → **Case review**.  
3. Filter **Open** cases.  
4. Find the test farmer (sort by newest if needed).  
5. Open the case.

### 4.2 Review content

Check:

- Farmer message / symptoms  
- AI **probable issue** and **confidence** (badges on the panel)  
- Photos attached to the session  
- Suggested WhatsApp reply text  

### 4.3 Submit a review (important for training data)

For a meaningful training test, do **one** of the following:

| Action | When to use | Training value |
|--------|-------------|----------------|
| **Correct AI** | AI label is wrong or incomplete | **Best** — creates correction in `ai_training_events` |
| **Approve AI** | AI is fully correct | Still logged; label matches AI |

Steps:

1. Choose **Approve AI** or **Correct AI**.  
2. Set **severity** (low / medium / high).  
3. If correcting: pick the **confirmed diagnosis** from the label picker.  
4. Adjust the **WhatsApp message** if needed (simple, casual language).  
5. Add **learning notes** if your process uses them.  
6. Submit (**Save & send** or submit for approval if your org requires a second approver).

### 4.4 Image review (same day, if photo was sent)

**Tab:** **Image review**

1. Open pending images.  
2. Find the test farmer’s image.  
3. **Confirm AI** or **Correct AI** with label and severity.

This adds image-level training rows in `crop_images` and related events.

### Expected result after Step B

- Case leaves the open queue (or status updates).  
- Farmer may receive the approved recommendation on WhatsApp (depending on approval workflow).  
- Training pipeline has at least one **case review** event.

---

## 5. Step C — Telecaller field follow-up (optional)

Use this to test **structured field data** and the **operational chain** (interaction → finding → recommendation).

**URL:** `https://<YOUR-API-HOST>/morbeez-staff/telecaller`

1. Search for the test **lead / farmer**.  
2. Open the **WhatsApp** tab — confirm the farmer’s messages appear.  
3. **Add interaction** — log a call or visit.  
4. Enable **Add field finding** and fill structured fields:  
   - **Finding type**  
   - **Severity**  
   - **Confirmed issue** (diagnosis picker — not only free text)  
5. Save.  
6. Open the interaction → confirm **Operational chain** shows finding (and recommendation/escalation if linked).  
7. **Field findings** tab — confirm the new row shows type, issue, severity.

This feeds structured inputs and weather linkage used in later export.

---

## 6. Step D — Outcome review (a few days later)

**Goal:** Record whether the recommendation helped — closes the learning loop.

**When:** **5–14 days** after the recommendation was sent, or when your follow-up process schedules it.

**Tab:** **Outcome review**

1. Open **Agronomist Hub** → **Outcome review**.  
2. Find the test farmer’s pending recommendation.  
3. Record outcome, for example:  
   - Better / partial improvement / no improvement  
   - Recovery days (if applicable)  
   - Short farmer feedback notes  

### Expected result

- Recommendation outcome stored for analytics and export (`samples` dataset).  
- Outcome success metrics update on the training dashboard.

---

## 7. Step E — See results (Training export)

**When:** Anytime after Step B; best after Steps C and D if you ran them.

**Tab:** **Training export**  
**URL:** same Agronomist Hub → **Training export**

### 7.1 Dashboard (on screen)

Review KPIs such as:

- Correction rate  
- Label accuracy  
- Image QA counts  
- Outcome success (if outcomes were recorded)  

Adjust the **days** filter (e.g. 7 or 30) to include your test date.

### 7.2 Weather correlation (on screen)

Scroll to **Weather correlation** — rainfall bands and insights for the selected period. Confirms weather was captured with sessions/findings.

### 7.3 QA flags (on screen)

Review auto-flagged label mismatches. You can mark flags **approved** or **excluded** if your role has write access.

### 7.4 Download export file

1. Choose dataset: **All** (recommended for a full test) or Events / Images / Samples.  
2. Choose format: **JSON** (recommended) or CSV for a single dataset.  
3. Click export / download.  
4. Open the file and search for your test farmer’s phone, name, or diagnosis labels.

**What to look for in the JSON export:**

| Section | Your test should include |
|---------|---------------------------|
| `events` | Rows with `review_surface` = `case_review`, your AI prediction and human label |
| `images` | Rows if you completed Image review |
| `samples` | Rows if outcome or learning samples were created |
| `weather` | Snapshots linked to sessions or findings |

Filename pattern: `morbeez-training-export-YYYY-MM-DD.json`

### 7.5 SQL verification (optional, Supabase)

If your team has database access:

```sql
-- Corrections (gold labels differ from AI)
SELECT reviewed_at, review_surface, ai_prediction, human_final_label, human_action, crop_type
FROM ai_training_events
WHERE farmer_id = '<TEST_FARMER_UUID>'
ORDER BY reviewed_at DESC
LIMIT 20;
```

```sql
-- Images reviewed
SELECT id, ai_prediction, agronomist_label, review_status, created_at
FROM crop_images
WHERE farmer_id = '<TEST_FARMER_UUID>'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 8. Roles — who does what

| Role | Steps |
|------|--------|
| **Farmer / test phone** | Step A — WhatsApp only |
| **Agronomist** | Steps B, D, E (Case review, Image review, Outcome review, Training export) |
| **Telecaller** | Step C (optional) |
| **Admin / super agronomist** | Approvals tab if recommendations need second sign-off; full export |

---

## 9. End-to-end test checklist (printable)

Copy this for each test run. Write the **test date** and **farmer name**.

```text
Test run ID: ___________   Date: ___________   Farmer: ___________

[ ] Prerequisites confirmed (migrations, WhatsApp, test farmer in system)
[ ] A — WhatsApp: symptoms + photo sent
[ ] A — New ai_advisory_sessions row (developer or SQL check)
[ ] B — Case review: Correct AI or Approve AI submitted
[ ] B — Image review completed (if photo sent)
[ ] C — (Optional) Telecaller structured field finding + interaction chain
[ ] D — Outcome review recorded (5–14 days later)
[ ] E — Training export dashboard shows activity in date range
[ ] E — JSON export downloaded and contains test farmer data
[ ] E — Weather section visible on Training export tab
```

---

## 10. Troubleshooting

| Problem | Likely cause | What to do |
|---------|--------------|------------|
| No WhatsApp reply | Webhook not pointing to this API | Ask developer to verify webhook URL and logs |
| Farmer not found | Phone mismatch | Align WhatsApp number with `farmers.phone` |
| Empty Case review queue | Wrong environment or filter | Confirm staging vs prod; check Open filter |
| No Training export tab | Old UI build | Redeploy console; hard-refresh browser |
| Export empty for today | Date range too narrow | Increase **days** on dashboard and export `since` |
| Cannot submit case review | Read-only role | Use agronomist account with write access |
| Malayalam too formal | Prompt deploy | Ensure latest API deployed; send **new** message after deploy |

---

## 11. What “success” looks like for the client

After one complete test run you should be able to show:

1. **Operational proof** — WhatsApp thread + closed agronomist case.  
2. **Training proof** — `ai_training_events` row(s) with human action and final label.  
3. **Analytics proof** — Training export dashboard movement and downloadable JSON.  
4. **Optional depth** — Structured field finding, image review, outcome, weather columns in export.

That is sufficient evidence that the AI training architecture is working in your live environment, not only in demos.

---

## 12. For developers (technical reference)

Stage-by-stage implementation notes (for your dev team, not required for testers):

| Doc | Topic |
|-----|--------|
| [STAGE0-STANDARDIZATION.md](./STAGE0-STANDARDIZATION.md) | Enums, confidence routing |
| [STAGE1-STRUCTURED-INPUTS.md](./STAGE1-STRUCTURED-INPUTS.md) | Farmers, findings, weather snapshots |
| [STAGE2-CORRECTION-SPINE.md](./STAGE2-CORRECTION-SPINE.md) | `ai_training_events` |
| [STAGE3-IMAGE-REVIEW.md](./STAGE3-IMAGE-REVIEW.md) | `crop_images` |
| [STAGE4-CONFIDENCE-LIFECYCLE.md](./STAGE4-CONFIDENCE-LIFECYCLE.md) | Confidence bands |
| [STAGE5-OUTCOME-REVIEW.md](./STAGE5-OUTCOME-REVIEW.md) | Recommendation outcomes |
| [STAGE6-INTERACTION-FINDING-UI.md](./STAGE6-INTERACTION-FINDING-UI.md) | Telecaller structured findings |
| [STAGE7-TRAINING-EXPORT.md](./STAGE7-TRAINING-EXPORT.md) | Export API and datasets |
| [STAGE8-WEATHER-CORRELATION.md](./STAGE8-WEATHER-CORRELATION.md) | Weather in export |

**Migrations to apply (AI training stack):**

```text
20260647000000_ai_training_structured_inputs.sql
20260648000000_ai_training_events.sql
20260649000000_crop_images.sql
20260650000000_ai_confidence_lifecycle.sql
20260651000000_recommendation_outcomes.sql
```

(Plus any earlier Morbeez OS migrations your environment already uses.)

---

## 13. Handout for the test farmer (WhatsApp)

You can send this to the person holding the test phone:

```text
Morbeez test — please:
1) Send a message describing your crop problem (ginger leaf issue is fine).
2) Send 1–2 clear close-up photos of the affected leaves.
3) Wait for the reply, then follow any short questions from the bot.
Thank you — our team will also review your case in the office system.
```

---

*Document version: AI training stages 0–8. Update `<YOUR-API-HOST>` and farmer UUID before sharing with the client.*
