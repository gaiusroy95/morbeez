import type { MaiosInputHistorySummary } from '../../domain/case/types.js';
export declare const resistanceDetectionService: {
    score(params: {
        farmerId: string;
        blockId?: string | null;
        inputHistory?: MaiosInputHistorySummary;
    }): Promise<{
        score: number;
        classes: string[];
    }>;
};
//# sourceMappingURL=resistance-detection.service.d.ts.map