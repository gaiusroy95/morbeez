import { regionalTerminologyProcessor } from '../../regional-terminology/regional-terminology.processor.js';
import { terminologyAiContextService } from '../../regional-terminology/terminology-ai-context.service.js';
import { farmerService } from '../../farmer/farmer.service.js';
import { whatsappConversationalService } from '../whatsapp-conversational.service.js';
import { aiUsageControlService } from './ai-usage-control.service.js';
import { isExplicitAgronomyQuestion } from './agriculture-free-text.service.js';
import { compatibilityLookupService, parseProductPairFromText, } from './compatibility-lookup.service.js';
import { farmerMemoryService } from './farmer-memory.service.js';
import { farmerReplyPolishService } from './farmer-reply-polish.service.js';
import { knowledgeFallbackService } from './knowledge-fallback.service.js';
import { replyAttributionService } from './reply-attribution.service.js';
import { verifiedAdvisoryLearningService } from '../../core/verified-advisory-learning.service.js';
import { escalationService } from '../../ai/escalation.service.js';
import { isStructuredSystemMessage } from './system-message.util.js';
/**
 * Agronomy-first reply: verified tank-mix DB → conversational AI with farmer memory.
 * Returns true when a reply was sent.
 */
export async function tryAgronomyReply(params) {
    const text = params.text.trim();
    if (!text)
        return false;
    const isAgronomy = isExplicitAgronomyQuestion(text);
    const pair = parseProductPairFromText(text);
    if (!isAgronomy && !pair)
        return false;
    const symptomsForAi = terminologyAiContextService.expandedSymptomsText(params.terminologyDetection ?? null, text);
    const memory = await farmerMemoryService.build(params.farmerId, {
        symptomsText: symptomsForAi,
        terminologyDetection: params.terminologyDetection ?? null,
        language: params.language,
    });
    const farmerDistrict = memory.district ?? null;
    const localize = async (body) => regionalTerminologyProcessor.localizeOutboundAsync(body, params.terminologyDetection ?? null, params.language, farmerDistrict);
    const baseMeta = { cropType: memory.cropType };
    const verified = await verifiedAdvisoryLearningService.matchFarmerQuestion({
        farmerId: params.farmerId,
        cropType: memory.cropType,
        text: symptomsForAi,
        language: params.language,
        activePlotId: memory.activePlotId,
    });
    if (verified) {
        const body = await localize(verifiedAdvisoryLearningService.formatFarmerMessage(verified.advisory, params.language));
        const outbound = await replyAttributionService.deliverAttributedReply({
            farmerId: params.farmerId,
            phone: params.phone,
            language: params.language,
            body,
            module: 'verified_case',
            meta: { ...baseMeta, issueLabel: verified.issueLabel },
            sendText: params.sendText,
        });
        await farmerService
            .logInteraction(params.farmerId, 'whatsapp', 'outbound', outbound.slice(0, 500))
            .catch(() => { });
        if (!isStructuredSystemMessage(text)) {
            await escalationService
                .enqueueWhatsAppInquiry({
                farmerId: params.farmerId,
                language: params.language,
                symptomsText: text,
                farmerSummary: outbound.slice(0, 4000),
                probableIssue: verified.issueLabel,
            })
                .catch(() => { });
        }
        return true;
    }
    async function sendAttributed(body, module) {
        const outbound = await replyAttributionService.deliverAttributedReply({
            farmerId: params.farmerId,
            phone: params.phone,
            language: params.language,
            body,
            module,
            meta: baseMeta,
            sendText: params.sendText,
        });
        await farmerService
            .logInteraction(params.farmerId, 'whatsapp', 'outbound', outbound.slice(0, 500))
            .catch(() => { });
        if (!isStructuredSystemMessage(text)) {
            await escalationService
                .enqueueWhatsAppInquiry({
                farmerId: params.farmerId,
                language: params.language,
                symptomsText: text,
                farmerSummary: outbound.slice(0, 4000),
            })
                .catch(() => { });
        }
    }
    if (pair) {
        const lookup = await compatibilityLookupService.lookup(pair.productA, pair.productB);
        if (lookup.found) {
            const reply = await localize(farmerReplyPolishService.isEnabled()
                ? await farmerReplyPolishService.polishCompatibilityReply({
                    lookup,
                    pair,
                    language: params.language,
                    memory,
                })
                : compatibilityLookupService.formatFarmerReply(lookup, params.language, pair));
            await sendAttributed(reply, 'compatibility_chart');
            return true;
        }
    }
    if (whatsappConversationalService.isEnabled()) {
        const usage = await aiUsageControlService.checkAndConsume({
            farmerId: params.farmerId,
            kind: 'text',
            isPremium: params.isPremium ?? false,
        });
        if (!usage.allowed) {
            const kb = await knowledgeFallbackService.tryReplyWithModule({
                farmerId: params.farmerId,
                text: symptomsForAi,
                language: params.language,
                memory,
            });
            if (kb) {
                await sendAttributed(await localize(kb.text), kb.module);
                return true;
            }
            await params.sendText(params.phone, aiUsageControlService.usageLimitMessage(params.language, usage.reason));
            return true;
        }
    }
    if (!whatsappConversationalService.isEnabled()) {
        if (pair) {
            await sendAttributed(compatibilityLookupService.formatFarmerReply({ found: false, productA: pair.productA, productB: pair.productB }, params.language, pair), 'compatibility_chart');
            return true;
        }
        if (isAgronomy) {
            const kb = await knowledgeFallbackService.tryReplyWithModule({
                farmerId: params.farmerId,
                text: symptomsForAi,
                language: params.language,
                memory,
            });
            if (kb) {
                await sendAttributed(await localize(kb.text), kb.module);
                return true;
            }
            await sendAttributed(await localize(farmerMemoryService.memoryAwareFallback(memory, params.language)), 'knowledge_fallback');
            return true;
        }
        return false;
    }
    const reply = await whatsappConversationalService.generateReply({
        farmerId: params.farmerId,
        userMessage: symptomsForAi,
        language: params.language,
        farmerName: params.farmerName,
        memory,
    });
    await sendAttributed(await localize(reply), 'conversational_openai');
    return true;
}
//# sourceMappingURL=agronomy-reply.service.js.map