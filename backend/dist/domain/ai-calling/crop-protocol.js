export const DEFAULT_HEALTH_FOLLOW_UP_DAYS = [1, 3, 7];
export function daysAfterPlanting(plantingDateIso, onDate = new Date()) {
    const planted = new Date(plantingDateIso);
    if (Number.isNaN(planted.getTime()))
        return null;
    const ms = onDate.getTime() - planted.getTime();
    if (ms < 0)
        return 0;
    return Math.floor(ms / (24 * 60 * 60 * 1000));
}
export function matchProtocolForDap(protocols, cropType, dap) {
    const crop = cropType.trim().toLowerCase();
    const rows = protocols
        .filter((p) => p.cropType.toLowerCase() === crop)
        .sort((a, b) => a.dapFrom - b.dapFrom);
    return rows.find((p) => dap >= p.dapFrom && dap <= p.dapTo) ?? null;
}
export function healthFollowUpAt(from, dayOffset) {
    const d = new Date(from.getTime());
    d.setUTCDate(d.getUTCDate() + dayOffset);
    return d;
}
export function isApplicationDue(protocol, dap) {
    return dap >= protocol.dapFrom && dap <= protocol.dapTo;
}
//# sourceMappingURL=crop-protocol.js.map