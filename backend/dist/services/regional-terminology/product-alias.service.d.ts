export type ProductAliasMatch = {
    id: string;
    alias: string;
    language: string;
    canonicalProductKey: string;
    shopifyProductId: string | null;
    cropType: string | null;
    district: string | null;
    farmerId: string | null;
    status: string;
    source: 'farmer' | 'district_crop' | 'crop' | 'global';
};
export declare const productAliasService: {
    resolve(params: {
        alias: string;
        language: string;
        farmerId?: string | null;
        cropType?: string | null;
        district?: string | null;
    }): Promise<ProductAliasMatch | null>;
    propose(params: {
        alias: string;
        language: string;
        canonicalProductKey: string;
        shopifyProductId?: string | null;
        farmerId?: string | null;
        cropType?: string | null;
        district?: string | null;
        proposedBy?: string | null;
        sourceDraftId?: string | null;
        sourceMessageId?: string | null;
        reviewTaskId?: string | null;
        metadata?: Record<string, unknown>;
    }): Promise<ProductAliasMatch>;
    list(params?: {
        status?: string;
        language?: string;
        search?: string;
        limit?: number;
    }): Promise<ProductAliasMatch[]>;
    setStatus(params: {
        id: string;
        status: "approved" | "rejected" | "retired" | "pending";
        approvedBy?: string | null;
    }): Promise<ProductAliasMatch>;
};
//# sourceMappingURL=product-alias.service.d.ts.map