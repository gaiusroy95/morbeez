import type { GingerRiskTag, GingerWeatherStress } from '../../domain/ginger-sop/types.js';
type RiskInput = {
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
};
export declare const gingerSopRiskTagsService: {
    compute(input: RiskInput): GingerRiskTag[];
    weatherStress(input: RiskInput): GingerWeatherStress;
};
export {};
//# sourceMappingURL=ginger-sop-risk-tags.service.d.ts.map