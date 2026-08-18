import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { eligibleSaleEngine } from './eligible-sale.engine.js';
import { farmerIntroductionService } from './farmer-introduction.service.js';
import { earningRulesService } from './earning-rules.service.js';
import { qualifiedCaseEngine } from './qualified-case.engine.js';
import { diagnosisQaService } from './diagnosis-qa.service.js';
import { monthKey, previousMonth } from '../../domain/remuneration/rule-workflow.js';

const POLL_MS = 10 * 60 * 1000;
let interval: ReturnType<typeof setInterval> | undefined;

async function poll(): Promise<void> {
  const { scanned } = await eligibleSaleEngine.scanDue(80);
  if (scanned > 0) logger.info({ scanned }, 'Eligible-sale worker refreshed orders');
  const intros = await farmerIntroductionService.scanPending(80);
  if (intros.scanned > 0) logger.info({ scanned: intros.scanned }, 'Introduction eligibility refreshed');
  const prev = previousMonth();
  await earningRulesService.freezePreviousMonth().catch((err) => {
    logger.error({ err, month: prev }, 'KPI month freeze failed');
  });
  const month = monthKey();
  const cases = await qualifiedCaseEngine.scanMonth(month, 80);
  if (cases.scanned > 0) logger.info({ scanned: cases.scanned, month }, 'Qualified cases scanned');
  await diagnosisQaService.ensureSample(prev).catch((err) => {
    logger.error({ err, month: prev }, 'Diagnosis QA sample failed');
  });
  const { fraudFlagService } = await import('./fraud-flag.service.js');
  await fraudFlagService.scan(40).catch((err) => {
    logger.error({ err }, 'Fraud flag scan failed');
  });
}

export function startEligibleSaleWorker(): void {
  if (env.NODE_ENV === 'test') return;
  if (interval) return;
  interval = setInterval(() => {
    poll().catch((err) => logger.error({ err }, 'Eligible-sale poll error'));
  }, POLL_MS);
  void poll().catch((err) => logger.error({ err }, 'Eligible-sale startup poll error'));
  logger.info('Eligible-sale worker started');
}
