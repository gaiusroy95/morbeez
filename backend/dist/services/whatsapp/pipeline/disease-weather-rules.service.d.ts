import type { SeasonPhase } from './seasonal-priority.service.js';
export type EnvSignals = {
    seasonPhase?: SeasonPhase;
    heavyRainLikely: boolean;
    highHumidityLikely: boolean;
    weatherRiskScore: number;
};
export type DiseaseWeatherPrior = {
    issueLabel: string;
    likelihood: 'low' | 'medium' | 'high';
    spreadMode?: 'airborne' | 'soil' | 'vector' | 'stress';
    reasoning: string;
};
export declare const diseaseWeatherRulesService: {
    evaluate(params: {
        cropType: string;
        env: EnvSignals;
        symptomsText?: string;
        dap?: number;
    }): DiseaseWeatherPrior[];
    formatForPrompt(priors: DiseaseWeatherPrior[]): string;
};
//# sourceMappingURL=disease-weather-rules.service.d.ts.map