export type SpecializedEmployeeRow = {
    employeeProfileId: string;
    performanceScore: number;
    specialtyScore: number;
    attributedFarmerCount: number;
    fullName: string | null;
    email: string | null;
    role: string | null;
    calculatedAt: string;
};
export declare const opportunityEmployeeLeaderboardsService: {
    listTopRelationshipBuilders(limit?: number): Promise<SpecializedEmployeeRow[]>;
    listHighRetentionEmployees(limit?: number): Promise<SpecializedEmployeeRow[]>;
};
//# sourceMappingURL=opportunity-employee-leaderboards.service.d.ts.map