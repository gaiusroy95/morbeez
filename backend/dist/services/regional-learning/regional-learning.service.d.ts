export declare const regionalLearningService: {
    resolveCluster(params: {
        farmerId: string;
        cropType: string;
        soilPh?: number;
    }): Promise<{
        clusterKey: string;
    } | null>;
    topIssuePriors(cropType: string, district: string): Promise<Array<{
        issueLabel: string;
        caseCount: number;
    }>>;
    recordIssueStat(district: string, cropType: string, issueLabel: string): Promise<void>;
    recordProtocolOutcome(params: {
        district: string;
        cropType: string;
        issueLabel: string;
        protocolKey: string;
        success: boolean;
    }): Promise<void>;
    rankTemplates(cropType: string, district: string, issueLabel: string): Promise<Array<{
        protocolKey: string;
        successRate: number;
    }>>;
};
//# sourceMappingURL=regional-learning.service.d.ts.map