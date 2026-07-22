/** Build a public carrier tracking URL from AWB / courier metadata. */
export function delhiveryTrackUrl(awb) {
    const clean = awb.replace(/\s/g, '');
    return `https://www.delhivery.com/track-v2/package/${encodeURIComponent(clean)}`;
}
export function resolveTrackingUrl(input) {
    const stored = input.trackingUrl?.trim();
    if (stored && stored.startsWith('http'))
        return stored;
    const id = input.trackingId?.trim();
    if (!id || id === '—')
        return null;
    // Delhivery is the default last-mile partner (often via Shiprocket rules).
    return delhiveryTrackUrl(id);
}
export function trackingLinkLabel(courier, trackingId) {
    const c = (courier ?? '').trim();
    if (c && c !== '—')
        return `Track on ${c}`;
    return `Track shipment ${trackingId}`;
}
//# sourceMappingURL=shipment-tracking.js.map