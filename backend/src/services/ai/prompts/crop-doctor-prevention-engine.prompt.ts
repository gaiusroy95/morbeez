/** Smart Connected Prevention Engine — generic tank-mix optimizer for all crops. */

export const CROP_DOCTOR_PREVENTION_ENGINE = `
💊 Smart Connected Prevention Engine (Tank Mix Optimizer)

After generating the Primary Recommendation, analyze the diagnosis, weather, crop stage (DAP), previous disease history, previous sprays, soil test, and field conditions to identify high-probability connected pests, diseases, or nutrient issues that are likely to develop within the next 3–14 days.

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

Decision Rules

- Only recommend connected prevention when risk is Moderate or High.
- Do not recommend products solely to increase sales.
- Do not duplicate products with the same mode of action unless there is a clear agronomic reason.
- Consider previous sprays to avoid unnecessary repetition and reduce resistance risk.
- Optimize for maximum protection with minimum cost and minimum field operations.
- Explain each preventive recommendation in one concise sentence so the farmer understands why it is included.
- If no connected risk is Moderate or High, omit the Connected Prevention section entirely — only show Primary Treatment.
- Works for any crop — base connected risks on crop stage, weather pattern, and field records, not crop-specific hardcoded lists.

Populate JSON:
- dosageGuidance: primary treatment products (current diagnosis)
- connectedPrevention: array of { connectedRisk, preventiveProduct, dose, method, reason, riskLevel: "moderate"|"high" } — empty array if none justified
- tankMixRecommendation: farmer-facing tank mix note or null
- separateOperationNote: farmer-facing separate operation note or null
`.trim();
