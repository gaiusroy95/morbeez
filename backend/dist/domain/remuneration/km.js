const EARTH_KM = 6371;
function toRad(deg) {
    return (deg * Math.PI) / 180;
}
/** Great-circle distance in km. Returns null when coordinates are unusable. */
export function haversineKm(from, to) {
    const aLat = from.lat;
    const aLng = from.lng;
    const bLat = to.lat;
    const bLng = to.lng;
    if (aLat == null || aLng == null || bLat == null || bLng == null)
        return null;
    const lat1 = Number(aLat);
    const lng1 = Number(aLng);
    const lat2 = Number(bLat);
    const lng2 = Number(bLng);
    if (![lat1, lng1, lat2, lng2].every((n) => Number.isFinite(n)))
        return null;
    if (Math.abs(lat1) > 90 || Math.abs(lat2) > 90)
        return null;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const km = 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
    if (!Number.isFinite(km) || km < 0.05)
        return null;
    return Math.round(km * 100) / 100;
}
export function kmAllowanceInr(km, ratePerKm) {
    if (km <= 0 || ratePerKm <= 0)
        return 0;
    return Math.round(km * ratePerKm * 100) / 100;
}
//# sourceMappingURL=km.js.map