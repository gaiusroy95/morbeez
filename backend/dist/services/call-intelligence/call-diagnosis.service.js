import { supabase } from '../../lib/supabase.js';
import { cropDoctorService } from '../ai/crop-doctor.service.js';
import { contextPackService } from '../whatsapp/pipeline/context-pack.service.js';
import { blockService } from '../core/block.service.js';
import { conversationIntelligenceService } from './conversation-intelligence.service.js';
export const callDiagnosisService = {
    async runFromTranscript(input) {
        const { data: farmer } = await supabase
            .from('farmers')
            .select('phone, preferred_language, district')
            .eq('id', input.farmerId)
            .maybeSingle();
        const language = (farmer?.preferred_language ?? 'en');
        const { expandedText } = await conversationIntelligenceService.processText({
            farmerId: input.farmerId,
            leadId: input.leadId,
            text: input.transcript,
            channel: 'call',
            language,
            district: farmer?.district ? String(farmer.district) : null,
        });
        const primary = await blockService.getPrimaryBlock(input.farmerId);
        const cropType = primary?.crop_type ?? 'crop';
        const pack = await contextPackService.build(input.farmerId, {
            blockId: input.blockId ?? primary?.id ?? undefined,
            cropType,
            symptomsText: expandedText,
        });
        const result = await cropDoctorService.diagnose({
            farmerId: input.farmerId,
            phone: farmer?.phone ? String(farmer.phone) : undefined,
            cropType,
            language,
            symptomsText: expandedText,
            voiceTranscript: input.transcript,
            channel: 'telecaller',
            contextPack: pack,
            environmentalContext: contextPackService.formatForPrompt(pack),
            imageBase64: input.imageBase64,
            imageMimeType: input.imageMimeType,
        });
        return result;
    },
};
//# sourceMappingURL=call-diagnosis.service.js.map