import type { MaiosSupplySignals } from '../../domain/case/types.js';
export declare const supplyIntelligenceService: {
    enabled(): boolean;
    suggestFromTags(params: {
        cropType: string;
        productTags: string[];
        farmerId: string;
    }): Promise<MaiosSupplySignals>;
    suggestFulfillment(_params: {
        technicalNames: string[];
        farmerId: string;
    }): Promise<MaiosSupplySignals>;
};
//# sourceMappingURL=supply-intelligence.service.d.ts.map