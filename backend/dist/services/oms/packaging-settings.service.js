import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
const DEFAULTS = {
    defaultUnitWeightKg: 0.15,
    volumetricDivisorCm: 5000,
    minBillingWeightKg: 0.2,
};
let cache = null;
let cacheAt = 0;
const CACHE_MS = 30_000;
function parseNum(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim()) {
        const n = Number(value);
        if (Number.isFinite(n))
            return n;
    }
    return fallback;
}
export const packagingSettingsService = {
    async getSettings() {
        if (cache && Date.now() - cacheAt < CACHE_MS)
            return cache;
        const { data, error } = await supabase.from('packaging_settings').select('key, value');
        throwIfSupabaseError(error, 'Load packaging settings');
        const map = new Map((data ?? []).map((r) => [String(r.key), r.value]));
        const settings = {
            defaultUnitWeightKg: parseNum(map.get('default_unit_weight_kg'), DEFAULTS.defaultUnitWeightKg),
            volumetricDivisorCm: parseNum(map.get('volumetric_divisor_cm'), DEFAULTS.volumetricDivisorCm),
            minBillingWeightKg: parseNum(map.get('min_billing_weight_kg'), DEFAULTS.minBillingWeightKg),
        };
        cache = settings;
        cacheAt = Date.now();
        return settings;
    },
    clearCache() {
        cache = null;
        cacheAt = 0;
    },
    async listAll() {
        const { data, error } = await supabase
            .from('packaging_settings')
            .select('key, value, description, updated_at')
            .order('key');
        throwIfSupabaseError(error, 'List packaging settings');
        return (data ?? []).map((r) => ({
            key: String(r.key),
            value: r.value,
            description: r.description ? String(r.description) : null,
            updatedAt: r.updated_at ? String(r.updated_at) : null,
        }));
    },
    async update(key, value, description) {
        const { data, error } = await supabase
            .from('packaging_settings')
            .upsert({
            key,
            value,
            description: description ?? null,
            updated_at: new Date().toISOString(),
        })
            .select('key, value, description, updated_at')
            .single();
        throwIfSupabaseError(error, 'Update packaging setting');
        if (!data)
            throw new Error('Update packaging setting returned no row');
        this.clearCache();
        return {
            key: String(data.key),
            value: data.value,
            description: data.description ? String(data.description) : null,
            updatedAt: data.updated_at ? String(data.updated_at) : null,
        };
    },
};
//# sourceMappingURL=packaging-settings.service.js.map