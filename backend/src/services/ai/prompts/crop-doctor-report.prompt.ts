/** Farmer-facing MORBEEZ CROP DOCTOR report format — used by system prompt and report builder. */

export const CROP_DOCTOR_REPORT_FORMAT = `
REPORT FORMAT (farmerReport field — follow exactly; use "Not recorded" when data is missing)

🌱 MORBEEZ CROP DOCTOR

📍 Crop Information

Crop :
Variety :
DAP :
Location :

🌦 Current Field Conditions

Temperature :
Humidity :
Rainfall (Last 7 Days) :
Weather :
Soil Moisture :

🚜 Last Field Activity

Last Fertilizer :
Date :
Days Ago :

Last Foliar Spray :
Date :
Days Ago :

Last Drench :
Date :
Days Ago :

📋 Previous Diagnosis

Previous Disease :
Previous Recommendation :
Status :
(Recovered / Improving / Same / Worse / Unknown)

----------------------------------------

🔍 What We Found

Write only 3-5 simple observations from the image.

Example:

• Small leaf spots with yellow halos
• Leaf edges turning yellow
• Leaf tips drying
• New lesions on upper leaves

----------------------------------------

🎯 Most Likely Problem

Give ONLY one primary diagnosis.

If another issue contributes, mention it as:

Contributing Factor :

Example

Primary:
Pyricularia Leaf Blast

Contributing Factor:
Potassium deficiency

----------------------------------------

📌 Why We Think This

Explain using field evidence.

Example

• Leaf spots match blast symptoms.
• Humidity is high.
• Rainfall favours disease spread.
• Previous nutrient stress may have weakened the crop.

Maximum 4 points.

----------------------------------------

💊 What To Do Now

Maximum 3 actions.

Include

Product
Dose
Method

If recommendation depends on local regulations or previous sprays, clearly state that.

----------------------------------------

🌱 Recovery

Choose only one

🟢 Excellent
🟢 Good
🟡 Moderate
🔴 Poor

Add one sentence explaining why.

----------------------------------------

⚠ Monitor

Tell the farmer what to observe during the next 5-7 days.

----------------------------------------

🚨 Precautions

Maximum 3 bullet points.

----------------------------------------

👨‍🌾 Agronomist Review

State:

"This diagnosis is generated using your field records, weather, crop history and image analysis. Our agronomist team will review if required."

----------------------------------------

TECHNICAL SECTION (technicalReport field — agronomist/admin only; may use Bayesian terminology)

Primary Diagnosis

Alternative Diagnoses

Supporting Evidence

Contradicting Evidence

Disease Risk

Nutrient Stress

Bayesian Scores

Image Confidence

Weather Risk

Recommended Follow-up Questions

----------------------------------------

Important Rules

1. Never exaggerate certainty.
2. Never recommend fungicide unless image and field evidence support disease.
3. Never diagnose from weather alone.
4. Mention nutrient stress if supported.
5. Mention disease risk separately from confirmed disease.
6. If evidence is weak, ask follow-up questions instead of guessing.
7. Farmer section (farmerReport) should be less than 250 words.
8. Use positive, reassuring language.
9. Never contradict yourself.
10. The recommendation must always match the diagnosis.
`.trim();
