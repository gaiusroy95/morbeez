import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { buildApp } from './app.js';
import { startOutboxWorkerIfEnabled } from './services/events/outbox.worker.js';
import { startAdvisoryAutomationWorker } from './services/automation/advisory-automation.worker.js';
import { startRetentionCleanupWorker } from './services/retention/retention-cleanup.worker.js';
import { startWhatsAppBroadcastWorker } from './services/whatsapp/broadcasts/whatsapp-broadcast.worker.js';
import { startBroadcastCampaignWorker } from './services/whatsapp/broadcasts/broadcast-campaign.worker.js';
import { startMarketInsightBroadcastWorker } from './services/whatsapp/market-insights/market-insight-broadcast.worker.js';
import { startRoiDailyPromptWorker } from './services/whatsapp/roi/roi-daily-prompt.worker.js';
import { startFarmerOpportunityScoreWorker } from './services/intelligence/farmer-opportunity-score.worker.js';
async function main() {
    if (!env.OPENAI_API_KEY?.trim()) {
        logger.warn('OPENAI_API_KEY is not set — visit AI diagnosis will use fallback hypotheses and generic recommendations');
    }
    const app = await buildApp();
    startOutboxWorkerIfEnabled();
    startAdvisoryAutomationWorker();
    startRetentionCleanupWorker();
    startWhatsAppBroadcastWorker();
    startBroadcastCampaignWorker();
    startMarketInsightBroadcastWorker();
    startRoiDailyPromptWorker();
    startFarmerOpportunityScoreWorker();
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Morbeez API started');
}
main().catch((err) => {
    logger.fatal({ err }, 'Failed to start');
    process.exit(1);
});
//# sourceMappingURL=index.js.map