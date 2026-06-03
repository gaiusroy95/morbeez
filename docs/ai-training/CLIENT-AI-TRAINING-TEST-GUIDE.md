# Morbeez AI Training — Real-World Test Guide (For Your Team)

Use this guide to test **AI training on your live Morbeez system** — the same WhatsApp number and staff portal your team uses with real farmers. You do not need to understand how the software is built.

**What you are proving:** when a farmer reports a crop problem on WhatsApp, Morbeez records the AI advice, your staff can correct or approve it, and **later** you can see those results in the staff portal and download a training report.

**Time:** about 30–45 minutes on day one, then 5–10 minutes a few days later for follow-up outcome.

---

## Important: test on the real system

| Do this | Do not do this |
|---------|----------------|
| Use your **live** Morbeez WhatsApp line farmers already message | Use a demo on someone’s laptop only |
| Log in to the **same staff portal** your agronomists use every day | Assume a test “works” if only a developer saw it internally |
| Use a **real test farmer** registered in Morbeez (name + phone on file) | Use a random phone number that is not in your farmer list |
| Run the test in **one environment** (e.g. only production, or only your agreed pilot server) | Mix messages on live WhatsApp with staff logged into a different server |

Before the first test, your Morbeez onboarding or IT contact should confirm: WhatsApp is live, staff logins work, and the **Training export** tab appears under Agronomist Hub. If any of that is missing, fix that first — this guide assumes the live product is ready.

---

## The full journey (simple picture)

1. **Farmer** — Sends problem + photo on WhatsApp.  
2. **Agronomist** — Reviews the case in the staff portal, approves or corrects the AI.  
3. **Telecaller** *(optional)* — Logs a field visit or call with structured field finding.  
4. **Agronomist** *(a few days later)* — Records whether the advice helped (outcome).  
5. **Lead agronomist / admin** — Opens **Training export** to see numbers and download the report.  
6. *(Automatic)* **WhatsApp outcome KPI** — ~5–7 days after recommendation, farmer gets a short 4-option follow-up (no staff action needed for most farmers).  
7. *(Optional)* **Test farmer again** — Similar WhatsApp message to confirm live memory (see section after Step 5).

---

## Before you start — one-time checklist

Ask your Morbeez contact to confirm **yes** to all of these on the system you will use:

- [ ] Farmers can message Morbeez on WhatsApp and get replies today  
- [ ] Staff portal opens in the browser and agronomist accounts can log in  
- [ ] **Agronomist Hub** shows tabs: Case review, Image review, Outcome review, **Training export**  
- [ ] You have chosen **one test farmer** (see below)  

### Choose your test farmer

Pick someone safe for a trial (a pilot farmer or internal test account), not a high-stakes case unless management agrees.

| Check | Why |
|-------|-----|
| Name and mobile number match what Morbeez has on file | WhatsApp only works when the number is registered |
| Language is set (Malayalam or English) | Replies should match how that farmer normally reads messages |
| Crop/plot is on file (e.g. ginger field) | Better advice and weather context |
| You have the phone in hand (or the farmer is briefed) | Someone must send the WhatsApp messages |

**Tip:** Write down the farmer’s name and phone on your test sheet — you will search for them in the portal later.

### Who needs which login

| Person | What they do in this test |
|--------|---------------------------|
| Person with the test phone | Sends WhatsApp messages (Step 1) |
| Agronomist | Case review, image review, outcome review (Steps 2, 4) |
| Telecaller | Optional field visit log (Step 3) |
| Senior agronomist or admin | Training export and download (Step 5); approvals if your process requires it |

---

## Step 1 — Farmer reports on WhatsApp (real message, real photo)

**When:** Day 0 — start here.

**Who:** The test farmer’s phone (or your staff holding that phone).

### What to send

1. A short message describing the crop problem in normal language.  
   - English example: *Ginger leaves have white streaks and yellow spots.*  
   - Malayalam example: *ഇഞ്ചി ഇലയിൽ വെള്ള പട്ടയും മഞ്ഞ പുള്ളിയും ഉണ്ട്.*

2. **One or two clear photos** of the affected leaves (good light, not blurry).

3. Answer any short questions from Morbeez on WhatsApp (crop, plot, etc.) if the bot asks.

### What should happen on the phone

Within a few minutes the farmer should receive:

- Crop advice in simple, friendly language (not a long formal essay).  
- Sometimes a line that the agronomist team will also review — that is normal when the system wants human backup.

### How you know Step 1 worked (no technical tools)

| Check | Pass? |
|-------|-------|
| Farmer received a reply on WhatsApp | ☐ |
| Reply mentions their crop problem or what is seen in the photo | ☐ |
| You noted the **date and time** of the message | ☐ |

**If there is no reply within 10 minutes:** stop and contact your Morbeez support contact. Do not continue the staff steps until WhatsApp is working for that number.

---

## Step 2 — Agronomist reviews the case (main training step)

**When:** Same day, shortly after Step 1 (within 1–2 hours is ideal).

**Who:** Agronomist (or whoever normally does case review).

### Open the case

1. Log in to the **Morbeez staff portal** (use the link your organization was given).  
2. Go to **Agronomist Hub**.  
3. Open the **Case review** tab.  
4. Show **Open** cases only.  
5. Find your **test farmer** (newest cases are usually at the top).  
6. Open that case.

### What to look at on screen

- What the farmer wrote or sent on WhatsApp  
- What the **AI thinks** the problem is  
- How **confident** the AI is (shown on the case screen)  
- Photos from the farmer  
- The suggested message back to the farmer  

### What to do (this is what “trains” the system)

For a proper training test, the agronomist should **not only read** — they must **submit** a decision:

| Button | When to use it |
|--------|----------------|
| **Correct AI** | The AI diagnosis or advice needs a fix — **use this at least once in your first full test** |
| **Approve AI** | The AI is fully right and you are happy to stand behind it |

Then:

1. Set **severity** (low / medium / high).  
2. If correcting: choose the **confirmed diagnosis** from the list (do not rely only on free typing).  
3. Edit the **WhatsApp reply** so it sounds natural for the farmer (short, casual).  
4. Add **learning notes** if your team uses them.  
5. Press **Save & send** — or send for **approval** first if your company requires a second sign-off.

### Image review (same day, if the farmer sent a photo)

1. In **Agronomist Hub**, open **Image review**.  
2. Find the pending photo for your test farmer.  
3. Choose **Confirm AI** or **Correct AI**, with diagnosis and severity.

### How you know Step 2 worked

| Check | Pass? |
|-------|-------|
| The case is no longer in the **Open** queue (or shows as reviewed) | ☐ |
| Farmer received the final recommendation on WhatsApp (if your process sends it) | ☐ |
| You noted **who** reviewed and **what** they chose (Approve vs Correct) | ☐ |

---

## Step 3 — Telecaller field follow-up (optional, real operations)

**When:** Day 0–2, if you want to test how field work links to the same farmer.

**Who:** Telecaller or field staff with CRM access.

1. Open **Telecaller CRM** in the staff portal.  
2. Find the test farmer’s lead.  
3. On the **WhatsApp** tab, confirm today’s messages appear.  
4. **Add interaction** — log the call or visit.  
5. Tick **Add field finding** and fill in:  
   - Type of finding  
   - Severity  
   - Confirmed issue (pick from the diagnosis list)  
6. Save.  
7. Open that interaction and check the **Operational chain** — it should show the field finding (and recommendation link if applicable).  
8. On the **Field findings** tab, confirm a new row for that farmer with type, issue, and severity.

This step is optional but recommended if your real operation includes telecaller follow-up.

---

## Step 4 — Outcome review (a few days later, real follow-up)

**When:** **5–14 days** after the recommendation went to the farmer — same timing you would use in real follow-up.

**Who:** Agronomist.

**Why:** This records whether the advice actually helped. Without it, the “did it work?” part of training is incomplete.

1. **Agronomist Hub** → **Outcome review**.  
2. Find the test farmer’s pending item.  
3. Record the result, for example:  
   - Crop is better  
   - Some improvement  
   - No improvement  
4. Add recovery days or short notes if your form asks for them.

### How you know Step 4 worked

| Check | Pass? |
|-------|-------|
| That farmer’s outcome shows as recorded (not still pending) | ☐ |
| Date of outcome review is written on your test sheet | ☐ |

---

## Step 5 — See results later (Training export)

**When:** Any time after Step 2; **best** after Steps 3 and 4 if you did them.

**Who:** Senior agronomist, training lead, or admin with access to **Training export**.

This is how you **see results later** without asking a developer.

### On-screen dashboard

1. **Agronomist Hub** → **Training export**.  
2. Set the time range to include your test day (e.g. last 7 or 30 days).  
3. Review the summary numbers, for example:  
   - How often staff **corrected** the AI vs approved it  
   - Label accuracy  
   - Image reviews completed  
   - Outcome success (after Step 4)  

If you completed Step 2 today but all numbers are zero, widen the date range or confirm you are on the **same live system** where the test was run.

### Weather section

On the same **Training export** page, scroll to **Weather correlation**. You should see rainfall-related insights for the period. That confirms weather was tied to real field activity during your test.

### Quality checks (QA flags)

If the list shows items flagged for review, your lead can mark them **approved** or **excluded** according to your internal QA process.

### Download the training report

1. Choose to export **everything** (recommended for a full test).  
2. Download the file to your computer.  
3. Open it and **search for your test farmer’s name or phone number**.  

You should find entries that match what you did:

| What you did in the test | What you should find in the file |
|--------------------------|----------------------------------|
| Case review with Approve or Correct | A record of the AI suggestion and the staff final diagnosis |
| Image review | A record of the photo and staff decision |
| Outcome review | A record of whether the crop improved |
| Weather | Weather-related data for the same period |

Keep the downloaded file as **proof of the test** for management or auditors.

### How you know Step 5 worked

| Check | Pass? |
|-------|-------|
| Dashboard numbers moved for the period that includes your test date | ☐ |
| Downloaded file contains your test farmer’s name or phone | ☐ |
| File shows the diagnosis staff chose in Case review | ☐ |
| Weather section is visible on the Training export page | ☐ |

---

## Automated WhatsApp outcome KPI (scalable follow-up)

After a recommendation is **sent to the farmer**, Morbeez automatically runs a **short WhatsApp survey** — you do not need to call every farmer.

### What the farmer sees (~5–7 days later)

A simple message with **four choices**:

1. Fully improved  
2. Slightly improved  
3. No improvement  
4. Worse  

They can tap one option (or reply **1–4**). They may also send a **new leaf photo**.

### What Morbeez does automatically

| Farmer answer | Typical system action |
|---------------|----------------------|
| Fully / slightly improved | Outcome saved; successful cases feed future advice |
| No improvement or worse | Flagged for **staff verification**; telecaller/agronomist may follow up |
| No reply | Reminder sent; then flagged if still silent |
| Free-text or photo | AI interprets and classifies when possible |

### What staff do (selective — not every farmer)

Open **Agronomist Hub → Outcome review**:

- **Verify KPI** — only cases that need human confirmation (failures, severe cases, uncertain AI, random QA samples).  
- **WhatsApp outcome KPIs** panel at the top — response rate, improvement counts, how many need verification.

Most successful recoveries **do not** need a manual phone call. That is how the system scales to thousands of farmers.

---

## What happens after Training export? Will farmers get smarter answers?

Many teams expect: *“We exported the training file, so the AI is now trained and the next farmer with the same problem gets that answer automatically.”*

Here is how Morbeez works today, in plain terms.

### What Training export does

- **Records and proves** what happened: AI suggestion, staff correction, photos, outcomes, weather.  
- Gives you a **downloadable report** for management, auditors, or a future data/AI partner.  
- Does **not** by itself replace the live AI the next morning. Think of it as **evidence and study material**, not an automatic “install new brain” button.

### What already helps the *next* similar farmer (live system)

Separately from export, Morbeez can **remember good answers** from real work:

| When memory usually builds | What can happen next time |
|----------------------------|---------------------------|
| Staff **approved and sent** a recommendation the team stands behind | A **similar** question (same crop, similar symptoms, same area and growth stage) may get that **verified** answer again |
| A case had a **good outcome** recorded later | That success can strengthen what is reused for others |
| The **same farmer** asks again within a day or two with similar wording | They may get a **consistent** follow-up based on the recent case |

The farmer may see wording like a **similar case in your region** — that means Morbeez reused a proven answer instead of guessing from scratch.

When Morbeez already has **many similar successful cases** for a crop (for example hundreds of ginger leaf-spot cases), it may first ask the farmer **one or two short yes/no questions** (or a leaf photo) so it can match the closest learned case — then give the diagnosis. This is normal and helps accuracy without waiting for a human expert on every chat.

Staff review can still happen when your rules require it (low confidence, severe cases, approvals).

### What does *not* happen automatically today

| Expectation | Reality today |
|-------------|-----------------|
| Download export → AI instantly “retrained” for everyone | **No** — retraining from the file is a **separate** project with your Morbeez or data team |
| Every **Correct AI** instantly changes all future replies worldwide | **Not always** — the correction is **saved for training**; **live reuse** for other farmers usually needs the answer to be **approved/sent** and often a **good outcome**, not only a draft save |
| Exact same WhatsApp sentence every time | **Similar** problems match — wording can differ slightly |

### Simple picture of the full loop

```text
Farmer on WhatsApp
    → AI answer OR remembered verified answer
    → Staff review (Correct / Approve)
    → Training export (report for later improvement)
    → (In parallel) verified cases feed live memory
    → Next similar farmer often gets the improved answer
```

### Optional Step 6 — Test that memory is working (real world)

**When:** After Step 2, once the recommendation was **sent to the farmer** (and approved if your process requires it).  
**Who:** Same test farmer again, or a **second** registered farmer in the **same crop and area**.

1. Send a **similar** problem on WhatsApp (same type of leaf issue, new photo is fine).  
2. Compare the reply to what the agronomist finalized in Step 2.  
3. **Pass** if the advice matches the staff-corrected diagnosis and spray guidance, or clearly says it is based on a similar successful case.  
4. **Fail** if it is a completely unrelated new guess — contact Morbeez support (reuse may not be enabled, or the case was not yet eligible for memory).

| Check | Pass? |
|-------|-------|
| Second message got advice aligned with Step 2 staff diagnosis | ☐ |
| Optional: message mentioned similar / verified case | ☐ |

This step proves **live learning memory**, not the export file alone.

---

## Printable test sheet (one run)

Copy for each real-world test.

**Test ID:** ___________  
**Date started:** ___________  
**Test farmer name:** ___________  
**Test farmer phone:** ___________  
**Staff portal used (e.g. production / pilot):** ___________  

**Day 0 — WhatsApp**  
- [ ] Farmer sent message + clear photo  
- [ ] Farmer received reply on WhatsApp  
- [ ] Time noted: ___________  

**Day 0 — Agronomist**  
- [ ] Case opened in **Case review**  
- [ ] Submitted **Correct AI** or **Approve AI**: ___________  
- [ ] **Image review** done (if photo was sent)  
- [ ] Reviewer name: ___________  

**Day 0–2 — Telecaller (optional)**  
- [ ] Interaction + field finding saved  
- [ ] Operational chain visible  

**Day 5–14 — Outcome**  
- [ ] Outcome recorded: Better / Partial / No improvement  
- [ ] Date: ___________  

**Results later — Training export**  
- [ ] Dashboard checked (date range: ___________ )  
- [ ] Report downloaded  
- [ ] Test farmer found in report  
- [ ] File saved at: ___________  

**Optional — Similar message again (live memory)**  
- [ ] Second similar WhatsApp test done  
- [ ] Reply matched staff diagnosis from Step 2  
- [ ] Date: ___________  

---

## When the test is successful (for management)

You can say the **real-world AI training loop works** when you have all of the following:

1. **WhatsApp proof** — Real thread with the test farmer on the live Morbeez number.  
2. **Staff proof** — A reviewed case in Agronomist Hub (not left open forever).  
3. **Learning proof** — At least one **Correct AI** or **Approve AI** submitted with a clear final diagnosis.  
4. **Results proof** — Training export dashboard and downloaded report that include that farmer after the test date.  
5. **Follow-up proof** *(recommended)* — Outcome recorded after several days.

That is a complete test on the **live** system, not a theoretical walkthrough.

---

## If something goes wrong

| Problem | What to do |
|---------|------------|
| No WhatsApp reply | Contact Morbeez support; confirm the phone is registered and WhatsApp is live on **this** system |
| Case does not appear in Case review | Confirm staff are on the **same** portal as the live WhatsApp line; check Open filter; wait 5 minutes and refresh |
| Cannot save case review | Use an agronomist account allowed to edit cases, not view-only |
| Training export tab missing | Contact Morbeez — your portal may need an update on that server |
| Export file has no test farmer | Widen the date range; confirm the test was on this server, not another |
| Malayalam reply too formal | Report to Morbeez; run a **new** WhatsApp test after they confirm an update |
| Second similar message still wrong | Confirm Step 2 was **sent/approved**, not draft only; try optional Step 6 after outcome; contact Morbeez |

Do not troubleshoot with database or code tools — use the checks above and your Morbeez contact.

---

## Message to send the test farmer (copy/paste)

You can send this on WhatsApp before the test:

> Morbeez trial — please send:  
> 1) One message about your crop problem (e.g. ginger leaf spots).  
> 2) One or two clear close-up photos of the leaves.  
> 3) Reply to any short questions from Morbeez.  
> Our office team will also review your case. Thank you.

---

*This guide is for real-world operational testing only. Technical implementation notes for Morbeez developers are kept separately and are not required for your team to run this test.*
