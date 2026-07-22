import type { DiagnosisEnvelope, DiagnosisHypothesis, DiagnosisSource } from '../../domain/diagnosis/types.js';
export declare function isDiagnosisInferenceAvailable(): boolean;
export declare function mapImageSourceToDiagnosisSource(imageSource?: 'plant_id' | 'vision' | 'fusion' | null): DiagnosisSource;
export declare function buildInsufficientEvidenceEnvelope(reason: string): DiagnosisEnvelope;
export declare function wrapHypothesesAsEnvelope(params: {
    hypotheses: DiagnosisHypothesis[];
    source: DiagnosisSource;
    reusedFrom?: string;
    evidenceSummary?: string[];
    escalationRequired?: boolean;
}): DiagnosisEnvelope;
export declare function diagnosisSourceLabel(source: DiagnosisSource): string;
//# sourceMappingURL=diagnosis-integrity.util.d.ts.map