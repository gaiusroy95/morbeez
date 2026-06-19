export declare const regionalLearningService: {
    resolveCluster(params: {
        farmerId: string;
        cropType: string;
        soilPh?: number;
    }): Promise<{
        clusterKey: string;
    } | null>;
    recordIssueStat(district: string, cropType: string, issueLabel: string): Promise<void>;
};
//# sourceMappingURL=regional-learning.service.d.ts.map