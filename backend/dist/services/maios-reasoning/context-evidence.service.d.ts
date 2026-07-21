import type { ReasoningEvidenceItem } from '../../domain/maios-reasoning/types.js';
export type ContextEvidenceInput = {
    cropType: string;
    symptomsText?: string;
    contextPack?: {
        weatherRiskScore?: number;
        heavyRainLikely?: boolean;
        highHeatLikely?: boolean;
        highHumidityLikely?: boolean;
        soilPh?: number;
        soilEc?: number;
        dap?: number | null;
        daysSinceLastFertilizer?: number | null;
        cropType?: string;
    };
    regionalPriors?: Array<{
        issueLabel: string;
        caseCount: number;
    }>;
};
export declare const maiosContextEvidenceService: {
    build(input: ContextEvidenceInput): ReasoningEvidenceItem[];
};
//# sourceMappingURL=context-evidence.service.d.ts.map