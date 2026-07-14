export type FarmerVisitFeedback = {
  suggestedDiagnosis?: string | null;
  suggestedDiagnoses?: string[];
  priorExperience?: string | null;
  priorProduct?: string | null;
  priorOutcome?: string | null;
};

export function buildFarmerObservationText(fb?: FarmerVisitFeedback | null): string {
  if (!fb) return '';
  const parts: string[] = [];
  const diagnoses = fb.suggestedDiagnoses?.filter(Boolean) ?? [];
  if (diagnoses.length > 1) {
    parts.push(`Farmer recommendations:\n${diagnoses.map((d) => `• ${d}`).join('\n')}`);
  } else if (fb.suggestedDiagnosis?.trim()) {
    parts.push(`Farmer recommendation: ${fb.suggestedDiagnosis.trim()}`);
  } else if (diagnoses.length === 1) {
    parts.push(`Farmer recommendation: ${diagnoses[0]}`);
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
