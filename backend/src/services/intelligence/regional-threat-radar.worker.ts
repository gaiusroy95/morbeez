import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import { regionalThreatRadarService } from './regional-threat-radar.service.js';

const POLL_MS = 60 * 60_000;

function istHour(): number {
  return Number(
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    }).format(new Date())
  );
}

function isNightlyWindow(): boolean {
  const hour = istHour();
  return hour >= 3 && hour < 5;
}

let lastBatchDateKey: string | null = null;
let interval: ReturnType<typeof setInterval> | null = null;

async function tick(): Promise<void> {
  if (!isNightlyWindow()) return;

  const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  if (lastBatchDateKey === dateKey) return;
  lastBatchDateKey = dateKey;

  const { data: districts } = await supabase
    .from('farmers')
    .select('district')
    .not('district', 'is', null)
    .limit(500);

  const seen = new Set<string>();
  let refreshed = 0;
  for (const row of districts ?? []) {
    const district = String(row.district ?? '').trim();
    if (!district || seen.has(district)) continue;
    seen.add(district);
    for (const crop of ['ginger', 'turmeric', 'banana']) {
      await regionalThreatRadarService.refreshAndPersist(district, crop);
      refreshed++;
    }
  }

  logger.info({ districts: seen.size, refreshed }, 'Regional threat radar nightly batch completed');
}

export function startRegionalThreatRadarWorker(): void {
  if (env.NODE_ENV === 'test') return;
  if (interval) return;
  interval = setInterval(() => {
    tick().catch((err) => logger.error({ err }, 'Regional threat radar worker error'));
  }, POLL_MS);
  logger.info('Regional threat radar worker started');
}
