import type { StructuredAdvisory } from './types.js';

/** Ensure extended rich-diagnosis fields exist with safe defaults (reuse cache / legacy rows). */
export function normalizeStructuredAdvisory(raw: StructuredAdvisory): StructuredAdvisory {
  const advisory = { ...raw };
  advisory.confidence = Math.min(1, Math.max(0, Number(advisory.confidence) || 0.5));
  advisory.uncertain = Boolean(advisory.uncertain);
  advisory.escalationRecommended = Boolean(advisory.escalationRecommended);
  advisory.nutrientDeficiency = advisory.nutrientDeficiency ?? [];
  advisory.stressAnalysis = advisory.stressAnalysis ?? [];
  advisory.treatments = advisory.treatments ?? [];
  advisory.dosageGuidance = advisory.dosageGuidance ?? [];
  advisory.precautions = advisory.precautions ?? [];
  advisory.recommendedProductTags = advisory.recommendedProductTags ?? [];
  advisory.farmerSummaryEn = advisory.farmerSummaryEn ?? '';
  advisory.farmerSummaryMl = advisory.farmerSummaryMl ?? '';
  advisory.imageObservations = advisory.imageObservations ?? [];
  advisory.differentialDiagnosis = (advisory.differentialDiagnosis ?? []).map((d) => ({
    ...d,
    probability:
      d.probability != null
        ? Math.min(1, Math.max(0, Number(d.probability)))
        : undefined,
  }));
  advisory.causalChain = advisory.causalChain ?? [];
  advisory.explanation = advisory.explanation ?? '';
  advisory.rejectedHypotheses = advisory.rejectedHypotheses ?? [];
  advisory.morbeezDataUsed = advisory.morbeezDataUsed ?? [];
  advisory.costEstimate = advisory.costEstimate ?? [];
  if (!advisory.severity) {
    advisory.severity =
      advisory.confidence >= 0.85 ? 'moderate' : advisory.confidence >= 0.7 ? 'moderate' : 'mild';
  }
  if (!advisory.sprayTiming?.trim() && advisory.treatments?.[0]?.timing) {
    advisory.sprayTiming = advisory.treatments[0].timing;
  }
  if (!advisory.rootCorrection?.trim() && advisory.stressAnalysis?.length) {
    advisory.rootCorrection = advisory.stressAnalysis.join('; ');
  }
  if (!advisory.agronomistAssessment?.trim()) {
    const summary =
      advisory.farmerSummaryEn?.trim() || advisory.farmerSummaryMl?.trim() || advisory.probableIssue;
    advisory.agronomistAssessment = summary;
  }
  if (!advisory.imageObservations.length && advisory.stressAnalysis.length) {
    advisory.imageObservations = advisory.stressAnalysis.slice(0, 4);
  }
  return advisory;
}
