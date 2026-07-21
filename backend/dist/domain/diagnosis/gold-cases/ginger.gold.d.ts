/** Expert-governed gold cases for v17 regression — LR matrix must pass these before release. */
export type DiagnosisGoldCase = {
    id: string;
    label: string;
    cropType: 'ginger' | 'banana' | 'tomato' | 'coconut' | 'brinjal';
    symptomsText: string;
    contextPack?: {
        heavyRainLikely?: boolean;
        highHumidityLikely?: boolean;
        highHeatLikely?: boolean;
        soilPh?: number;
    };
    farmerAnswers?: Array<{
        questionText: string;
        answer: string;
    }>;
    visionLabel?: string;
    visionConfidence?: number;
    photoSlots?: string[];
    expect: {
        topDiagnosisIncludes: string;
        minTopProbability: number;
        minReliableEvidence?: number;
    };
};
export declare const GINGER_GOLD_CASES: DiagnosisGoldCase[];
//# sourceMappingURL=ginger.gold.d.ts.map