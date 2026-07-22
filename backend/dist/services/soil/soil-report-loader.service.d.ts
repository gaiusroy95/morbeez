import { normalizeSoilMetrics } from './soil-lab-metrics.js';
export type LoadedSoilReport = {
    reportedAt: string | null;
    labName: string | null;
    summaryLine: string;
    reportLines: string[];
    metrics: ReturnType<typeof normalizeSoilMetrics>;
};
export declare const soilReportLoaderService: {
    loadLatestForBlock(farmerId: string, blockId?: string | null): Promise<LoadedSoilReport | null>;
};
//# sourceMappingURL=soil-report-loader.service.d.ts.map