import type { StructuredAdvisory } from '../ai/types.js';
import type { MaiosReasoningSnapshot } from '../../domain/maios-reasoning/types.js';
export type DiagnosisRankRole = 'primary' | 'contributing' | 'disease_watch' | 'alternative';
export type DiagnosisRankItem = {
    label: string;
    probability: number;
    role: DiagnosisRankRole;
    stars: number;
};
export type DiagnosisPresentation = {
    headline: string;
    primaryLabel: string;
    primaryConfidence: number;
    ranked: DiagnosisRankItem[];
    diseaseWatch?: {
        label: string;
        probability: number;
        note: string;
    };
    alignmentNote?: string;
    showLowConfidencePrimary: boolean;
};
export type TreatmentFocus = 'nutrient' | 'fungicide' | 'pest' | 'cultural' | 'mixed' | 'unknown';
export declare function inferTreatmentFocus(advisory: StructuredAdvisory): TreatmentFocus;
/** Harmonize LLM vision ranking, Bayesian posterior, and farmer-facing labels. */
export declare const diagnosisPresentationService: {
    build(params: {
        advisory: StructuredAdvisory;
        reasoning: MaiosReasoningSnapshot;
        shadowMode: boolean;
    }): DiagnosisPresentation;
    applyToAdvisory(advisory: StructuredAdvisory, presentation: DiagnosisPresentation, reasoning: MaiosReasoningSnapshot): StructuredAdvisory;
};
//# sourceMappingURL=diagnosis-presentation.service.d.ts.map