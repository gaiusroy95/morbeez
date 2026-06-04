import { runMarketInsightsNow } from '../whatsapp/market-insights/market-insight-broadcast.worker.js';

export const marketInsightAdminService = {
  run: runMarketInsightsNow,
};
