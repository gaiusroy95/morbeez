import type { FarmerScoreComponents, EmployeeScoreComponents, ScoreFactor } from './opportunity-intelligence.types.js';
import type { FarmerScoreSnapshot } from './opportunity-score-store.service.js';
import type { EmployeeScoreSnapshot } from './opportunity-score-store.service.js';
import type { FarmerEventRow } from './farmer-event.types.js';
export type MetricScore100 = {
    key: string;
    label: string;
    score: number;
    max: number;
};
export type FarmerScorePresentation = {
    opportunityScore: number;
    metrics: MetricScore100[];
    classification: string;
    businessInsight: string;
    detectedSignals: {
        positive: string[];
        negative: string[];
    };
    employeeInsights: {
        telecaller: string | null;
        agronomist: string | null;
    };
};
export type EmployeeScorePresentation = {
    performanceScore: number;
    metrics: MetricScore100[];
    classification: string;
    businessInsight: string;
    detectedSignals: {
        positive: string[];
        negative: string[];
    };
};
export declare function buildFarmerMetrics100(components: FarmerScoreComponents, retentionScore100: number | null): MetricScore100[];
export declare function classifyFarmer(opportunityScore: number, metrics: MetricScore100[]): string;
export declare function farmerBusinessInsight(classification: string, metrics: MetricScore100[], opportunityScore: number): string;
export declare function farmerEmployeeInsights(metrics: MetricScore100[], classification: string): {
    telecaller: string | null;
    agronomist: string | null;
};
export declare function detectFarmerSignalsFromEvents(events: FarmerEventRow[]): {
    positive: string[];
    negative: string[];
};
export declare function buildFarmerScorePresentation(input: {
    score: FarmerScoreSnapshot;
    retentionScore100: number | null;
    factors?: ScoreFactor[];
    recentEvents?: FarmerEventRow[];
}): FarmerScorePresentation;
export declare function buildEmployeeMetrics100(components: EmployeeScoreComponents): MetricScore100[];
export declare function classifyEmployee(performanceScore: number, metrics: MetricScore100[]): string;
export declare function employeeBusinessInsight(classification: string): string;
export declare function buildEmployeeScorePresentation(score: EmployeeScoreSnapshot): EmployeeScorePresentation;
//# sourceMappingURL=intelligence-score-presentation.service.d.ts.map