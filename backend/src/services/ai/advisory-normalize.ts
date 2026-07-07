import type { StructuredAdvisory } from './types.js';
import { diagnosisLabelsMatch } from '../maios-reasoning/diagnosis-fusion.service.js';

/** Align probableIssue with the LLM's own highest-ranked differential when inconsistent. */
function reconcileProbableIssue(advisory: StructuredAdvisory): StructuredAdvisory {
  const ranked = [...(advisory.differentialDiagnosis ?? [])]
    .filter((d) => d.label?.trim())
    .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
  const top = ranked[0];
  if (!top?.label) return advisory;

  const topProb = top.probability ?? 0;
  const issue = advisory.probableIssue?.trim();
  if (!issue) {
    return { ...advisory, probableIssue: top.label, confidence: Math.max(advisory.confidence, topProb) };
  }

  if (diagnosisLabelsMatch(issue, top.label)) {
    return {
      ...advisory,
      probableIssue: top.label,
      confidence: Math.max(advisory.confidence, topProb),
    };
  }

  if (topProb >= advisory.confidence + 0.08 && topProb >= 0.45) {
    return {
      ...advisory,
      probableIssue: top.label,
      confidence: topProb,
    };
  }

  return advisory;
}

/** Ensure extended rich-diagnosis fields exist with safe defaults (reuse cache / legacy rows). */
export function normalizeStructuredAdvisory(raw: StructuredAdvisory): StructuredAdvisory {
  let advisory = { ...raw };
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
  advisory = reconcileProbableIssue(advisory);
  return advisory;
}
