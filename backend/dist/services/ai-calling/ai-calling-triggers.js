import { logger } from '../../lib/logger.js';
import { aiCallingOrchestrator } from './ai-calling-orchestrator.service.js';
function fire(label, work) {
    void work().catch((err) => logger.warn({ err, label }, 'AI calling trigger skipped'));
}
export const aiCallingTriggers = {
    onNewLead(params) {
        fire('qualification', () => aiCallingOrchestrator.enqueue({
            farmerId: params.farmerId,
            leadId: params.leadId,
            callType: 'qualification',
            language: params.language ?? undefined,
            payload: {
                staffInitiated: true,
                crop: params.cropType ?? null,
                dedupeKey: 'qualification',
            },
        }));
    },
    onCallbackRequested(params) {
        fire('reminder', () => aiCallingOrchestrator.enqueue({
            farmerId: params.farmerId,
            callType: 'reminder',
            payload: {
                reminderLabel: params.notes?.slice(0, 200) || 'Callback requested',
                staffInitiated: true,
                dedupeKey: 'callback',
            },
        }));
    },
    onRecommendationCommunicated(params) {
        fire('crop_application', () => aiCallingOrchestrator.enqueue({
            farmerId: params.farmerId,
            callType: 'crop_application',
            scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            language: params.language ?? undefined,
            payload: {
                recommendationRecordId: params.recommendationRecordId,
                followUpHoursIfNo: 24,
                dedupeKey: `rec:${params.recommendationRecordId}`,
            },
        }));
    },
    onCropWorsened(params) {
        fire('escalation', () => aiCallingOrchestrator.enqueue({
            farmerId: params.farmerId,
            callType: 'escalation',
            payload: {
                reminderLabel: params.reason,
                parentSessionId: params.sessionId ?? null,
                staffInitiated: true,
                dedupeKey: `worse:${params.sessionId ?? 'open'}`,
            },
        }));
    },
    onHealthSopScheduled(params) {
        const days = params.days ?? [1, 3, 7];
        for (const day of days) {
            fire(`health_d${day}`, () => aiCallingOrchestrator.enqueue({
                farmerId: params.farmerId,
                callType: 'health_follow_up',
                scheduledAt: new Date(Date.now() + day * 24 * 60 * 60 * 1000),
                language: params.language ?? undefined,
                payload: { healthDay: day, dedupeKey: `health:${day}` },
            }));
        }
    },
    enqueue(params) {
        fire('manual', () => aiCallingOrchestrator.enqueue({
            farmerId: params.farmerId,
            callType: params.callType,
            leadId: params.leadId,
            payload: { staffInitiated: true, ...(params.payload ?? {}) },
        }));
    },
};
//# sourceMappingURL=ai-calling-triggers.js.map