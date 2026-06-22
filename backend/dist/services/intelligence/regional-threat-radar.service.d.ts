export type RegionalThreatRow = {
    district: string;
    cropType: string;
    issueLabel: string;
    threatLevel: 'low' | 'medium' | 'high' | 'critical';
    caseCount7d: number;
    trendDirection: 'rising' | 'stable' | 'falling';
    reasoning: string;
};
export declare const regionalThreatRadarService: {
    computeForDistrict(district: string, cropType: string): Promise<RegionalThreatRow[]>;
    refreshAndPersist(district: string, cropType: string): Promise<RegionalThreatRow[]>;
    listActive(opts?: {
        district?: string;
        cropType?: string;
        limit?: number;
    }): Promise<{
        id: string;
        district: string;
        cropType: string;
        issueLabel: string;
        threatLevel: RegionalThreatRow["threatLevel"];
        caseCount7d: number;
        trendDirection: RegionalThreatRow["trendDirection"];
        reasoning: string;
        computedAt: string;
    }[]>;
    riskFlagsForFarmer(farmerId: string, cropType: string): Promise<string[]>;
};
//# sourceMappingURL=regional-threat-radar.service.d.ts.map