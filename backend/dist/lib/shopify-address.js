/** Shopify expects full country name and valid Indian province names on orders. */
const INDIAN_STATE_ALIASES = {
    kl: 'Kerala',
    kerala: 'Kerala',
    ka: 'Karnataka',
    karnataka: 'Karnataka',
    tn: 'Tamil Nadu',
    'tamil nadu': 'Tamil Nadu',
    mh: 'Maharashtra',
    maharashtra: 'Maharashtra',
    dl: 'Delhi',
    delhi: 'Delhi',
    ts: 'Telangana',
    telangana: 'Telangana',
    ap: 'Andhra Pradesh',
    'andhra pradesh': 'Andhra Pradesh',
    gj: 'Gujarat',
    gujarat: 'Gujarat',
    wb: 'West Bengal',
    'west bengal': 'West Bengal',
    up: 'Uttar Pradesh',
    'uttar pradesh': 'Uttar Pradesh',
    rj: 'Rajasthan',
    rajasthan: 'Rajasthan',
    mp: 'Madhya Pradesh',
    'madhya pradesh': 'Madhya Pradesh',
    pb: 'Punjab',
    punjab: 'Punjab',
    hr: 'Haryana',
    haryana: 'Haryana',
};
export function normalizeShopifyCountry(country) {
    const c = (country ?? '').trim();
    if (!c || c === 'IN' || c.toLowerCase() === 'india')
        return 'India';
    return c;
}
export function normalizeShopifyProvince(state) {
    const raw = (state ?? '').trim();
    if (!raw)
        return 'Kerala';
    const key = raw.toLowerCase();
    return INDIAN_STATE_ALIASES[key] ?? raw;
}
export function normalizeShopifyPincode(zip) {
    const digits = String(zip ?? '').replace(/\D/g, '');
    if (digits.length >= 6)
        return digits.slice(0, 6);
    if (digits.length > 0)
        return digits.padStart(6, '0');
    return '680001';
}
export function normalizeShopifyPhone(phone) {
    const digits = String(phone ?? '').replace(/\D/g, '');
    if (digits.length >= 10) {
        const local = digits.slice(-10);
        return `+91${local}`;
    }
    return '+919999999999';
}
export function parseShopifyErrorBody(text) {
    try {
        const json = JSON.parse(text);
        const errors = json.errors;
        if (typeof errors === 'string')
            return errors;
        if (Array.isArray(errors))
            return errors.map(String).join('; ');
        if (errors && typeof errors === 'object') {
            return Object.entries(errors)
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
                .join('; ');
        }
        if (typeof json.error === 'string')
            return json.error;
    }
    catch {
        /* fall through */
    }
    return text.slice(0, 400);
}
//# sourceMappingURL=shopify-address.js.map