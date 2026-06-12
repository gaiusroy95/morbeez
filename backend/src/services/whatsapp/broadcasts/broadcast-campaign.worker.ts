import { broadcastCampaignService } from './broadcast-campaign.service.js';

const POLL_MS = 60_000;

export function startBroadcastCampaignWorker(): void {
  setInterval(() => {
    void broadcastCampaignService.processScheduledCampaigns().catch((err) => {
      console.error('[broadcast-campaign-worker]', err);
    });
  }, POLL_MS);
}
