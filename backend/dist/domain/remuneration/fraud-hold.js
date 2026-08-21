export const FRAUD_FLAG_TYPES = [
    'duplicate_claim',
    'gps_missing',
    'fake_visit',
    'fake_km',
    'introduction_fraud',
    'order_fraud',
    'manual',
];
export const FRAUD_FLAG_STATUSES = ['open', 'confirmed', 'cleared'];
export function blocksPayout(status) {
    return status === 'open' || status === 'confirmed';
}
export function payoutHoldFromFlags(flags) {
    const openCount = flags.filter((f) => f.status === 'open').length;
    const confirmedCount = flags.filter((f) => f.status === 'confirmed').length;
    return {
        hold: openCount + confirmedCount > 0,
        openCount,
        confirmedCount,
    };
}
//# sourceMappingURL=fraud-hold.js.map