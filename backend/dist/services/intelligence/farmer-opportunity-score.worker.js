import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { farmerOpportunityEngineService } from './farmer-opportunity-engine.service.js';
import { employeePerformanceEngineService } from './employee-performance-engine.service.js';
import { opportunityIntelligenceAlertsService } from './opportunity-intelligence-alerts.service.js';
import { opportunityNurtureService } from './opportunity-nurture.service.js';
/** Poll every 15 minutes; score batch during early-morning IST window (02:00–04:59). */
const POLL_MS = 15 * 60_000;
function istHour() {
    return Number(new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false,
    }).format(new Date()));
}
function isNightlyScoreWindow() {
    const hour = istHour();
    return hour >= 2 && hour < 5;
}
let lastBatchDateKey = null;
let interval = null;
async function tick() {
    if (!isNightlyScoreWindow())
        return;
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    if (lastBatchDateKey === dateKey)
        return;
    lastBatchDateKey = dateKey;
    const farmerResult = await farmerOpportunityEngineService.runBatch({ limit: 500 });
    logger.info(farmerResult, 'Farmer opportunity score nightly batch completed');
    const employeeResult = await employeePerformanceEngineService.runBatch({ limit: 200 });
    logger.info(employeeResult, 'Employee performance score nightly batch completed');
    const alertResult = await opportunityIntelligenceAlertsService.generateDailyAlerts();
    logger.info(alertResult, 'Opportunity intelligence daily alerts completed');
    const taskResult = await opportunityIntelligenceAlertsService.enqueueRetentionTasks(50);
    logger.info(taskResult, 'Opportunity retention CRM tasks enqueued');
    const nurtureResult = await opportunityNurtureService.enqueueLowOpportunityNurture({ limit: 25 });
    logger.info(nurtureResult, 'Low-opportunity nurture batch completed');
}
export function startFarmerOpportunityScoreWorker() {
    if (env.NODE_ENV === 'test' || env.ENABLE_OPPORTUNITY_SCORE_WORKER === false) {
        return;
    }
    if (interval)
        return;
    interval = setInterval(() => {
        tick().catch((err) => logger.error({ err }, 'Farmer opportunity score worker error'));
    }, POLL_MS);
    tick().catch((err) => logger.error({ err }, 'Farmer opportunity score worker initial tick error'));
    logger.info('Farmer opportunity score worker started (IST 02:00–04:59 window)');
}
/** Admin / manual trigger — bypasses once-per-day guard. */
export async function runFarmerOpportunityScoresNow(options) {
    lastBatchDateKey = null;
    return farmerOpportunityEngineService.runBatch(options);
}
/** Manual employee performance batch (runs after farmers when using nightly worker). */
export async function runEmployeePerformanceScoresNow(options) {
    return employeePerformanceEngineService.runBatch(options);
}
//# sourceMappingURL=farmer-opportunity-score.worker.js.map