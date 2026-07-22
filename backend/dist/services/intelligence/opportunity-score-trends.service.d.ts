export type ScoreTrendPoint = {
    calculatedAt: string;
    totalScore: number;
    components: Record<string, number>;
};
export declare const opportunityScoreTrendsService: {
    getFarmerTrend(farmerId: string, limit?: number): Promise<ScoreTrendPoint[]>;
    getEmployeeTrend(employeeProfileId: string, limit?: number): Promise<ScoreTrendPoint[]>;
};
//# sourceMappingURL=opportunity-score-trends.service.d.ts.map