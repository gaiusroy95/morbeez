export type CompatibilityOverridePair = {
    productA: string;
    productB: string;
    status?: string;
    compatible?: boolean | null;
};
export declare const compatibilityOverrideService: {
    logApproval(input: {
        fieldFindingId: string;
        farmerId: string;
        blockId?: string | null;
        approvedBy: string;
        overrideReason: string;
        incompatiblePairs?: CompatibilityOverridePair[];
        materials?: Array<{
            technicalName: string;
        }>;
    }): Promise<void>;
    listAggregates(days?: number): Promise<{
        totalOverrides: number;
        byPair: Array<{
            productA: string;
            productB: string;
            count: number;
        }>;
        unknownPairRate: number;
        unknownPairChecks: number;
        unknownPairHits: number;
    }>;
};
//# sourceMappingURL=compatibility-override.service.d.ts.map