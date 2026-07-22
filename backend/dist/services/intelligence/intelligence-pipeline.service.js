import { logger } from '../../lib/logger.js';
/** Events that should refresh farmer opportunity score (debounced). */
const SCORE_REFRESH_EVENTS = new Set([
    'MESSAGE_REPLY',
    'IMAGE_UPLOAD',
    'VOICE_NOTE',
    'RECOMMENDATION_APPLIED',
    'RECOMMENDATION_COMMUNICATED',
    'RECOMMENDATION_APPROVED',
    'ORDER_CONVERTED',
    'ROI_ENTRY',
    'FARMER_REACTIVATED',
    'SOIL_TEST_UPLOADED',
    'FOLLOWUP_COMPLETED',
    'ADVISORY_SESSION_COMPLETED',
    'FIELD_FINDING_LOGGED',
    'SITE_VISIT_ACCEPTED',
    'CALLBACK_REQUESTED',
    'FARMER_ONBOARDED',
]);
const DEBOUNCE_MS = 90_000;
const debounceTimers = new Map();
/**
 * Orchestrates post-event intelligence: debounced opportunity score refresh.
 * Employee batch scores still run nightly via farmer-opportunity-score.worker.
 */
export const intelligencePipelineService = {
    onFarmerEventRecorded(farmerId, eventType) {
        if (!SCORE_REFRESH_EVENTS.has(eventType))
            return;
        if (process.env.NODE_ENV === 'test')
            return;
        const existing = debounceTimers.get(farmerId);
        if (existing)
            clearTimeout(existing);
        debounceTimers.set(farmerId, setTimeout(() => {
            debounceTimers.delete(farmerId);
            void (async () => {
                try {
                    const { farmerOpportunityEngineService } = await import('./farmer-opportunity-engine.service.js');
                    await farmerOpportunityEngineService.scoreFarmer(farmerId);
                }
                catch (err) {
                    logger.warn({ err, farmerId, eventType }, 'Intelligence pipeline score refresh failed');
                }
            })();
        }, DEBOUNCE_MS));
    },
    /** Immediate full farmer score (admin recalc, tests). */
    async refreshFarmerNow(farmerId) {
        const { farmerOpportunityEngineService } = await import('./farmer-opportunity-engine.service.js');
        await farmerOpportunityEngineService.scoreFarmer(farmerId);
    },
};
//# sourceMappingURL=intelligence-pipeline.service.js.map