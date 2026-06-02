import { supabase } from '../../../lib/supabase.js';
import { leadService } from '../../crm/lead.service.js';
import { farmerService } from '../../farmer/farmer.service.js';
export const leadCaptureService = {
    async captureAndIdentify(msg, languageHint) {
        const farmer = await farmerService.upsertFromWhatsApp({
            phone: msg.phone,
            name: msg.profileName,
            preferredLanguage: languageHint,
        });
        const storedLang = (farmer.preferred_language ?? languageHint ?? 'en');
        const meta = (farmer.metadata ?? {});
        const isPremium = Boolean(meta.premium ?? meta.is_premium);
        const { count: historicalLeadCount } = await supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('farmer_id', farmer.id);
        const hadHistoricalLead = (historicalLeadCount ?? 0) > 0;
        await leadService.ensureLeadForFarmer({
            farmerId: farmer.id,
            intent: 'general',
            source: 'whatsapp',
            status: 'new',
            stage: 'new_lead',
            notes: msg.text?.slice(0, 300) || `Inbound ${msg.msgType}`,
            mergeNotes: true,
            campaign_source: msg.attribution?.campaignSource ?? null,
            referral_source: msg.attribution?.referralSource ?? 'whatsapp',
            affiliate_source: msg.attribution?.affiliateSource ?? null,
            whatsapp_profile_name: msg.profileName ?? null,
        });
        return {
            farmerId: farmer.id,
            phone: msg.phone,
            language: storedLang,
            isPremium,
            hadHistoricalLead,
        };
    },
};
//# sourceMappingURL=lead-capture.service.js.map