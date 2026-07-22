import { supabase } from '../../../lib/supabase.js';
import { conversationSessionService } from '../conversation-session.service.js';
import { dosageCalculatorService } from './dosage-calculator.service.js';
import { shopifyLinksService } from '../../shopify/shopify-links.service.js';
import { t } from './whatsapp-flow-copy.js';
import { diagnosisSessionEvidenceService } from '../pipeline/diagnosis-session-evidence.service.js';
export const diagnosisFlowService = {
    async recordImageReceived(farmerId) {
        const ctx = await conversationSessionService.getContext(farmerId);
        const prev = ctx.diagnosis?.imageCount ?? 0;
        const imageCount = prev + 1;
        await conversationSessionService.patchContext(farmerId, {
            diagnosis: { ...ctx.diagnosis, imageCount },
        });
        return { imageCount, shouldRunDiagnosis: imageCount >= 1 };
    },
    firstImagePrompt(language) {
        return t('imageReceived', language);
    },
    analyzingPrompt(language) {
        return t('sendMorePhotos', language);
    },
    async storeDiagnosisResult(farmerId, sessionId, advisory, summary, options) {
        const dosageItems = advisory.dosageGuidance ?? [];
        await diagnosisSessionEvidenceService.bindSession(farmerId, sessionId, {
            photoPaths: options?.photoPaths,
            summary,
            dosageItems,
        });
        await diagnosisSessionEvidenceService.appendTranscript(farmerId, 'assistant', `Diagnosis delivered: ${advisory.probableIssue} (${Math.round((advisory.confidence ?? 0) * 100)}%). ${summary.slice(0, 280)}`);
        if (dosageItems.length > 0) {
            await conversationSessionService.setState(farmerId, 'diagnosis_water_volume');
        }
        else if (advisory.escalationRecommended || advisory.confidence < 0.55) {
            await conversationSessionService.setState(farmerId, 'root_photos_requested');
        }
        else {
            await conversationSessionService.setState(farmerId, 'main_menu');
        }
    },
    waterVolumeList(language) {
        return {
            body: t('waterVolumePrompt', language),
            buttonText: language === 'ml' ? 'തിരഞ്ഞെടുക്കുക' : 'Choose',
            sections: [
                {
                    title: 'Water',
                    rows: [
                        { id: 'water.200', title: '200L', description: 'Standard tank' },
                        { id: 'water.400', title: '400L', description: 'Large tank' },
                        { id: 'water.custom', title: 'Custom', description: 'Type liters' },
                        { id: 'action.callback', title: 'Callback', description: 'Talk to team' },
                    ],
                },
            ],
        };
    },
    async formatQuantityReply(farmerId, language, waterLiters) {
        const ctx = await conversationSessionService.getContext(farmerId);
        const items = ctx.diagnosis?.dosageItems ?? [];
        if (!items.length) {
            return `${t('quantityResult', language)}\n\nNo dosage data from last diagnosis.`;
        }
        const calculated = await dosageCalculatorService.calculateForWaterVolume(items, waterLiters);
        const lines = [t('quantityResult', language), ''];
        for (const c of calculated) {
            lines.push(`• ${c.product} → ${c.assignedKg}kg` +
                (c.requiredKg !== c.assignedKg ? ` (needed ~${c.requiredKg}kg, rounded up)` : '') +
                `\n  Packs: ${c.packLine}`);
        }
        return lines.join('\n');
    },
    quantityActionButtons(language) {
        return {
            prompt: t('quantitySelectPrompt', language),
            options: [
                { id: 'action.buy', title: 'Buy' },
                { id: 'action.technical', title: 'Technical' },
                { id: 'action.callback', title: 'Callback' },
            ],
        };
    },
    async formatBuyReply(farmerId, language) {
        const ctx = await conversationSessionService.getContext(farmerId);
        const sessionId = ctx.diagnosis?.lastSessionId;
        if (!sessionId) {
            return diagnosisFlowService.productUnavailableReply(language);
        }
        const { data: recs } = await supabase
            .from('ai_product_recommendations')
            .select('product_title, shopify_product_handle, reason, priority')
            .eq('session_id', sessionId)
            .order('priority', { ascending: true });
        if (!recs?.length) {
            return diagnosisFlowService.productUnavailableReply(language);
        }
        const block = shopifyLinksService.formatRecommendationsForWhatsApp(recs.map((r) => ({
            productTitle: String(r.product_title),
            shopifyProductHandle: r.shopify_product_handle ? String(r.shopify_product_handle) : undefined,
            reason: String(r.reason ?? ''),
            priority: Number(r.priority ?? 1),
        })), language);
        return block || diagnosisFlowService.productUnavailableReply(language);
    },
    technicalOnlyReply(advisory, language) {
        const lines = [t('technicalOnly', language), ''];
        for (const d of advisory.dosageGuidance ?? []) {
            lines.push(`• ${d.product}\n  ${d.rate}\n  ${d.method}`);
        }
        return lines.join('\n');
    },
    productUnavailableReply(language) {
        return t('productUnavailable', language);
    },
    lowConfidenceReply(language) {
        return t('lowConfidence', language);
    },
    rootPhotosReply(language) {
        return t('rootPhotosNeeded', language);
    },
    duplicateImageReply(language, previousSummary) {
        const base = t('duplicateImage', language);
        if (previousSummary)
            return `${base}\n\nPrevious:\n${previousSummary.slice(0, 500)}`;
        return base;
    },
    parseWaterLiters(text) {
        if (text === 'water.200')
            return 200;
        if (text === 'water.400')
            return 400;
        const m = text.match(/(\d{2,4})\s*l/i) ?? text.match(/^(\d{2,4})$/);
        if (m) {
            const n = Number(m[1]);
            if (n >= 50 && n <= 5000)
                return n;
        }
        return null;
    },
};
//# sourceMappingURL=diagnosis-flow.service.js.map