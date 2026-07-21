import type { VisitAssistantRecommendationValidationRequest, VisitAssistantRecommendationValidationResult } from '@morbeez/shared/visit-assistant';
import type { MaterialCompatibilityReport } from '../core/recommendation-compatibility.service.js';
type Dependencies = {
    checkMaterials: (materials: Array<{
        technicalName: string;
    }>) => Promise<MaterialCompatibilityReport>;
};
export declare function validateVisitAssistantRecommendations(input: VisitAssistantRecommendationValidationRequest, dependencies?: Dependencies): Promise<VisitAssistantRecommendationValidationResult>;
export declare const visitAssistantRecommendationSafetyService: {
    validate: typeof validateVisitAssistantRecommendations;
};
export {};
//# sourceMappingURL=visit-assistant-recommendation-safety.service.d.ts.map