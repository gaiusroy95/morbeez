export const DEFAULT_QUALIFIED_CASE_RULE = {
    requireFarmerVerified: true,
    requireCrop: true,
    requireCropStage: true,
    requireProblem: true,
    requireDiagnosis: true,
    requireRecommendation: true,
    requireEvidence: true,
};
const GATES = [
    { fact: 'farmerVerified', rule: 'requireFarmerVerified', reason: 'farmer_not_verified' },
    { fact: 'cropRecorded', rule: 'requireCrop', reason: 'crop_missing' },
    { fact: 'cropStageRecorded', rule: 'requireCropStage', reason: 'crop_stage_missing' },
    { fact: 'problemRecorded', rule: 'requireProblem', reason: 'problem_missing' },
    { fact: 'diagnosisRecorded', rule: 'requireDiagnosis', reason: 'diagnosis_missing' },
    { fact: 'recommendationRecorded', rule: 'requireRecommendation', reason: 'recommendation_missing' },
    { fact: 'evidenceComplete', rule: 'requireEvidence', reason: 'evidence_incomplete' },
];
export function present(value) {
    if (value == null)
        return false;
    if (typeof value === 'string')
        return value.trim().length > 0;
    if (Array.isArray(value))
        return value.length > 0;
    if (typeof value === 'object')
        return Object.keys(value).length > 0;
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'number')
        return Number.isFinite(value);
    return Boolean(value);
}
/** A case record existing is not enough — every required gate must pass. */
export function evaluateQualifiedCase(facts, rule = DEFAULT_QUALIFIED_CASE_RULE) {
    const reasons = [];
    for (const gate of GATES) {
        if (rule[gate.rule] && !facts[gate.fact])
            reasons.push(gate.reason);
    }
    return { qualified: reasons.length === 0, reasons };
}
//# sourceMappingURL=qualified-case.js.map