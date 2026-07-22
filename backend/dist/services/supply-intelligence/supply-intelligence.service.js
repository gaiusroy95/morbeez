import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
export const supplyIntelligenceService = {
    enabled() {
        return env.ENABLE_MAIOS_SUPPLY_INTEL === true;
    },
    async suggestFromTags(params) {
        if (!params.productTags.length) {
            return { stockStatus: 'in_stock', substitutes: [], leadTimeDays: null };
        }
        const { data: templates } = await supabase
            .from('recommendation_templates')
            .select('issue_key, products, status')
            .eq('crop_type', params.cropType)
            .in('status', ['approved', 'draft'])
            .limit(50);
        const tagSet = new Set(params.productTags.map((t) => t.toLowerCase()));
        const matches = (templates ?? []).filter((t) => {
            const products = Array.isArray(t.products) ? t.products : [];
            return products.some((p) => {
                const name = typeof p === 'string'
                    ? p
                    : String(p.name ?? p.product ?? '');
                return tagSet.has(name.toLowerCase()) || [...tagSet].some((tag) => name.toLowerCase().includes(tag));
            });
        });
        if (!matches.length) {
            return { stockStatus: 'in_stock', substitutes: [], leadTimeDays: null };
        }
        const approved = matches.filter((m) => m.status === 'approved');
        const stockStatus = approved.length ? 'in_stock' : 'low';
        const substitutes = matches
            .flatMap((m) => (Array.isArray(m.products) ? m.products : []))
            .map((p) => typeof p === 'string' ? p : String(p.name ?? ''))
            .filter(Boolean)
            .slice(0, 3);
        return {
            stockStatus,
            substitutes: [...new Set(substitutes)],
            leadTimeDays: stockStatus === 'low' ? 5 : 3,
        };
    },
    async suggestFulfillment(_params) {
        if (!this.enabled()) {
            return { stockStatus: 'in_stock', substitutes: [], leadTimeDays: null };
        }
        return { stockStatus: 'in_stock', substitutes: [], leadTimeDays: 3 };
    },
};
//# sourceMappingURL=supply-intelligence.service.js.map