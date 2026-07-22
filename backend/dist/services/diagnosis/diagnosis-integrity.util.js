import { env } from '../../config/env.js';
export function isDiagnosisInferenceAvailable() {
    return Boolean(env.OPENAI_API_KEY?.trim() || env.PLANT_ID_API_KEY?.trim());
}
export function mapImageSourceToDiagnosisSource(imageSource) {
    if (imageSource === 'plant_id' || imageSource === 'vision' || imageSource === 'fusion') {
        return 'vision';
    }
    return 'model';
}
export function buildInsufficientEvidenceEnvelope(reason) {
    return {
        hypotheses: [],
        source: 'insufficient_evidence',
        degraded: true,
        escalationRequired: true,
        evidenceSummary: [reason],
    };
}
export function wrapHypothesesAsEnvelope(params) {
    if (!isValidDiagnosisSource(params.source) || !params.hypotheses.length) {
        return buildInsufficientEvidenceEnvelope('No evidence-backed diagnosis hypotheses');
    }
    return {
        hypotheses: params.hypotheses,
        source: params.source,
        reusedFrom: params.reusedFrom,
        degraded: false,
        escalationRequired: params.escalationRequired ?? false,
        evidenceSummary: params.evidenceSummary ?? [],
    };
}
function isValidDiagnosisSource(source) {
    return source === 'model' || source === 'vision' || source === 'verified_reuse';
}
export function diagnosisSourceLabel(source) {
    switch (source) {
        case 'model':
            return 'AI model inference';
        case 'vision':
            return 'Vision analysis';
        case 'verified_reuse':
            return 'Verified case retrieval';
        default:
            return 'Insufficient evidence';
    }
}
//# sourceMappingURL=diagnosis-integrity.util.js.map