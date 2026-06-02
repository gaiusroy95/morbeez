import { type SeasonPhase } from './seasonal-priority.service.js';
import { type DiseaseWeatherPrior } from './disease-weather-rules.service.js';
export type ContextPack = {
    district?: string;
    pincode?: string;
    village?: string;
    coordSource?: 'plot_gps' | 'pincode' | 'district';
    seasonPhase: SeasonPhase;
    weatherRiskScore: number;
    heavyRainLikely: boolean;
    highHeatLikely: boolean;
    highHumidityLikely: boolean;
    avgHumidityPct?: number;
    rainMmToday?: number;
    maxTempCToday?: number;
    soilPh?: number;
    soilEc?: number;
    drainageRisk: 'low' | 'moderate' | 'high';
    diseasePriors: DiseaseWeatherPrior[];
    nearbySummary?: string;
};
export declare const contextPackService: {
    build(farmerId: string, options?: {
        cropType?: string;
        symptomsText?: string;
        dap?: number;
        blockId?: string | null;
    }): Promise<ContextPack>;
    /** Farmer- and model-facing environmental block for Crop Doctor / conversational AI. */
    formatForPrompt(pack: ContextPack): string;
};
//# sourceMappingURL=context-pack.service.d.ts.map