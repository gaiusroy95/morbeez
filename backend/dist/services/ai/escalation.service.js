import { supabase } from '../../lib/supabase.js';
import { eventBus } from '../../events/bus.js';
import { computeConfidence, escalationReason, shouldEscalate } from './confidence.js';
import { blockService } from '../core/block.service.js';
export const OPEN_ESCALATION_STATUSES = ['pending', 'assigned', 'in_review'];
function priorityForConfidence(confidence) {
    if (confidence < 0.4)
        return 'urgent';
    if (confidence < 0.55)
        return 'high';
    if (confidence < 0.7)
        return 'normal';
    return 'low';
}
/**
 * Always insert a new case-review row (multiple requests per farmer appear separately in the queue).
 */
export const escalationService = {
    async createCaseForReview(params) {
        const priority = params.priority ?? priorityForConfidence(params.confidence_at_escalation);
        const { data, error } = await supabase
            .from('agronomist_escalations')
            .insert({
            session_id: params.sessionId,
            farmer_id: params.farmerId,
            reason: params.reason,
            confidence_at_escalation: params.confidence_at_escalation,
            priority,
            status: 'pending',
        })
            .select('id')
            .single();
        if (error)
            throw error;
        return { escalationId: data.id };
    },
    /** @deprecated Use createCaseForReview — kept for callers; always creates a new row. */
    async ensureOpenEscalation(params) {
        const { escalationId } = await this.createCaseForReview(params);
        return { escalationId, created: true };
    },
    /**
     * Record every Crop Doctor / advisory session in Case Review.
     * `escalated` flag still reflects low-confidence rules for farmer messaging & events.
     */
    async createIfNeeded(params) {
        const confidence = computeConfidence(params.advisory.confidence, params.plantId ?? null);
        const needsEscalation = shouldEscalate(confidence, params.advisory);
        await supabase
            .from('ai_advisory_sessions')
            .update({
            confidence_score: confidence,
            escalation_recommended: needsEscalation,
            updated_at: new Date().toISOString(),
        })
            .eq('id', params.sessionId);
        const reason = needsEscalation
            ? escalationReason(confidence, params.advisory)
            : `Advisory review: ${params.advisory.probableIssue}`.slice(0, 500);
        const { escalationId } = await this.createCaseForReview({
            sessionId: params.sessionId,
            farmerId: params.farmerId,
            reason,
            confidence_at_escalation: confidence,
            priority: priorityForConfidence(confidence),
        });
        if (needsEscalation) {
            await supabase
                .from('ai_advisory_sessions')
                .update({ status: 'escalated', updated_at: new Date().toISOString() })
                .eq('id', params.sessionId);
            await eventBus.publish('advisory.escalated', {
                sessionId: params.sessionId,
                farmerId: params.farmerId,
                escalationId,
                reason,
                priority: priorityForConfidence(confidence),
            }, 'escalation-service');
        }
        return { escalated: needsEscalation, escalationId, confidence };
    },
    /** Text-only or agronomy WhatsApp turn — creates session + output + case row. */
    async enqueueWhatsAppInquiry(params) {
        const text = params.symptomsText.trim();
        const summary = params.farmerSummary.trim();
        if (!text || text.length < 4 || !summary)
            return null;
        const primary = await blockService.getPrimaryBlock(params.farmerId);
        const cropType = primary?.crop_type ?? 'ginger';
        const confidence = params.confidence ?? 0.72;
        const issue = params.probableIssue?.trim()
            ? params.probableIssue.slice(0, 200)
            : 'Crop inquiry';
        const { data: session, error: sessionErr } = await supabase
            .from('ai_advisory_sessions')
            .insert({
            farmer_id: params.farmerId,
            channel: params.channel ?? 'whatsapp',
            crop_type: cropType,
            language: params.language,
            symptoms_text: text.slice(0, 2000),
            status: 'completed',
            confidence_score: confidence,
            escalation_recommended: false,
            metadata: { source: 'whatsapp_inquiry' },
        })
            .select('id')
            .single();
        if (sessionErr) {
            return null;
        }
        const sessionId = String(session.id);
        await supabase.from('ai_advisory_outputs').insert({
            session_id: sessionId,
            provider: 'whatsapp',
            language: params.language,
            probable_issue: issue,
            farmer_summary_en: summary,
            farmer_summary_ml: params.language === 'ml' ? summary : summary,
            precautions: [],
            raw_response: { source: 'whatsapp_inquiry', summary },
            model_version: 'whatsapp_agronomy',
        });
        const { escalationId } = await this.createCaseForReview({
            sessionId,
            farmerId: params.farmerId,
            reason: `WhatsApp inquiry: ${issue}`.slice(0, 500),
            confidence_at_escalation: confidence,
            priority: 'normal',
        });
        return { sessionId, escalationId };
    },
};
//# sourceMappingURL=escalation.service.js.map