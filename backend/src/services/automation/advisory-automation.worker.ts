import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import { whatsappService } from '../whatsapp/whatsapp.service.js';
import { farmerService } from '../farmer/farmer.service.js';
import { cultivationLoggingService } from '../whatsapp/cultivation/cultivation-logging.service.js';
import { recommendationFollowUpService } from '../core/recommendation-follow-up.service.js';
import { visitAdvisoryEscalationService } from '../core/visit-advisory-escalation.service.js';
import type { AdvisoryLanguage } from '../ai/types.js';

const POLL_MS = 60_000;
const PROACTIVE_SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000;

let lastProactiveScanMs = 0;

function runProactiveScanIfDue(): void {
  if (env.ENABLE_MAIOS_V12 === false) return;

  const now = Date.now();
  if (lastProactiveScanMs && now - lastProactiveScanMs < PROACTIVE_SCAN_INTERVAL_MS) {
    return;
  }
  lastProactiveScanMs = now;

  import('../case/proactive-alert.service.js')
    .then((m) => m.proactiveAlertService.scheduleDailyScan())
    .catch((err) => logger.warn({ err }, 'MAIOS proactive scan failed'));
}

async function processJob(job: {
  id: string;
  farmer_id: string;
  job_type: string;
  payload: Record<string, unknown>;
  attempts: number;
}): Promise<void> {
  const { data: farmer } = await supabase
    .from('farmers')
    .select('phone, preferred_language')
    .eq('id', job.farmer_id)
    .single();

  if (!farmer?.phone) throw new Error('Farmer phone missing');

  const lang = (job.payload.language as string) ?? farmer.preferred_language ?? 'en';

  if (
    job.job_type === 'rec_application_check' ||
    job.job_type === 'rec_application_reminder' ||
    job.job_type === 'rec_outcome_check' ||
    job.job_type === 'rec_outcome_reminder' ||
    job.job_type === 'rec_outcome_no_response' ||
    job.job_type === 'rec_no_response_escalation'
  ) {
    await recommendationFollowUpService.processAutomationJob(job);
  } else if (job.job_type === 'whatsapp_follow_up') {
    const recId = job.payload.recommendationRecordId;
    if (recId) {
      await recommendationFollowUpService.sendApplicationCheck(String(recId));
    } else {
      const msg =
        lang === 'ml'
          ? 'നമസ്കാരം! നിങ്ങളുടെ വിള നില പരിശോധിക്കാൻ Morbeez ടീം സഹായിക്കാം. ചിത്രം അയയ്ക്കാം.'
          : 'Hi! Morbeez follow-up on your crop advisory. Reply with a photo or symptoms if you need more help.';
      await whatsappService.sendText(farmer.phone, msg);
    }
  } else if (job.job_type === 'callback_reminder') {
    await farmerService.logInteraction(
      job.farmer_id,
      'system',
      'outbound',
      'Callback reminder queued for telecaller',
      { sessionId: job.payload.sessionId }
    );
    logger.info({ farmerId: job.farmer_id }, 'Callback reminder — telecaller queue');
  } else if (job.job_type === 'cultivation_application_prompt') {
    await cultivationLoggingService.sendApplicationPrompt(
      farmer.phone,
      job.farmer_id,
      (lang as AdvisoryLanguage) ?? 'en',
      {
        advisorySessionId: job.payload.advisorySessionId
          ? String(job.payload.advisorySessionId)
          : undefined,
      }
    );
  } else if (job.job_type === 'cultivation_result_validation') {
    const activityId = String(job.payload.activityId ?? '');
    if (activityId) {
      await cultivationLoggingService.sendResultValidationPrompt(
        farmer.phone,
        job.farmer_id,
        (lang as AdvisoryLanguage) ?? 'en',
        activityId
      );
    }
  } else if (job.job_type === 'visit_monitoring_progression') {
    await visitAdvisoryEscalationService.processMonitoringProgressionJob(job);
  } else if (job.job_type === 'visit_callback_escalation') {
    await visitAdvisoryEscalationService.processEscalationJob(job);
  } else if (job.job_type.startsWith('ginger_sop_recovery_d')) {
    const sessionId = String(job.payload.sessionId ?? '');
    let useMaios = false;
    if (sessionId) {
      const { data: session } = await supabase
        .from('ai_advisory_sessions')
        .select('metadata')
        .eq('id', sessionId)
        .maybeSingle();
      useMaios = Boolean((session?.metadata as Record<string, unknown>)?.maiosCase);
    }
    if (useMaios) {
      const { recoveryValidationService } = await import('../case/recovery-validation.service.js');
      const day = Number(String(job.job_type).replace('ginger_sop_recovery_d', ''));
      await recoveryValidationService.processRecoveryJobSend({
        ...job,
        job_type: `maios_recovery_d${day}`,
      });
    } else {
      const { gingerSopFollowUpService } = await import('../ginger-sop/ginger-sop-follow-up.service.js');
      await gingerSopFollowUpService.processRecoveryJob(job);
    }
  } else if (job.job_type.startsWith('maios_recovery_d')) {
    const { recoveryValidationService } = await import('../case/recovery-validation.service.js');
    await recoveryValidationService.processRecoveryJobSend(job);
  } else if (job.job_type === 'maios_proactive_alert') {
    const cropType = String(job.payload.cropType ?? '_default');
    const pack = await (await import('../crop-pack/crop-pack-loader.service.js')).cropPackLoaderService.load(cropType);
    const msg =
      String(job.payload.message ?? '') ||
      `MAIOS alert (${pack.displayName}): elevated crop risk. Send a fresh photo or reply HELP.`;
    await whatsappService.sendText(farmer.phone, msg);
  } else if (job.job_type === 'ml_retraining_weekly' || job.job_type === 'ml_retraining_monthly') {
    const { retrainingPipelineService } = await import('../ml/retraining-pipeline.service.js');
    await retrainingPipelineService.runWeekly();
  } else if (job.job_type === 'executive_weekly_email') {
    const { operationsMessagingService } = await import('../admin/operations-messaging.service.js');
    const recipients = Array.isArray(job.payload.recipientEmails)
      ? (job.payload.recipientEmails as string[])
      : [];
    await operationsMessagingService.sendExecutiveWeeklyDigest(recipients);
  }

  await supabase
    .from('advisory_automation_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id);
}

async function poll(): Promise<void> {
  const now = new Date().toISOString();
  const { data: jobs } = await supabase
    .from('advisory_automation_jobs')
    .select('id, farmer_id, job_type, payload, attempts')
    .eq('status', 'pending')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(10);

  for (const job of jobs ?? []) {
    // Atomic claim — only one worker may process a given pending job.
    const { data: claimed, error: claimErr } = await supabase
      .from('advisory_automation_jobs')
      .update({ status: 'processing', attempts: (job.attempts ?? 0) + 1 })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (claimErr || !claimed?.id) {
      continue;
    }

    try {
      await processJob(job);
    } catch (err) {
      logger.error({ err, jobId: job.id }, 'Automation job failed');
      await supabase
        .from('advisory_automation_jobs')
        .update({
          status: (job.attempts ?? 0) >= 3 ? 'failed' : 'pending',
          last_error: String(err),
        })
        .eq('id', job.id);
    }
  }
}

let interval: ReturnType<typeof setInterval> | null = null;
let bootstrapDone = false;

async function bootstrapScheduledJobs(): Promise<void> {
  if (bootstrapDone || env.NODE_ENV === 'test') return;
  bootstrapDone = true;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(2, 0, 0, 0);

  const { count } = await supabase
    .from('advisory_automation_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('job_type', 'ml_retraining_weekly')
    .eq('status', 'pending');

  const { data: anyFarmer } = await supabase.from('farmers').select('id').limit(1).maybeSingle();

  if (!count && anyFarmer?.id) {
    await supabase.from('advisory_automation_jobs').insert({
      farmer_id: anyFarmer.id,
      job_type: 'ml_retraining_weekly',
      scheduled_at: tomorrow.toISOString(),
      payload: { source: 'maios_bootstrap' },
    });
  }

  const nextMonday = new Date();
  nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
  nextMonday.setHours(6, 0, 0, 0);

  const { count: execCount } = await supabase
    .from('advisory_automation_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('job_type', 'executive_weekly_email')
    .eq('status', 'pending');

  if (!execCount && anyFarmer?.id) {
    await supabase.from('advisory_automation_jobs').insert({
      farmer_id: anyFarmer.id,
      job_type: 'executive_weekly_email',
      scheduled_at: nextMonday.toISOString(),
      payload: { source: 'enterprise_bootstrap' },
    });
  }

  const { proactiveAlertService } = await import('../case/proactive-alert.service.js');
  lastProactiveScanMs = Date.now();
  void proactiveAlertService.scheduleDailyScan();
}

export function startAdvisoryAutomationWorker(): void {
  if (env.NODE_ENV === 'test' || !env.ENABLE_ADVISORY_AUTOMATION) return;
  if (interval) return;

  void bootstrapScheduledJobs();

  interval = setInterval(() => {
    poll().catch((err) => logger.error({ err }, 'Automation poll error'));
    runProactiveScanIfDue();
  }, POLL_MS);

  logger.info('Advisory automation worker started');
}
