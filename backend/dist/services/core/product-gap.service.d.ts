export declare const productGapService: {
    incrementFromRecommendation(params: {
        technicalName: string;
        cropType?: string;
        cropSubtype?: string;
        district?: string | null;
        recommendationRecordId?: string;
    }): Promise<void>;
    listOpen(limit?: number): Promise<any[]>;
    updateStatus(id: string, status: "open" | "reviewing" | "sourcing" | "resolved"): Promise<any>;
    /** Read-only commerce inventory + rough ETA for gap sourcing (Shopify + WMS). */
    getCommerceInventoryEta(technicalName: string): Promise<{
        technicalName: string;
        availableQty: number;
        etaDays: number | null;
        source: "commerce" | "wms" | "none";
        matchedTitle: string | null;
    } | null>;
    /** Suggest substitute technicals from rotation rules + commerce catalog. */
    listAlternatives(technicalName: string, cropType?: string): Promise<Array<{
        technicalName: string;
        reason: string;
        availableQty?: number;
    }>>;
};
//# sourceMappingURL=product-gap.service.d.ts.map