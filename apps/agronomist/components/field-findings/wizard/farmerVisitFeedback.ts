export type FarmerVisitFeedback = {
  suggestedDiagnosis?: string | null;
  priorExperience?: string | null;
  priorProduct?: string | null;
  priorOutcome?: string | null;
};

export function buildFarmerObservationText(fb?: FarmerVisitFeedback | null): string {
  if (!fb) return '';
  const parts: string[] = [];
  if (fb.suggestedDiagnosis?.trim()) {
    parts.push(`Farmer recommendation: ${fb.suggestedDiagnosis.trim()}`);
  }
  if (fb.priorProduct?.trim()) {
    parts.push(`Prior products: ${fb.priorProduct.trim()}`);
  }
  if (fb.priorExperience?.trim()) {
    parts.push(fb.priorExperience.trim());
  }
  return parts.join('\n\n');
}

export function withFarmerObservation<T extends { observation?: string }>(
  issue: T,
  fb?: FarmerVisitFeedback | null
): T {
  const farmerText = buildFarmerObservationText(fb);
  if (!farmerText) return issue;
  const obs = issue.observation?.trim() ?? '';
  if (!obs || /^Farmer feedback suggests/i.test(obs)) {
    return { ...issue, observation: farmerText };
  }
  if (obs.includes(farmerText.slice(0, 40))) return issue;
  return { ...issue, observation: `${farmerText}\n\n${obs}`.trim() };
}
