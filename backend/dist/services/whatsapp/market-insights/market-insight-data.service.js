import { env } from '../../../config/env.js';
import { supabase } from '../../../lib/supabase.js';
import { marketInsightAiService } from './market-insight-ai.service.js';
import { marketInsightRegionService } from './market-insight-region.service.js';
/** Legacy fallback when OpenAI is off — uses admin `crop_daily_prices`. */
async function buildFromManualPrices(farmerId, insightDate, regionDistrict) {
    const districtKey = regionDistrict.toLowerCase().replace(/\s+/g, '');
    const { data: profile } = await supabase
        .from('market_insight_district_profiles')
        .select('*')
        .eq('district_key', districtKey)
        .eq('active', true)
        .maybeSingle();
    const fallbackProfile = profile ??
        (await supabase
            .from('market_insight_district_profiles')
            .select('*')
            .eq('district_key', 'wayanad')
            .maybeSingle()).data;
    if (!fallbackProfile) {
        return { ok: false, error: 'No district profile and OpenAI fetch unavailable' };
    }
    const crops = fallbackProfile.crop_cards ?? ['ginger'];
    const marketName = String(fallbackProfile.market_name);
    const { data: prefs } = await supabase
        .from('farmer_market_preferences')
        .select('market_name')
        .eq('farmer_id', farmerId)
        .eq('active', true)
        .limit(1);
    const resolvedMarket = String(prefs?.[0]?.market_name ?? marketName);
    const { marketInsightLegacyDataService } = await import('./market-insight-legacy-data.service.js');
    return marketInsightLegacyDataService.build({
        insightDate,
        farmerId,
        profile: fallbackProfile,
        marketName: resolvedMarket,
        crops,
        districtLabel: regionDistrict,
    });
}
export const marketInsightDataService = {
    todayInIst() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    },
    async buildForFarmer(farmerId, insightDate) {
        const date = insightDate ?? this.todayInIst();
        const region = await marketInsightRegionService.resolveForFarmer(farmerId);
        if (!region) {
            return {
                ok: false,
                error: 'Farmer region requires a 6-digit PIN (pincode_id or delivery_pincode in pincode_master)',
            };
        }
        if (env.ENABLE_MARKET_INSIGHT_OPENAI && env.OPENAI_API_KEY?.trim()) {
            const payload = await marketInsightAiService.fetchForPincode(region, date);
            if (payload) {
                return { ok: true, payload };
            }
        }
        return buildFromManualPrices(farmerId, date, region.district);
    },
};
//# sourceMappingURL=market-insight-data.service.js.map