export type SatelliteFetchInput = {
    blockId: string;
    farmerId: string;
    bbox?: {
        minLat: number;
        minLng: number;
        maxLat: number;
        maxLng: number;
    };
    captureDate?: string;
};
export type SatelliteProvider = {
    name: string;
    fetchNdvi(input: SatelliteFetchInput): Promise<{
        ndviMean: number;
        storageUrl?: string;
    } | null>;
};
/** Reference stub — returns deterministic NDVI when no vendor keys configured. */
export declare const stubSatelliteProvider: SatelliteProvider;
/** Sentinel Hub Process API (requires SENTINEL_CLIENT_ID + SENTINEL_CLIENT_SECRET). */
export declare const sentinelHubProvider: SatelliteProvider;
export declare function getSatelliteProvider(): SatelliteProvider;
export declare const satelliteProviderService: {
    refreshBlockNdvi(blockId: string, farmerId: string, bbox?: SatelliteFetchInput["bbox"]): Promise<{
        provider: string;
        ndviMean: number;
    } | null>;
};
//# sourceMappingURL=satellite-provider.service.d.ts.map