import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { aiCallingOrchestrator } from './ai-calling-orchestrator.service.js';
const POLL_MS = 30_000;
let interval;
async function poll() {
    const n = await aiCallingOrchestrator.processDueJobs(15);
    if (n > 0)
        logger.info({ processed: n }, 'AI calling worker processed jobs');
}
export function startAiCallingWorker() {
    if (env.NODE_ENV === 'test' || !env.ENABLE_AI_CALLING)
        return;
    if (interval)
        return;
    interval = setInterval(() => {
        poll().catch((err) => logger.error({ err }, 'AI calling poll error'));
    }, POLL_MS);
    logger.info('AI calling worker started');
}
//# sourceMappingURL=ai-calling.worker.js.map