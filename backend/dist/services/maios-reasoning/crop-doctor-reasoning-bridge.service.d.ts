import type { MaiosCase } from '../../domain/case/types.js';
import type { VisionObservation } from '../../domain/maios-reasoning/vision-observation.types.js';
import type { PlantIdHealthResult, StructuredAdvisory } from '../ai/types.js';
/** Build structured vision features from photo observations and Plant.id — not from diagnosis label. */
export declare function buildWhatsAppVisionObservations(params: {
    advisory: StructuredAdvisory;
    plantIdResult?: PlantIdHealthResult | null;
    cropType?: string | null;
}): VisionObservation[];
/**
 * Fuse LLM vision ranking with Bayesian posterior for farmer-facing labels.
 * Treatments and narrative text stay from the LLM; labels follow fused evidence.
 */
export declare function applyBayesianDiagnosisToAdvisory(advisory: StructuredAdvisory, maiosCase: MaiosCase): StructuredAdvisory;
/** Bridge — vision observations in, Bayesian diagnosis overlay out. */
export declare const cropDoctorReasoningBridgeService: {
    buildVisionObservations: typeof buildWhatsAppVisionObservations;
    applyBayesianDiagnosis: typeof applyBayesianDiagnosisToAdvisory;
};
//# sourceMappingURL=crop-doctor-reasoning-bridge.service.d.ts.map