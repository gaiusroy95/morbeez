import { broadcastCampaignService } from './broadcast-campaign.service.js';
const POLL_MS = 60_000;
export function startBroadcastCampaignWorker() {
    setInterval(() => {
        void broadcastCampaignService.processScheduledCampaigns().catch((err) => {
            console.error('[broadcast-campaign-worker]', err);
        });
    }, POLL_MS);
}
//# sourceMappingURL=broadcast-campaign.worker.js.map