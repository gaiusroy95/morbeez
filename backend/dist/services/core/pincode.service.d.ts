export type PincodeRow = {
    id: string;
    pincode: string;
    village: string | null;
    taluk: string;
    district: string;
    state: string;
    latitude: number | null;
    longitude: number | null;
};
export type AssignPincodeResult = {
    row: PincodeRow;
    /** master = cache hit; india_post = live India Post; provisional = accepted while geo unavailable */
    source: 'master' | 'india_post' | 'provisional';
};
export declare const pincodeService: {
    lookupByPincode(pincode: string): Promise<PincodeRow | null>;
    search(params: {
        district?: string;
        q?: string;
        limit?: number;
    }): Promise<PincodeRow[]>;
    upsertMaster(row: Omit<PincodeRow, "id">): Promise<PincodeRow>;
    /**
     * Resolve any valid Indian 6-digit PIN dynamically.
     * Cache → India Post (authoritative) → provisional accept if API is down.
     * No hardcoded PIN allowlist.
     */
    resolvePincode(pincode: string): Promise<AssignPincodeResult | null>;
    assignFarmerPincodeDetailed(farmerId: string, pincode: string): Promise<AssignPincodeResult | null>;
    assignFarmerPincode(farmerId: string, pincode: string): Promise<PincodeRow | null>;
};
//# sourceMappingURL=pincode.service.d.ts.map