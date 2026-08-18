export type QualifiedCaseRule = {
  requireFarmerVerified: boolean;
  requireCrop: boolean;
  requireCropStage: boolean;
  requireProblem: boolean;
  requireDiagnosis: boolean;
  requireRecommendation: boolean;
  requireEvidence: boolean;
};

export const DEFAULT_QUALIFIED_CASE_RULE: QualifiedCaseRule = {
  requireFarmerVerified: true,
  requireCrop: true,
  requireCropStage: true,
  requireProblem: true,
  requireDiagnosis: true,
  requireRecommendation: true,
  requireEvidence: true,
};

export type QualifiedCaseFacts = {
  farmerVerified: boolean;
  cropRecorded: boolean;
  cropStageRecorded: boolean;
  problemRecorded: boolean;
  diagnosisRecorded: boolean;
  recommendationRecorded: boolean;
  evidenceComplete: boolean;
};

const GATES: Array<{ fact: keyof QualifiedCaseFacts; rule: keyof QualifiedCaseRule; reason: string }> = [
  { fact: 'farmerVerified', rule: 'requireFarmerVerified', reason: 'farmer_not_verified' },
  { fact: 'cropRecorded', rule: 'requireCrop', reason: 'crop_missing' },
  { fact: 'cropStageRecorded', rule: 'requireCropStage', reason: 'crop_stage_missing' },
  { fact: 'problemRecorded', rule: 'requireProblem', reason: 'problem_missing' },
  { fact: 'diagnosisRecorded', rule: 'requireDiagnosis', reason: 'diagnosis_missing' },
  { fact: 'recommendationRecorded', rule: 'requireRecommendation', reason: 'recommendation_missing' },
  { fact: 'evidenceComplete', rule: 'requireEvidence', reason: 'evidence_incomplete' },
];

export function present(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value);
  return Boolean(value);
}

/** A case record existing is not enough — every required gate must pass. */
export function evaluateQualifiedCase(
  facts: QualifiedCaseFacts,
  rule = DEFAULT_QUALIFIED_CASE_RULE
): { qualified: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const gate of GATES) {
    if (rule[gate.rule] && !facts[gate.fact]) reasons.push(gate.reason);
  }
  return { qualified: reasons.length === 0, reasons };
}
