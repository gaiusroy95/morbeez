import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { resolveConfidenceAction, shouldAutoSend, shouldEscalate, } from '../../domain/ai-training/confidence-routing.js';
function mapLifecycleRow(row) {
    return {
        sessionId: String(row.id),
        confidenceScore: row.confidence_score != null ? Number(row.confidence_score) : null,
        confidenceBand: row.confidence_band
            ? String(row.confidence_band)
            : null,
        escalationRecommended: Boolean(row.escalation_recommended),
        autoSent: Boolean(row.auto_sent),
        autoSentAt: row.auto_sent_at ? String(row.auto_sent_at) : null,
        humanReviewed: Boolean(row.human_reviewed),
        humanReviewedAt: row.human_reviewed_at ? String(row.human_reviewed_at) : null,
        humanReviewedBy: row.human_reviewed_by ? String(row.human_reviewed_by) : null,
        corrected: Boolean(row.corrected),
        correctedAt: row.corrected_at ? String(row.corrected_at) : null,
        routingDecidedAt: row.routing_decided_at ? String(row.routing_decided_at) : null,
    };
}
function daysAgoIso(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
}
function pct(part, total) {
    if (total <= 0)
        return 0;
    return Math.round((part / total) * 1000) / 10;
}
export const confidenceLifecycleService = {
    /**
     * Persist routing decision after confidence is computed.
     */
    async applyRouting(params) {
        const band = resolveConfidenceAction(params.confidence);
        const needsEscalation = shouldEscalate(params.confidence, params.advisory);
        const now = new Date().toISOString();
        const { error } = await supabase
            .from('ai_advisory_sessions')
            .update({
            confidence_score: params.confidence,
            confidence_band: band,
            escalation_recommended: needsEscalation,
            routing_decided_at: now,
            updated_at: now,
        })
            .eq('id', params.sessionId);
        if (error) {
            logger.warn({ err: error.message, sessionId: params.sessionId }, 'Confidence routing update failed');
        }
        return { band, needsEscalation };
    },
    /** Mark session as auto-delivered to farmer (≥95% band, no agronomist gate). */
    async markAutoSent(sessionId, channel = 'whatsapp') {
        const now = new Date().toISOString();
        const { data: existing } = await supabase
            .from('ai_advisory_sessions')
            .select('metadata')
            .eq('id', sessionId)
            .maybeSingle();
        const metadata = {
            ...(existing?.metadata ?? {}),
            autoSentChannel: channel,
        };
        await supabase
            .from('ai_advisory_sessions')
            .update({
            auto_sent: true,
            auto_sent_at: now,
            metadata,
            updated_at: now,
        })
            .eq('id', sessionId);
    },
    /** Record agronomist or staff human review on a session. */
    async markHumanReviewed(sessionId, params) {
        const now = new Date().toISOString();
        const { data: existing } = await supabase
            .from('ai_advisory_sessions')
            .select('metadata')
            .eq('id', sessionId)
            .maybeSingle();
        const metadata = {
            ...(existing?.metadata ?? {}),
            lastReviewAction: params.action ?? null,
        };
        await supabase
            .from('ai_advisory_sessions')
            .update({
            human_reviewed: true,
            human_reviewed_at: now,
            human_reviewed_by: params.reviewedBy,
            corrected: Boolean(params.corrected),
            corrected_at: params.corrected ? now : null,
            metadata,
            updated_at: now,
        })
            .eq('id', sessionId);
    },
    async getLifecycle(sessionId) {
        const { data, error } = await supabase
            .from('ai_advisory_sessions')
            .select(`id, confidence_score, confidence_band, escalation_recommended,
         auto_sent, auto_sent_at, human_reviewed, human_reviewed_at, human_reviewed_by,
         corrected, corrected_at, routing_decided_at`)
            .eq('id', sessionId)
            .maybeSingle();
        if (error || !data)
            return null;
        return mapLifecycleRow(data);
    },
    /** Should this advisory be auto-delivered without agronomist gate? */
    canAutoSend(confidence, advisory) {
        return shouldAutoSend(confidence, advisory);
    },
    /** Aggregate routing stats for dashboards (last N days). */
    async getRoutingStats(days = 30) {
        const since = daysAgoIso(days);
        const { data, error } = await supabase
            .from('ai_advisory_sessions')
            .select(`confidence_band, auto_sent, human_reviewed, corrected, confidence_score, status, created_at`)
            .gte('created_at', since)
            .not('confidence_band', 'is', null);
        throwIfSupabaseError(error, 'Could not load confidence lifecycle stats');
        const rows = data ?? [];
        const total = rows.length;
        const byBand = { auto_send: 0, employee_review: 0, escalate: 0 };
        let autoSent = 0;
        let humanReviewed = 0;
        let corrected = 0;
        let confSum = 0;
        let confCount = 0;
        for (const r of rows) {
            const band = String(r.confidence_band ?? '');
            if (band in byBand)
                byBand[band] += 1;
            if (r.auto_sent)
                autoSent += 1;
            if (r.human_reviewed)
                humanReviewed += 1;
            if (r.corrected)
                corrected += 1;
            if (r.confidence_score != null) {
                confSum += Number(r.confidence_score);
                confCount += 1;
            }
        }
        return {
            periodDays: days,
            since,
            totalRouted: total,
            byBand: {
                autoSend: byBand.auto_send,
                employeeReview: byBand.employee_review,
                escalate: byBand.escalate,
                autoSendPct: pct(byBand.auto_send, total),
                employeeReviewPct: pct(byBand.employee_review, total),
                escalatePct: pct(byBand.escalate, total),
            },
            autoSentCount: autoSent,
            autoSentRatePct: pct(autoSent, total),
            humanReviewedCount: humanReviewed,
            humanReviewedRatePct: pct(humanReviewed, total),
            correctedCount: corrected,
            correctionRatePct: pct(corrected, humanReviewed || total),
            avgConfidencePct: confCount > 0 ? Math.round((confSum / confCount) * 1000) / 10 : null,
            thresholds: {
                autoSend: 95,
                employeeReview: 80,
            },
        };
    },
};
//# sourceMappingURL=confidence-lifecycle.service.js.map