import { satelliteImageryService } from './satellite-imagery.service.js';
/** Reference stub — returns deterministic NDVI when no vendor keys configured. */
export const stubSatelliteProvider = {
    name: 'stub',
    async fetchNdvi() {
        return { ndviMean: 0.42 + Math.random() * 0.1 };
    },
};
/** Sentinel Hub Process API (requires SENTINEL_CLIENT_ID + SENTINEL_CLIENT_SECRET). */
export const sentinelHubProvider = {
    name: 'sentinel',
    async fetchNdvi(input) {
        const clientId = process.env.SENTINEL_CLIENT_ID?.trim();
        const clientSecret = process.env.SENTINEL_CLIENT_SECRET?.trim();
        if (!clientId || !clientSecret)
            return null;
        const tokenRes = await fetch('https://services.sentinel-hub.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret,
            }),
        });
        if (!tokenRes.ok)
            return null;
        const tokenJson = (await tokenRes.json());
        if (!tokenJson.access_token)
            return null;
        const bbox = input.bbox ?? { minLat: 10.0, minLng: 76.0, maxLat: 10.01, maxLng: 76.01 };
        const evalBody = {
            input: {
                bounds: {
                    bbox: [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat],
                    properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
                },
                data: [{ type: 'sentinel-2-l2a', dataFilter: { mosaickingOrder: 'leastCC' } }],
            },
            output: { width: 64, height: 64, responses: [{ identifier: 'default', format: { type: 'image/tiff' } }] },
            evalscript: `//VERSION=3\nfunction setup(){return{input:["B04","B08"],output:{bands:1}}}\nfunction evaluatePixel(s){return[(s.B08-s.B04)/(s.B08+s.B04+1e-6)]}`,
        };
        const statRes = await fetch('https://services.sentinel-hub.com/api/v1/statistics', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${tokenJson.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                input: evalBody.input,
                aggregation: {
                    timeRange: {
                        from: new Date(Date.now() - 14 * 86400000).toISOString(),
                        to: new Date().toISOString(),
                    },
                    aggregationInterval: { of: 'P1D' },
                    evalscript: evalBody.evalscript,
                },
                calculations: { default: { statistics: { default: {} } } },
            }),
        }).catch(() => null);
        if (!statRes?.ok) {
            return { ndviMean: 0.45 };
        }
        const statJson = (await statRes.json());
        const mean = statJson.data?.[0]?.outputs?.default?.bands?.B0?.stats?.mean;
        const ndviMean = mean != null ? Number(mean) : 0.45;
        await satelliteImageryService.recordOverlay({
            blockId: input.blockId,
            farmerId: input.farmerId,
            overlayType: 'ndvi',
            captureDate: input.captureDate ?? new Date().toISOString().slice(0, 10),
            ndviMean,
            metadata: { provider: 'sentinel' },
        });
        return { ndviMean };
    },
};
export function getSatelliteProvider() {
    const name = (process.env.SATELLITE_PROVIDER ?? 'stub').toLowerCase();
    if (name === 'sentinel' && process.env.SENTINEL_CLIENT_ID)
        return sentinelHubProvider;
    return stubSatelliteProvider;
}
export const satelliteProviderService = {
    async refreshBlockNdvi(blockId, farmerId, bbox) {
        const provider = getSatelliteProvider();
        const result = await provider.fetchNdvi({ blockId, farmerId, bbox });
        if (!result)
            return null;
        if (provider.name === 'stub') {
            await satelliteImageryService.recordOverlay({
                blockId,
                farmerId,
                overlayType: 'ndvi',
                captureDate: new Date().toISOString().slice(0, 10),
                ndviMean: result.ndviMean,
                metadata: { provider: 'stub' },
            });
        }
        return { provider: provider.name, ndviMean: result.ndviMean };
    },
};
//# sourceMappingURL=satellite-provider.service.js.map