import { env } from '../../../config/env.js';
import { logger } from '../../../lib/logger.js';
import { marketInsightBroadcastService } from './market-insight-broadcast.service.js';

const POLL_MS = 5 * 60_000;

function istHour(): number {
  return Number(
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    }).format(new Date())
  );
}

function istDateKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

let lastBuildDate: string | null = null;
let lastSendDate: string | null = null;

async function tick(): Promise<void> {
  const hour = istHour();
  const dateKey = istDateKey();

  if (hour === env.MARKET_INSIGHT_BUILD_HOUR_IST && lastBuildDate !== dateKey) {
    lastBuildDate = dateKey;
    const build = await marketInsightBroadcastService.buildSnapshots();
    logger.info({ build }, 'Market insight daily build finished');
  }

  if (hour === env.MARKET_INSIGHT_SEND_HOUR_IST && lastSendDate !== dateKey) {
    lastSendDate = dateKey;
    const send = await marketInsightBroadcastService.sendSnapshots();
    logger.info({ send }, 'Market insight daily send finished');
  }
}

let interval: ReturnType<typeof setInterval> | null = null;

export function startMarketInsightBroadcastWorker(): void {
  if (env.NODE_ENV === 'test' || !env.ENABLE_MARKET_INSIGHT_IMAGE_BROADCAST) return;
  if (interval) return;

  interval = setInterval(() => {
    tick().catch((err) => logger.error({ err }, 'Market insight worker error'));
  }, POLL_MS);

  tick().catch((err) => logger.error({ err }, 'Market insight worker initial tick error'));
  logger.info(
    {
      buildHour: env.MARKET_INSIGHT_BUILD_HOUR_IST,
      sendHour: env.MARKET_INSIGHT_SEND_HOUR_IST,
    },
    'Market insight image broadcast worker started'
  );
}

export async function runMarketInsightsNow(
  options?: Parameters<typeof marketInsightBroadcastService.runDaily>[0]
) {
  return marketInsightBroadcastService.runDaily(options);
}
