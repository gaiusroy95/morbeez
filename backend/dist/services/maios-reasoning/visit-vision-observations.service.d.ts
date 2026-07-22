import type { VisionObservation } from '../../domain/maios-reasoning/vision-observation.types.js';
/** Domain 2 — structured image observations for Bayesian evidence (not LLM diagnosis ranking). */
export declare const visitVisionObservationsService: {
    inferFromLabel(label: string, baseConfidence: number, cropType?: string | null): VisionObservation[];
    parseStructuredResponse(raw: unknown): VisionObservation[];
    merge(...groups: VisionObservation[][]): VisionObservation[];
    resolve(params: {
        label?: string | null;
        confidence?: number;
        structured?: unknown;
        cropType?: string | null;
    }): VisionObservation[];
};
//# sourceMappingURL=visit-vision-observations.service.d.ts.map