import { supabase } from '../../lib/supabase.js';
import { blockService } from '../core/block.service.js';
import { terminologyDetectionEngine } from '../regional-terminology/terminology-detection.engine.js';
import { terminologyEscalationService } from '../regional-terminology/terminology-escalation.service.js';
import { farmerMessageStoreService } from '../regional-terminology/farmer-message-store.service.js';
async function farmerContext(farmerId) {
    const { data: farmer } = await supabase
        .from('farmers')
        .select('district, preferred_language')
        .eq('id', farmerId)
        .maybeSingle();
    const primary = await blockService.getPrimaryBlock(farmerId);
    return {
        district: farmer?.district ? String(farmer.district) : null,
        cropType: primary?.crop_type?.toLowerCase() ?? null,
        language: (farmer?.preferred_language ?? 'en'),
    };
}
export const conversationIntelligenceService = {
    async processText(input) {
        const ctx = await farmerContext(input.farmerId);
        const language = input.language ?? ctx.language;
        const district = input.district ?? ctx.district;
        const cropType = input.cropType ?? ctx.cropType;
        const text = input.text.trim();
        if (!text) {
            return { expandedText: '', detection: null, unknownTerms: [] };
        }
        await farmerMessageStoreService.record({
            farmerId: input.farmerId,
            rawMessage: text,
            detectedLanguage: language,
            channel: input.channel,
            messageType: input.channel === 'call' ? 'call_transcript' : 'note',
        });
        const detection = await terminologyDetectionEngine.detect({
            rawMessage: text,
            language,
            cropType,
            district,
        });
        const unknownTerms = [];
        for (const term of detection.unknownTerms) {
            unknownTerms.push(term.token);
            await terminologyEscalationService.escalateUnknown({
                farmerId: input.farmerId,
                unknownWord: term.token,
                rawMessage: text,
                language,
                cropType,
                district,
            });
            await supabase
                .from('terminology_review_tasks')
                .update({ source_channel: input.channel === 'field' ? 'field' : input.channel })
                .eq('term', term.token.toLowerCase())
                .in('status', ['open', 'in_review']);
        }
        return {
            expandedText: detection.expandedForAi || text,
            detection,
            unknownTerms,
        };
    },
};
//# sourceMappingURL=conversation-intelligence.service.js.map