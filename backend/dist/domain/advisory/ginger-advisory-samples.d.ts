/**
 * Ginger advisory workflow — sample soil reports and scenario metadata for QA / AI training.
 * Seeded in DB via migration 20260722000000_ginger_advisory_soil_samples.sql
 */
import type { SoilLabMetrics } from '../../services/soil/soil-lab-metrics.js';
export declare const GINGER_ADVISORY_SAMPLE_FARMER_ID = "e0000000-0000-4000-8000-000000000001";
export declare const GINGER_ADVISORY_SAMPLE_BLOCKS: {
    readonly rhizomeRot: "e0000000-0000-4000-8000-000000000011";
    readonly nutrientDeficiency: "e0000000-0000-4000-8000-000000000012";
    readonly waterloggingE2e: "e0000000-0000-4000-8000-000000000013";
};
export type GingerAdvisoryScenarioId = keyof typeof GINGER_ADVISORY_SAMPLE_BLOCKS;
export type GingerAdvisoryScenario = {
    id: GingerAdvisoryScenarioId;
    title: string;
    crop: string;
    stage: string;
    das: number;
    blockId: string;
    soilReportId: string;
    metrics: SoilLabMetrics;
    fieldObservations: string[];
    weatherNotes: string;
    expectedIssues: string[];
    testPurpose: string;
};
export declare const GINGER_ADVISORY_SCENARIOS: GingerAdvisoryScenario[];
export declare function getGingerAdvisoryScenario(id: GingerAdvisoryScenarioId): GingerAdvisoryScenario;
//# sourceMappingURL=ginger-advisory-samples.d.ts.map