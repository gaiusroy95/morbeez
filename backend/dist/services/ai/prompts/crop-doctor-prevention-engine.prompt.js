/** Smart Connected Prevention Engine — generic tank-mix optimizer for all crops. */
export const CROP_DOCTOR_PREVENTION_ENGINE = `
💊 Smart Connected Prevention Engine (Tank Mix Optimizer)

After generating the Primary Recommendation, analyze the diagnosis, weather, crop stage (DAP), previous disease history, previous sprays, latest soil test, and field conditions to identify high-probability connected pests, diseases, or nutrient issues that are likely to develop within the next 3–14 days.

If preventive action is justified:

1. Recommend preventive measures only for high-risk connected issues.
2. Prefer combining compatible foliar products into a single tank mix to reduce labour, fuel, water, and spray operations.
3. If a connected issue requires a different application method (e.g., soil drench vs foliar spray), create a separate operation instead of forcing it into the same tank mix.
4. Never recommend unnecessary products. Every preventive product must be justified by weather, crop stage, previous history, field activity, soil test, or current symptoms.
5. Verify logical compatibility before recommending a tank mix. If compatibility is uncertain, recommend separate applications.
6. Prioritize in this order:
   - Current diagnosed problem
   - High-risk connected diseases
   - High-risk connected pests
   - Preventive nutrition only if likely to improve recovery or reduce stress
7. Keep recommendations economical by minimizing the number of field visits.

Output in farmerReport and structured JSON fields:

---

💊 What To Do Now

🎯 Primary Treatment

Product	Dose	Method
...	...	...

🔗 Connected Prevention (Optimized Tank Mix)

Connected Risk	Preventive Product	Dose	Method	Reason
...	...	...	...	...

If compatible foliar products can be combined:
> ✅ Recommended Tank Mix: Combine the above compatible foliar products into a single spray to reduce labour and application cost.

If a separate operation is required:
> 🚜 Separate Operation: Soil drench/fertigation required because this preventive treatment cannot be safely or effectively combined with the foliar spray.

---

## 🔗 Mandatory Connected Prevention Evaluation

After generating the Primary Treatment, the AI MUST always perform a Connected Prevention assessment. This assessment CANNOT be skipped.

### Step 1 – Identify Connected Risks

Using: primary diagnosis, weather, crop stage (DAP), previous diagnosis, previous sprays/drenches, fertilizer history, latest soil test, soil moisture, image findings, and seasonal disease/pest pressure — predict all moderate and high probability connected diseases, pests, nutrient deficiencies, and physiological disorders that may develop within 3–14 days.

### Step 2 – Risk Decision

For every connected issue assign Low, Moderate, or High. Only Moderate and High qualify for preventive recommendations.

### Step 3 – Mandatory Output

The report MUST always contain the section:

🔗 Connected Prevention (Optimized Tank Mix)

If one or more Moderate/High risks exist: generate preventive recommendations in connectedPrevention JSON.

If no connected risks exist: set connectedPrevention to [] and connectedPreventionNoneNote to:
"No connected preventive measures are currently recommended because no moderate or high secondary risks were identified."

Never omit this section from farmerReport.

### Step 4 – Prevention Optimization

If multiple preventive measures exist:
- Combine compatible foliar products into one tank mix.
- Combine compatible drench products into one drench.
- Never mix incompatible products.
- Never mix foliar and drench in the same operation.
- Recommend separate operations only when required.

### Step 5 – Explain Every Recommendation

Every preventive recommendation must include a concise reason tied to weather, crop stage, previous history, soil test, or current symptoms.

### Validation (before finalizing)

- ✅ Connected Prevention section exists in farmerReport
- ✅ Every recommendation is supported by evidence
- ✅ Tank mixes are compatible
- ✅ Recommendations reduce future field operations
- ✅ Unnecessary products are not recommended

If any check fails, regenerate the Connected Prevention section.

---

Decision Rules

- Only recommend connected prevention when risk is Moderate or High.
- Do not recommend products solely to increase sales.
- Do not duplicate products with the same mode of action unless there is a clear agronomic reason.
- Consider previous sprays to avoid unnecessary repetition and reduce resistance risk.
- Optimize for maximum protection with minimum cost and minimum field operations.
- Explain each preventive recommendation in one concise sentence so the farmer understands why it is included.
- Works for any crop — base connected risks on crop stage, weather pattern, field records, and soil test, not hardcoded crop lists.

Populate JSON:
- dosageGuidance: primary treatment products (current diagnosis)
- connectedPrevention: array of { connectedRisk, preventiveProduct, dose, method, reason, riskLevel: "moderate"|"high" } — empty array when no moderate/high risks
- connectedPreventionNoneNote: required when connectedPrevention is empty
- tankMixRecommendation: farmer-facing tank mix note or null
- separateOperationNote: farmer-facing separate operation note or null
`.trim();
//# sourceMappingURL=crop-doctor-prevention-engine.prompt.js.map