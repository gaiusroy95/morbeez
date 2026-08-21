/** Great-circle distance in km. Returns null when coordinates are unusable. */
export declare function haversineKm(from: {
    lat?: number | null;
    lng?: number | null;
}, to: {
    lat?: number | null;
    lng?: number | null;
}): number | null;
export declare function kmAllowanceInr(km: number, ratePerKm: number): number;
//# sourceMappingURL=km.d.ts.map