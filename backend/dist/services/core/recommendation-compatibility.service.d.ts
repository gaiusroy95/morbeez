import { type CompatibilityLookupResult } from '../whatsapp/pipeline/compatibility-lookup.service.js';
export type MaterialCompatibilityPair = CompatibilityLookupResult & {
    productA: string;
    productB: string;
};
export type MaterialCompatibilityReport = {
    pairs: MaterialCompatibilityPair[];
    hasIncompatiblePair: boolean;
    hasUnknownPair: boolean;
};
export declare const recommendationCompatibilityService: {
    checkPair(productA: string, productB: string): Promise<CompatibilityLookupResult>;
    checkMaterials(materials: Array<{
        technicalName: string;
    }>): Promise<MaterialCompatibilityReport>;
};
//# sourceMappingURL=recommendation-compatibility.service.d.ts.map