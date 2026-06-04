export type FarmerPincodeRegion = {
    pincode: string;
    village: string | null;
    taluk: string;
    district: string;
    state: string;
    lat: number | null;
    lon: number | null;
    /** Local mandi label for the card header */
    marketDisplayLabel: string;
};
export declare const marketInsightRegionService: {
    resolveForFarmer(farmerId: string): Promise<FarmerPincodeRegion | null>;
};
//# sourceMappingURL=market-insight-region.service.d.ts.map