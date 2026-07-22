import type { CropPackConfig } from '../../domain/crop-pack/types.js';
import type { MaiosRiskTag, MaiosWeatherStress } from '../../domain/case/types.js';
type RiskInput = {
    pack?: CropPackConfig;
    soilPh?: number;
    soilEc?: number;
    irrigationPh?: number;
    irrigationEc?: number;
    weatherRiskScore?: number;
    heavyRainLikely?: boolean;
    highHeatLikely?: boolean;
    highHumidityLikely?: boolean;
    drainageRisk?: 'low' | 'moderate' | 'high';
    symptomsText?: string;
    probableIssue?: string;
    lowSoilK?: boolean;
    lowSoilN?: boolean;
    resistanceScore?: number;
};
export declare const riskTagsService: {
    compute(input: RiskInput): MaiosRiskTag[];
    weatherStress(input: RiskInput): MaiosWeatherStress;
};
export {};
//# sourceMappingURL=risk-tags.service.d.ts.map