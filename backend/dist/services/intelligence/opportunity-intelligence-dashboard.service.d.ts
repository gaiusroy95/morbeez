import type { FarmerEventType } from './farmer-event.types.js';
import type { FarmerEventRow } from './farmer-event.types.js';
import type { EmployeeFarmerAttributionRow } from './employee-attribution.types.js';
import type { FarmerScoreSnapshot } from './opportunity-score-store.service.js';
import { type FarmerScorePresentation } from './intelligence-score-presentation.service.js';
export type OpportunityDashboardOverview = {
    periodDays: number;
    kpis: {
        farmersScored: number;
        avgOpportunityScore: number;
        highOpportunityFarmers: number;
        atRiskFarmers: number;
        churnedFarmers: number;
        events30d: number;
        conversions30d: number;
        activeAttributions: number;
        employeesScored: number;
        lastFarmerScoreRun: string | null;
        lastEmployeeScoreRun: string | null;
    };
    retentionBands: Array<{
        band: string;
        count: number;
    }>;
    scoreDistribution: Array<{
        bucket: string;
        count: number;
    }>;
};
export type DistrictOpportunityRow = {
    district: string;
    farmerCount: number;
    scoredCount: number;
    avgOpportunityScore: number;
    atRiskCount: number;
    highOpportunityCount: number;
    intensity: number;
};
export type FarmerIntelligenceSummary = {
    opportunityLevel: string;
    engagementLevel: string;
    trustLevel: string;
    relationshipLevel: string;
    acrePotentialLevel: string;
    retentionRiskLabel: string;
};
export type FarmerIntelligenceProfile = {
    farmerId: string;
    farmer: {
        name: string | null;
        phone: string | null;
        district: string | null;
        state: string | null;
        totalAcreage: number | null;
    } | null;
    score: FarmerScoreSnapshot | null;
    retention: {
        riskBand: string;
        retentionScore: number;
        daysSinceLastInbound: number | null;
        calculatedAt: string;
    } | null;
    summary: FarmerIntelligenceSummary | null;
    presentation: FarmerScorePresentation | null;
    componentBreakdown: Array<{
        label: string;
        points: number;
        max: number;
    }>;
    recentEvents: FarmerEventRow[];
    attributions: EmployeeFarmerAttributionRow[];
};
export declare function buildFarmerSummary(score: FarmerScoreSnapshot | null, retention: FarmerIntelligenceProfile['retention']): FarmerIntelligenceSummary | null;
export declare const opportunityIntelligenceDashboardService: {
    getOverview(periodDays?: number): Promise<OpportunityDashboardOverview>;
    getDistrictHeatmap(limit?: number): Promise<DistrictOpportunityRow[]>;
    listAtRiskFarmers(limit?: number): Promise<Array<{
        farmerId: string;
        name: string | null;
        phone: string | null;
        district: string | null;
        opportunityScore: number | null;
        riskBand: string;
        daysSinceLastInbound: number | null;
    }>>;
    listTopFarmers(opts?: {
        limit?: number;
        minScore?: number;
        district?: string;
    }): Promise<Array<{
        farmerId: string;
        opportunityScore: number;
        name: string | null;
        phone: string | null;
        district: string | null;
        riskBand: string | null;
    }>>;
    getFarmerProfile(farmerId: string): Promise<FarmerIntelligenceProfile>;
    listEmployeeLeaderboard(limit?: number): Promise<{
        employeeProfileId: string;
        performanceScore: number;
        attributedFarmerCount: number;
        fullName: string | null;
        email: string | null;
        role: string | null;
        calculatedAt: string;
    }[]>;
    getEmployeeProfileForDashboard(employeeProfileId: string): Promise<{
        performanceBreakdown: {
            label: string;
            pct: number;
        }[];
        leaderboardEligible: boolean;
        employeeProfileId: string;
        performanceScore: number;
        components: import("./opportunity-intelligence.types.js").EmployeeScoreComponents;
        attributedFarmerCount: number;
        factors: import("./opportunity-intelligence.types.js").ScoreFactor[];
        engineVersion: string;
        calculatedAt: string;
    } | null>;
    /** Event volume by type for dashboard chart (last N days). */
    getEventVolumeByType(periodDays?: number, types?: FarmerEventType[]): Promise<Array<{
        eventType: string;
        count: number;
    }>>;
};
//# sourceMappingURL=opportunity-intelligence-dashboard.service.d.ts.map