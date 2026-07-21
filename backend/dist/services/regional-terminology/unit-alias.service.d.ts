export declare const FARM_ACTIVITY_CANONICAL_UNITS: readonly ["kg", "g", "litre", "ml", "quintal", "tonne", "bag", "piece", "hour", "day", "acre", "other"];
export type FarmActivityCanonicalUnit = (typeof FARM_ACTIVITY_CANONICAL_UNITS)[number];
export type UnitAliasMatch = {
    id: string;
    alias: string;
    language: string;
    canonicalUnit: FarmActivityCanonicalUnit;
    cropType: string | null;
    district: string | null;
    farmerId: string | null;
    status: string;
    source: 'farmer' | 'district_crop' | 'crop' | 'global' | 'builtin';
};
export declare const unitAliasService: {
    resolve(params: {
        alias: string;
        language: string;
        farmerId?: string | null;
        cropType?: string | null;
        district?: string | null;
    }): Promise<UnitAliasMatch | null>;
    propose(params: {
        alias: string;
        language: string;
        canonicalUnit: FarmActivityCanonicalUnit;
        farmerId?: string | null;
        cropType?: string | null;
        district?: string | null;
        proposedBy?: string | null;
        sourceDraftId?: string | null;
        sourceMessageId?: string | null;
        reviewTaskId?: string | null;
        metadata?: Record<string, unknown>;
    }): Promise<UnitAliasMatch>;
    list(params?: {
        status?: string;
        language?: string;
        search?: string;
        limit?: number;
    }): Promise<UnitAliasMatch[]>;
    setStatus(params: {
        id: string;
        status: "approved" | "rejected" | "retired" | "pending";
        approvedBy?: string | null;
    }): Promise<UnitAliasMatch>;
};
//# sourceMappingURL=unit-alias.service.d.ts.map