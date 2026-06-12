export const LEAD_CHANNELS = [
    'meta',
    'instagram',
    'google',
    'referral',
    'organic',
    'whatsapp',
    'field',
    'other',
];
export const CONNECTED_CALL_OUTCOMES = new Set(['answered', 'connected', 'callback']);
export const INTERESTED_STAGES = new Set([
    'interested',
    'follow_up',
    'recommendation',
    'order_placed',
    'repeat_customer',
]);
export const PAID_STAGES = new Set(['order_placed', 'repeat_customer']);
export const STAGE_RANK = {
    new_lead: 1,
    interested: 2,
    follow_up: 3,
    recommendation: 4,
    order_placed: 5,
    repeat_customer: 6,
};
export function leadChannelFromUtm(utmSource, utmMedium) {
    const src = String(utmSource ?? '').toLowerCase();
    const medium = String(utmMedium ?? '').toLowerCase();
    if (src.includes('instagram') || medium.includes('instagram'))
        return 'instagram';
    if (src.includes('facebook') ||
        src.includes('meta') ||
        src.includes('fb') ||
        medium.includes('cpc') && (src.includes('facebook') || src.includes('meta'))) {
        return 'meta';
    }
    if (src.includes('google') || medium.includes('google'))
        return 'google';
    if (medium === 'referral' || src.includes('referral'))
        return 'referral';
    if (!src && !medium)
        return 'organic';
    return 'other';
}
export function attributionBadge(channel, campaign) {
    const ch = channel?.trim();
    const camp = campaign?.trim();
    if (!ch && !camp)
        return null;
    const channelLabel = ch ? ch.charAt(0).toUpperCase() + ch.slice(1) : 'Unknown';
    if (camp)
        return `${channelLabel} · ${camp}`;
    return channelLabel;
}
//# sourceMappingURL=lead-attribution.js.map