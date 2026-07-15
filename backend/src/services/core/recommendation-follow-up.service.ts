import { env } from '../../config/env.js';
import { supabase } from '../../lib/supabase.js';
import { throwIfSupabaseError } from '../../lib/supabase-errors.js';
import { logger } from '../../lib/logger.js';
import { whatsappService } from '../whatsapp/whatsapp.service.js';
import { recommendationRecordsService } from './recommendation-records.service.js';
import { createTelecallerTask } from '../whatsapp/pipeline/telecaller-tasks.service.js';
import { cultivationLoggingService } from '../whatsapp/cultivation/cultivation-logging.service.js';
import { accuracyMetricsService } from '../ai/accuracy-metrics.service.js';
import { aiReuseService } from '../ai/ai-reuse.service.js';
import { learningLoopService } from './learning-loop.service.js';
import { followUpCopy } from './recommendation-follow-up-copy.js';
import type { AdvisoryLanguage } from '../ai/types.js';
import { escalationService } from '../ai/escalation.service.js';
import {
  type ImprovementLevel,
  type OutcomeKpiPayload,
  improvementLevelToOutcomeReply,
} from '../../domain/ai-training/outcome-kpi.js';
import { outcomeKpiInterpretationService } from './outcome-kpi-interpretation.service.js';
import { outcomeHumanRoutingService } from './outcome-human-routing.service.js';
import { visitAdvisoryEscalationService } from './visit-advisory-escalation.service.js';
import { issueFollowUpQuestionsService } from './issue-follow-up-questions.service.js';
import {
  contextFromRecommendationRecord,
  formatApplicationCheckMessage,
} from './application-follow-up-message.util.js';

const APPLICATION_CHECK_DAYS = () =>
  Math.max(1, Number(process.env.REC_FOLLOWUP_APPLICATION_DAYS ?? 1) || 1);
const OUTCOME_CHECK_DAYS = () =>
  Math.max(1, Number(process.env.REC_FOLLOWUP_OUTCOME_DAYS ?? 7) || 7);
/** Optional second outcome check (effectiveness learning). 0 disables. */
const OUTCOME_SECOND_CHECK_DAYS = () =>
  Math.max(0, Number(process.env.REC_FOLLOWUP_OUTCOME_SECOND_DAYS ?? 14) || 14);
const MAX_APPLICATION_REMINDERS = () =>
  Number(process.env.REC_FOLLOWUP_MAX_REMINDERS ?? 3);
/** Do not re-send the same application-check prompt within this window. */
const APPLICATION_CHECK_DEDUP_HOURS = () =>
  Math.max(1, Number(process.env.REC_FOLLOWUP_APPLICATION_DEDUP_HOURS ?? 12) || 12);
const NO_RESPONSE_ESCALATION_DAYS = () =>
  Number(process.env.REC_FOLLOWUP_NO_RESPONSE_DAYS ?? 3);
const OUTCOME_REMINDER_DAYS = () => Number(process.env.REC_FOLLOWUP_OUTCOME_REMINDER_DAYS ?? 2);
const MAX_OUTCOME_REMINDERS = () => Number(process.env.REC_FOLLOWUP_MAX_OUTCOME_REMINDERS ?? 2);
const OUTCOME_NO_RESPONSE_DAYS = () =>
  Number(process.env.REC_FOLLOWUP_OUTCOME_NO_RESPONSE_DAYS ?? 3);

type RecRow = {
  id: string;
  farmer_id: string;
  block_id: string | null;
  ai_session_id: string | null;
  field_finding_id?: string | null;
  visit_issue_id?: string | null;
  issue_detected: string | null;
  recommendation_text: string;
  products: unknown;
  dosage: string | null;
  application_type: string | null;
  dap_at_recommendation: number | null;
  language: string;
  status: string;
  application_status?: string | null;
  outcome?: string | null;
  communicated_at: string | null;
  created_at?: string | null;
  technical_name: string | null;
  trade_name: string | null;
  severity: string | null;
  metadata?: Record<string, unknown>;
  farmers?: { phone: string | null; preferred_language: string | null };
  farm_blocks?: { crop_type: string | null } | null;
};

export type ApplicationReply = 'yes_applied' | 'not_yet' | 'need_clarification';
export type OutcomeReply = 'improved' | 'no_improvement' | 'worsened' | 'partial';

function parseProducts(products: unknown): {
  technicalName?: string;
  tradeName?: string;
} {
  if (!Array.isArray(products) || !products.length) return {};
  const first = products[0];
  if (typeof first === 'string') return { tradeName: first, technicalName: first };
  if (first && typeof first === 'object') {
    const o = first as Record<string, unknown>;
    return {
      technicalName: String(o.technicalName ?? o.activeIngredient ?? o.productTitle ?? ''),
      tradeName: String(o.tradeName ?? o.productTitle ?? o.brand ?? ''),
    };
  }
  return {};
}

function addDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function addDaysDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function resolveEscalationSessionId(rec: RecRow): Promise<string | null> {
  if (rec.ai_session_id) return rec.ai_session_id;
  const visitAiCaseId = rec.metadata?.visitAiCaseId;
  if (!visitAiCaseId) return null;
  const { data } = await supabase
    .from('visit_ai_cases')
    .select('ai_advisory_session_id')
    .eq('id', String(visitAiCaseId))
    .maybeSingle();
  return data?.ai_advisory_session_id ? String(data.ai_advisory_session_id) : null;
}

export const recommendationFollowUpService = {
  async loadRecord(recommendationRecordId: string): Promise<RecRow | null> {
    const { data, error } = await supabase
      .from('recommendation_records')
      .select(
        `id, farmer_id, block_id, ai_session_id, field_finding_id, visit_issue_id, issue_detected, recommendation_text, products, dosage,
         application_type, dap_at_recommendation, language, status, communicated_at, created_at, technical_name, trade_name,
         severity, metadata, farmers(phone, preferred_language), farm_blocks(crop_type)`
      )
      .eq('id', recommendationRecordId)
      .maybeSingle();
    throwIfSupabaseError(error, 'Could not load recommendation');
    if (!data) return null;
    const raw = data as Record<string, unknown>;
    const farmersRel = raw.farmers;
    const blocksRel = raw.farm_blocks;
    return {
      ...raw,
      farmers: (Array.isArray(farmersRel) ? farmersRel[0] : farmersRel) as RecRow['farmers'],
      farm_blocks: (Array.isArray(blocksRel) ? blocksRel[0] : blocksRel) as RecRow['farm_blocks'],
    } as RecRow;
  },

  async onCompliancePromptSent(
    recommendationRecordId: string,
    question: string,
    noAction: 'escalate' | 'review'
  ): Promise<void> {
    const rec = await this.loadRecord(recommendationRecordId);
    if (!rec) return;

    await supabase.from('recommendation_follow_ups').insert({
      recommendation_record_id: recommendationRecordId,
      farmer_id: rec.farmer_id,
      block_id: rec.block_id,
      phase: 'compliance_check',
      status: 'sent',
      scheduled_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      metadata: { question, noAction },
    });

    await conversationPatchPending(rec.farmer_id, recommendationRecordId, 'compliance');
  },

  async handleComplianceReply(
    farmerId: string,
    recommendationRecordId: string,
    reply: 'yes' | 'no'
  ): Promise<string> {
    const rec = await this.loadRecord(recommendationRecordId);
    if (!rec || rec.farmer_id !== farmerId) {
      return 'Could not find your recommendation. Type menu for help.';
    }

    const lang = (rec.language || 'en') as AdvisoryLanguage;
    const copy = followUpCopy(lang);
    const now = new Date().toISOString();
    const meta = (rec.metadata as Record<string, unknown>) ?? {};
    const followMeta = meta.complianceFollowUp as { noAction?: 'escalate' | 'review' } | undefined;
    const noAction = followMeta?.noAction ?? 'escalate';

    await supabase
      .from('recommendation_follow_ups')
      .update({
        status: 'responded',
        farmer_response: reply === 'yes' ? 'compliance_yes' : 'compliance_no',
        responded_at: now,
        updated_at: now,
      })
      .eq('recommendation_record_id', recommendationRecordId)
      .eq('phase', 'compliance_check')
      .in('status', ['sent', 'scheduled']);

    if (reply === 'yes') {
      await supabase
        .from('recommendation_records')
        .update({
          application_status: 'applied',
          updated_at: now,
        })
        .eq('id', recommendationRecordId);
      await this.upsertLearningSample(rec, { applicationConfirmed: true });
      await clearConversationPending(farmerId);
      return copy.appliedThanks;
    }

    if (noAction === 'review') {
      await createTelecallerTask({
        farmerId,
        title: 'Agronomist review — treatment not completed',
        notes: `Farmer answered No to compliance check. Rec ${recommendationRecordId.slice(0, 8)}. Issue: ${rec.issue_detected ?? 'n/a'}`,
        priority: 'high',
      });
      await supabase
        .from('recommendation_records')
        .update({
          application_status: 'need_clarification',
          updated_at: now,
        })
        .eq('id', recommendationRecordId);
    } else {
      await this.escalateNoApplicationConfirmation(farmerId, recommendationRecordId, rec);
    }

    await this.upsertLearningSample(rec, { applicationConfirmed: false, escalated: true });
    await clearConversationPending(farmerId);
    return lang === 'ml'
      ? 'നിങ്ങളുടെ മറുപടി രേഖപ്പെടുത്തി. ഞങ്ങളുടെ അഗ്രോണമി ടീം ഉടൻ ബന്ധപ്പെടും.'
      : 'Thank you. Our agronomy team will follow up with you shortly.';
  },

  /** Stage 1 — recommendation communicated; schedule Day-1 application check. */
  async onRecommendationCommunicated(recommendationRecordId: string): Promise<void> {
    if (!env.ENABLE_ADVISORY_FOLLOW_UPS) return;

    const rec = await this.loadRecord(recommendationRecordId);
    if (!rec) return;

    const now = new Date().toISOString();
    await supabase
      .from('recommendation_records')
      .update({
        application_status: 'pending_application',
        updated_at: now,
        ...(rec.communicated_at ? {} : { communicated_at: now, status: 'communicated' }),
      })
      .eq('id', recommendationRecordId);

    await this.scheduleJob({
      farmerId: rec.farmer_id,
      recommendationRecordId,
      jobType: 'rec_application_check',
      scheduledAt: addDays(APPLICATION_CHECK_DAYS()),
      payload: { language: rec.language, phase: 'application_check' },
      sessionId: rec.ai_session_id,
    });

    await this.scheduleNoResponseEscalation(recommendationRecordId, rec.farmer_id);

    await this.upsertLearningSample(rec, { applicationConfirmed: false });
  },

  /** After AI diagnosis — mark latest session rec as communicated and start follow-up. */
  async bootstrapFromDiagnosisSession(sessionId: string, farmerId: string): Promise<void> {
    const { data: rec } = await supabase
      .from('recommendation_records')
      .select('id')
      .eq('ai_session_id', sessionId)
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!rec?.id) return;

    const now = new Date().toISOString();
    await supabase
      .from('recommendation_records')
      .update({
        status: 'communicated',
        communicated_at: now,
        application_status: 'pending_application',
        updated_at: now,
      })
      .eq('id', rec.id);

    await this.onRecommendationCommunicated(rec.id);
  },

  async scheduleJob(params: {
    farmerId: string;
    recommendationRecordId: string;
    jobType: string;
    scheduledAt: string;
    payload?: Record<string, unknown>;
    sessionId?: string | null;
  }): Promise<void> {
    const { data: existing } = await supabase
      .from('advisory_automation_jobs')
      .select('id')
      .eq('farmer_id', params.farmerId)
      .eq('job_type', params.jobType)
      .in('status', ['pending', 'processing'])
      .contains('payload', { recommendationRecordId: params.recommendationRecordId })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      logger.info(
        {
          farmerId: params.farmerId,
          jobType: params.jobType,
          recommendationRecordId: params.recommendationRecordId,
        },
        'Skipping duplicate automation job schedule'
      );
      return;
    }

    await supabase.from('advisory_automation_jobs').insert({
      farmer_id: params.farmerId,
      session_id: params.sessionId ?? null,
      job_type: params.jobType,
      scheduled_at: params.scheduledAt,
      payload: {
        recommendationRecordId: params.recommendationRecordId,
        ...params.payload,
      },
    });
  },

  /**
   * When a farmer starts a new photo diagnosis, push due follow-up prompts out
   * so they are not flooded with old "Have you applied…" messages mid-analysis.
   * Also collapses duplicate pending application-check jobs for the same farmer
   * (generic copy makes them look identical in WhatsApp).
   */
  async deferPendingFollowUpJobs(farmerId: string, hours = 6): Promise<number> {
    const deferUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const followUpTypes = [
      'rec_application_check',
      'rec_application_reminder',
      'whatsapp_follow_up',
      'cultivation_application_prompt',
    ];

    const { data, error } = await supabase
      .from('advisory_automation_jobs')
      .update({
        scheduled_at: deferUntil,
        last_error: 'Deferred — farmer started new photo diagnosis',
      })
      .eq('farmer_id', farmerId)
      .eq('status', 'pending')
      .in('job_type', followUpTypes)
      .lte('scheduled_at', new Date().toISOString())
      .select('id');

    if (error) {
      logger.warn({ err: error, farmerId }, 'Could not defer follow-up jobs during diagnosis');
      return 0;
    }

    // Keep at most one pending application-check / whatsapp_follow_up per farmer.
    await this.collapseDuplicateApplicationJobs(farmerId);

    const count = data?.length ?? 0;
    if (count > 0) {
      logger.info({ farmerId, count, deferUntil }, 'Deferred due follow-up jobs during photo diagnosis');
    }
    return count;
  },

  /** Cancel extra pending application prompts so one album upload cannot fan out N identical WhatsApp messages. */
  async collapseDuplicateApplicationJobs(farmerId: string): Promise<number> {
    const { data: pending } = await supabase
      .from('advisory_automation_jobs')
      .select('id, job_type, scheduled_at, payload')
      .eq('farmer_id', farmerId)
      .eq('status', 'pending')
      .in('job_type', ['rec_application_check', 'whatsapp_follow_up'])
      .order('scheduled_at', { ascending: false });

    if (!pending?.length || pending.length === 1) return 0;

    const keepId = pending[0]!.id;
    const dropIds = pending.slice(1).map((j) => j.id);
    const { error } = await supabase
      .from('advisory_automation_jobs')
      .update({
        status: 'cancelled',
        last_error: 'Collapsed duplicate application-check job',
        completed_at: new Date().toISOString(),
      })
      .in('id', dropIds);

    if (error) {
      logger.warn({ err: error, farmerId }, 'Could not collapse duplicate application jobs');
      return 0;
    }
    logger.info(
      { farmerId, kept: keepId, cancelled: dropIds.length },
      'Collapsed duplicate application-check jobs'
    );
    return dropIds.length;
  },

  async sendApplicationCheck(recommendationRecordId: string): Promise<boolean> {
    const rec = await this.loadRecord(recommendationRecordId);
    if (!rec?.farmers?.phone) return false;

    if (
      rec.application_status === 'applied' ||
      rec.application_status === 'not_applied' ||
      rec.status === 'applied' ||
      rec.status === 'outcome_recorded'
    ) {
      logger.info(
        { recommendationRecordId, status: rec.status, applicationStatus: rec.application_status },
        'Skipping application check — already resolved'
      );
      return false;
    }

    // Never interrupt an in-progress photo diagnosis with follow-up buttons.
    const { data: sess } = await supabase
      .from('conversation_sessions')
      .select('context')
      .eq('farmer_id', rec.farmer_id)
      .eq('channel', 'whatsapp')
      .maybeSingle();
    const ctx = (sess?.context ?? {}) as Record<string, unknown>;
    const inFlightAt = ctx.diagnosisInFlightAt ? Date.parse(String(ctx.diagnosisInFlightAt)) : NaN;
    if (Number.isFinite(inFlightAt) && Date.now() - inFlightAt < 3 * 60 * 1000) {
      logger.info(
        { recommendationRecordId, farmerId: rec.farmer_id },
        'Skipping application check — diagnosis in flight'
      );
      return false;
    }

    const since = new Date(
      Date.now() - APPLICATION_CHECK_DEDUP_HOURS() * 60 * 60 * 1000
    ).toISOString();
    const { data: recent } = await supabase
      .from('recommendation_follow_ups')
      .select('id')
      .eq('recommendation_record_id', recommendationRecordId)
      .eq('phase', 'application_check')
      .in('status', ['sent', 'scheduled'])
      .gte('sent_at', since)
      .limit(1)
      .maybeSingle();

    if (recent?.id) {
      logger.info(
        { recommendationRecordId, since },
        'Skipping duplicate application check — already sent recently'
      );
      await conversationPatchPending(rec.farmer_id, recommendationRecordId, 'application');
      return false;
    }

    // Also skip if ANY application check was sent to this farmer recently (generic copy looks identical).
    const { data: recentFarmer } = await supabase
      .from('recommendation_follow_ups')
      .select('id')
      .eq('farmer_id', rec.farmer_id)
      .eq('phase', 'application_check')
      .in('status', ['sent', 'scheduled'])
      .or(`sent_at.gte.${since},created_at.gte.${since}`)
      .limit(1)
      .maybeSingle();

    if (recentFarmer?.id) {
      logger.info(
        { recommendationRecordId, farmerId: rec.farmer_id, since },
        'Skipping application check — farmer already received one recently'
      );
      return false;
    }

    // Claim before WhatsApp send so concurrent workers cannot double-send.
    const now = new Date().toISOString();
    const lang = (rec.language || rec.farmers.preferred_language || 'en') as AdvisoryLanguage;
    const followUpCtx = contextFromRecommendationRecord(rec, lang);
    const body = formatApplicationCheckMessage(lang, followUpCtx);

    const { data: claim, error: claimErr } = await supabase
      .from('recommendation_follow_ups')
      .insert({
        recommendation_record_id: recommendationRecordId,
        farmer_id: rec.farmer_id,
        block_id: rec.block_id,
        phase: 'application_check',
        status: 'scheduled',
        scheduled_at: now,
        sent_at: now,
        metadata: { claim: 'application_check_send', question: body },
      })
      .select('id')
      .maybeSingle();

    if (claimErr || !claim?.id) {
      logger.info(
        { recommendationRecordId, err: claimErr },
        'Skipping application check — could not claim send slot'
      );
      return false;
    }

    // Winner-takes-all: if another claim landed first for this farmer, abort.
    const { data: peers } = await supabase
      .from('recommendation_follow_ups')
      .select('id')
      .eq('farmer_id', rec.farmer_id)
      .eq('phase', 'application_check')
      .in('status', ['scheduled', 'sent'])
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(1);

    if (peers?.[0]?.id && peers[0].id !== claim.id) {
      await supabase
        .from('recommendation_follow_ups')
        .update({ status: 'cancelled', metadata: { superseded: true } })
        .eq('id', claim.id);
      logger.info(
        { recommendationRecordId, winner: peers[0].id },
        'Skipping application check — another send claimed first'
      );
      return false;
    }

    try {
      try {
        await whatsappService.sendButtons({
          to: rec.farmers.phone,
          body,
          buttons: [
            { id: 'rec.apply_yes', title: 'Yes Applied' },
            { id: 'rec.apply_not', title: 'Not Yet' },
            { id: 'rec.apply_help', title: 'Need Help' },
          ],
        });
      } catch {
        await whatsappService.sendText(
          rec.farmers.phone,
          `${body}\n\nReply: Yes Applied / Not Yet / Need Clarification`
        );
      }

      await supabase
        .from('recommendation_follow_ups')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', claim.id);

      await conversationPatchPending(rec.farmer_id, recommendationRecordId, 'application');
      await this.collapseDuplicateApplicationJobs(rec.farmer_id);
      return true;
    } catch (err) {
      await supabase
        .from('recommendation_follow_ups')
        .update({
          status: 'cancelled',
          metadata: { claim: 'application_check_send', error: String(err) },
        })
        .eq('id', claim.id);
      throw err;
    }
  },

  async sendApplicationReminder(recommendationRecordId: string, reminderCount: number): Promise<void> {
    const rec = await this.loadRecord(recommendationRecordId);
    if (!rec?.farmers?.phone) return;

    const lang = (rec.language || rec.farmers.preferred_language || 'en') as AdvisoryLanguage;
    await whatsappService.sendText(rec.farmers.phone, followUpCopy(lang).notYetReminder);

    const now = new Date().toISOString();
    await supabase.from('recommendation_follow_ups').insert({
      recommendation_record_id: recommendationRecordId,
      farmer_id: rec.farmer_id,
      block_id: rec.block_id,
      phase: 'application_reminder',
      status: 'sent',
      scheduled_at: now,
      sent_at: now,
      reminder_count: reminderCount,
    });
  },

  async sendOutcomeCheck(recommendationRecordId: string): Promise<boolean> {
    const rec = await this.loadRecord(recommendationRecordId);
    if (!rec?.farmers?.phone) return false;

    const lang = (rec.language || rec.farmers.preferred_language || 'en') as AdvisoryLanguage;
    const copy = followUpCopy(lang);
    const issue = (rec.issue_detected ?? 'your crop issue').slice(0, 80);
    const body = copy.outcomeCheck.replace('our recommendation', `our advice for ${issue}`);

    const kpiOptions = this.outcomeKpiListOptions(lang);

    try {
      await whatsappService.sendList({
        to: rec.farmers.phone,
        body,
        buttonText: lang === 'ml' ? 'ഓപ്ഷൻ തിരഞ്ഞെടുക്കൂ' : 'Choose option',
        sections: [{ title: 'Outcome', rows: kpiOptions }],
      });
    } catch {
      try {
        await whatsappService.sendButtons({
          to: rec.farmers.phone,
          body,
          buttons: [
            { id: 'rec.outcome_full', title: 'Crop recovered' },
            { id: 'rec.outcome_slight', title: 'Partial improve' },
            { id: 'rec.outcome_none', title: 'No improvement' },
          ],
        });
        await whatsappService.sendText(
          rec.farmers.phone,
          lang === 'ml' ? '4 = കൂടുതൽ മോശം (Worse)' : '4 = Worse — reply 4 if crop worsened'
        );
      } catch {
        await whatsappService.sendText(
          rec.farmers.phone,
          `${body}\n\n1 Crop recovered\n2 Partially improved\n3 No improvement\n4 Worse`
        );
      }
    }

    const now = new Date().toISOString();
    await supabase.from('recommendation_follow_ups').insert({
      recommendation_record_id: recommendationRecordId,
      farmer_id: rec.farmer_id,
      block_id: rec.block_id,
      phase: 'outcome_check',
      status: 'sent',
      scheduled_at: now,
      sent_at: now,
      metadata: { kpiVersion: 2 },
    });

    await this.scheduleJob({
      farmerId: rec.farmer_id,
      recommendationRecordId,
      jobType: 'rec_outcome_reminder',
      scheduledAt: addDays(OUTCOME_REMINDER_DAYS()),
      payload: { language: rec.language, reminderCount: 1 },
      sessionId: rec.ai_session_id,
    });

    await this.scheduleJob({
      farmerId: rec.farmer_id,
      recommendationRecordId,
      jobType: 'rec_outcome_no_response',
      scheduledAt: addDays(OUTCOME_NO_RESPONSE_DAYS()),
      payload: { language: rec.language },
      sessionId: rec.ai_session_id,
    });

    await conversationPatchPending(rec.farmer_id, recommendationRecordId, 'outcome');
    return true;
  },

  outcomeKpiListOptions(lang: AdvisoryLanguage): Array<{
    id: string;
    title: string;
    description?: string;
  }> {
    if (lang === 'ml') {
      return [
        { id: 'rec.outcome_full', title: '1 പൂർണ്ണ മെച്ചം', description: 'Fully improved' },
        { id: 'rec.outcome_slight', title: '2 കുറച്ച് മെച്ചം', description: 'Slightly improved' },
        { id: 'rec.outcome_none', title: '3 മെച്ചമില്ല', description: 'No improvement' },
        { id: 'rec.outcome_worse', title: '4 കൂടുതൽ മോശം', description: 'Worse' },
      ];
    }
    return [
      { id: 'rec.outcome_full', title: '1 Crop recovered', description: 'Fully recovered' },
      { id: 'rec.outcome_slight', title: '2 Partially improved', description: 'Some improvement' },
      { id: 'rec.outcome_none', title: '3 No improvement', description: 'No change' },
      { id: 'rec.outcome_worse', title: '4 Worse', description: 'Crop worsened' },
    ];
  },

  async sendOutcomeReminder(recommendationRecordId: string, reminderCount: number): Promise<void> {
    const rec = await this.loadRecord(recommendationRecordId);
    if (!rec?.farmers?.phone) return;

    const { data: open } = await supabase
      .from('recommendation_follow_ups')
      .select('id, status')
      .eq('recommendation_record_id', recommendationRecordId)
      .eq('phase', 'outcome_check')
      .in('status', ['sent'])
      .limit(1);

    if (!open?.length) return;

    const lang = (rec.language || rec.farmers.preferred_language || 'en') as AdvisoryLanguage;
    const copy = followUpCopy(lang);
    await whatsappService.sendText(rec.farmers.phone, copy.outcomeReminder);

    const now = new Date().toISOString();
    await supabase.from('recommendation_follow_ups').insert({
      recommendation_record_id: recommendationRecordId,
      farmer_id: rec.farmer_id,
      block_id: rec.block_id,
      phase: 'outcome_reminder',
      status: 'sent',
      scheduled_at: now,
      sent_at: now,
      reminder_count: reminderCount,
    });

    if (reminderCount < MAX_OUTCOME_REMINDERS()) {
      await this.scheduleJob({
        farmerId: rec.farmer_id,
        recommendationRecordId,
        jobType: 'rec_outcome_reminder',
        scheduledAt: addDays(OUTCOME_REMINDER_DAYS()),
        payload: { language: rec.language, reminderCount: reminderCount + 1 },
        sessionId: rec.ai_session_id,
      });
    }
  },

  async handleOutcomePhotoUpload(
    farmerId: string,
    recommendationRecordId: string
  ): Promise<string | null> {
    const rec = await this.loadRecord(recommendationRecordId);
    if (!rec || rec.farmer_id !== farmerId) return null;

    const lang = (rec.language || 'en') as AdvisoryLanguage;
    const existing = await this.readOutcomeKpi(recommendationRecordId);
    const kpi: OutcomeKpiPayload = {
      ...(existing ?? {
        improvementLevel: 'slight_improvement',
        collectedAt: new Date().toISOString(),
        source: 'whatsapp_text',
        aiClassification: 'uncertain',
        aiConfidence: 0.5,
      }),
      photoUploaded: true,
      collectedAt: new Date().toISOString(),
    };

    await supabase
      .from('recommendation_records')
      .update({
        outcome_kpi: kpi,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recommendationRecordId);

    const recoveryQuestions = await issueFollowUpQuestionsService.suggest({
      issueCategory: 'disease',
      issueName: String(rec.issue_detected ?? 'crop recovery'),
      cropType: String((rec.farm_blocks as { crop_type?: string } | null)?.crop_type ?? 'ginger'),
      recommendationText: String(rec.recommendation_text ?? ''),
      photoCount: 1,
      observation: 'Farmer uploaded recovery photo after treatment',
    });
    if (recoveryQuestions.length && rec.farmers?.phone) {
      const qText =
        lang === 'ml'
          ? `ഫോട്ടോ ലഭിച്ചു. ദയവായി ഇവയ്ക്ക് ഉത്തരം നൽകുക:\n${recoveryQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
          : `Thanks for the recovery photo. Please answer:\n${recoveryQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
      await whatsappService.sendText(rec.farmers.phone, qText.slice(0, 1500)).catch(() => {});
    }

    return followUpCopy(lang).outcomePhotoPrompt;
  },

  async handleOutcomeKpi(params: {
    farmerId: string;
    recommendationRecordId: string;
    improvementLevel: ImprovementLevel;
    source: OutcomeKpiPayload['source'];
    photoUploaded?: boolean;
    aiClassification?: OutcomeKpiPayload['aiClassification'];
    aiConfidence?: number;
    rawSnippet?: string;
  }): Promise<string> {
    const rec = await this.loadRecord(params.recommendationRecordId);
    if (!rec || rec.farmer_id !== params.farmerId) {
      return 'Could not find your recommendation. Type menu for help.';
    }

    const lang = (rec.language || 'en') as AdvisoryLanguage;
    const copy = followUpCopy(lang);
    const level = params.improvementLevel;
    const aiConf = params.aiConfidence ?? 0.88;

    const kpi: OutcomeKpiPayload = {
      improvementLevel: level,
      photoUploaded: params.photoUploaded ?? false,
      aiClassification:
        params.aiClassification ?? (aiConf < 0.6 ? 'uncertain' : level === 'fully_improved' ? 'positive' : level === 'slight_improvement' ? 'partial' : 'failed'),
      aiConfidence: aiConf,
      collectedAt: new Date().toISOString(),
      source: params.source,
      rawSnippet: params.rawSnippet?.slice(0, 300),
    };

    const meta = (rec.metadata ?? {}) as Record<string, unknown>;
    const routing = await outcomeHumanRoutingService.decide({
      farmerId: params.farmerId,
      recommendationRecordId: params.recommendationRecordId,
      improvementLevel: level,
      kpi,
      severity: rec.severity,
      aiSessionConfidence: null,
      farmerMetadata: meta,
    });

    await supabase
      .from('recommendation_records')
      .update({
        outcome_kpi: kpi,
        outcome_source: params.source === 'agronomist' ? 'agronomist' : 'whatsapp_kpi',
        needs_human_outcome_review: routing.needsHumanReview,
        human_outcome_review_reason: routing.needsHumanReview
          ? outcomeHumanRoutingService.formatReasonsForStaff(routing.reasons)
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.recommendationRecordId);

    const reply = improvementLevelToOutcomeReply(level);
    await this.markOutcomeFollowUpResponded(params.recommendationRecordId, reply);

    if (routing.needsHumanReview) {
      await this.queueHumanOutcomeVerification(params.farmerId, rec, level, routing.reasons);
      if (level === 'worse') {
        await clearConversationPending(params.farmerId);
        return copy.worsenedReply;
      }
      if (level === 'no_improvement') {
        await clearConversationPending(params.farmerId);
        return copy.noImprovementReply;
      }
      await clearConversationPending(params.farmerId);
      return lang === 'ml'
        ? 'നന്ദി! ഞങ്ങളുടെ ടീം ഈ അപ്ഡേറ്റ് പരിശോധിക്കും.'
        : 'Thank you! Our team will verify this update shortly.';
    }

    return this.handleOutcomeReply(params.farmerId, params.recommendationRecordId, reply, {
      kpi,
      skipHumanRouting: true,
    });
  },

  async interpretAndHandleOutcomeText(
    farmerId: string,
    recommendationRecordId: string,
    text: string,
    hasImage?: boolean
  ): Promise<string | null> {
    const rec = await this.loadRecord(recommendationRecordId);
    if (!rec || rec.farmer_id !== farmerId) return null;

    const lang = (rec.language || 'en') as AdvisoryLanguage;
    const interpreted = await outcomeKpiInterpretationService.interpretFarmerReply({
      text,
      language: lang,
      issueLabel: rec.issue_detected,
      hasImage,
    });
    if (!interpreted) return null;

    return this.handleOutcomeKpi({
      farmerId,
      recommendationRecordId,
      improvementLevel: interpreted.improvementLevel,
      source: interpreted.source === 'whatsapp_ai' ? 'whatsapp_ai' : 'whatsapp_text',
      photoUploaded: hasImage,
      aiClassification: interpreted.aiClassification,
      aiConfidence: interpreted.confidence,
      rawSnippet: interpreted.rawSnippet,
    });
  },

  async readOutcomeKpi(recommendationRecordId: string): Promise<OutcomeKpiPayload | null> {
    const { data } = await supabase
      .from('recommendation_records')
      .select('outcome_kpi')
      .eq('id', recommendationRecordId)
      .maybeSingle();
    const kpi = data?.outcome_kpi;
    if (!kpi || typeof kpi !== 'object') return null;
    return kpi as OutcomeKpiPayload;
  },

  async markOutcomeFollowUpResponded(
    recommendationRecordId: string,
    reply: OutcomeReply
  ): Promise<void> {
    const now = new Date().toISOString();
    await supabase
      .from('recommendation_follow_ups')
      .update({
        status: 'responded',
        farmer_response: reply,
        responded_at: now,
        updated_at: now,
      })
      .eq('recommendation_record_id', recommendationRecordId)
      .eq('phase', 'outcome_check')
      .in('status', ['sent', 'scheduled']);
  },

  async queueHumanOutcomeVerification(
    farmerId: string,
    rec: RecRow,
    level: ImprovementLevel,
    reasons: string[]
  ): Promise<void> {
    const needsEscalation = level === 'worse' || level === 'no_improvement';
    if (needsEscalation && rec.ai_session_id) {
      if (level === 'worse') {
        await this.escalateWorsened(farmerId, rec);
      } else {
        await this.escalateNoImprovement(farmerId, rec.id, rec);
      }
      return;
    }

    if (reasons.includes('qa_random_sample') || reasons.includes('uncertain_ai_classification')) {
      await createTelecallerTask({
        farmerId,
        title: 'Outcome QA verification',
        notes: `Verify WhatsApp KPI outcome for ${rec.issue_detected ?? 'crop case'}. Reasons: ${reasons.join(', ')}`,
        priority: 'normal',
      });
    }
  },

  async escalateOutcomeNoResponse(
    farmerId: string,
    recommendationRecordId: string
  ): Promise<void> {
    const rec = await this.loadRecord(recommendationRecordId);
    if (!rec) return;

    const { data: responded } = await supabase
      .from('recommendation_follow_ups')
      .select('id')
      .eq('recommendation_record_id', recommendationRecordId)
      .eq('phase', 'outcome_check')
      .in('status', ['responded', 'completed'])
      .limit(1);

    if (responded?.length) return;

    await supabase
      .from('recommendation_records')
      .update({
        needs_human_outcome_review: true,
        human_outcome_review_reason: outcomeHumanRoutingService.formatReasonsForStaff([
          'outcome_no_whatsapp_response',
        ]),
        updated_at: new Date().toISOString(),
      })
      .eq('id', recommendationRecordId);

    await visitAdvisoryEscalationService.escalate({
      farmerId,
      reason: 'outcome_no_whatsapp_response',
      recommendationRecordId,
      issueLabel: rec.issue_detected,
      notes: `No KPI reply after outcome message. Rec ${recommendationRecordId.slice(0, 8)}`,
    });

    const sessionId = await resolveEscalationSessionId(rec);
    await visitAdvisoryEscalationService.scheduleEscalationJob({
      farmerId,
      reason: 'outcome_no_whatsapp_response',
      sessionId,
      scheduledAt: addDays(1),
      payload: {
        recommendationRecordId,
        fieldFindingId: rec.field_finding_id ?? null,
        visitIssueId: rec.visit_issue_id ?? null,
        issueLabel: rec.issue_detected,
        notes: 'Scheduled callback after outcome no-response',
      },
    }).catch(() => {});
  },

  async handleApplicationReply(
    farmerId: string,
    recommendationRecordId: string,
    reply: ApplicationReply
  ): Promise<string> {
    const rec = await this.loadRecord(recommendationRecordId);
    if (!rec || rec.farmer_id !== farmerId) {
      return 'Could not find your recommendation. Type menu for help.';
    }

    const lang = (rec.language || 'en') as AdvisoryLanguage;
    const copy = followUpCopy(lang);
    const now = new Date().toISOString();

    await supabase
      .from('recommendation_follow_ups')
      .update({
        status: 'responded',
        farmer_response: reply,
        responded_at: now,
        updated_at: now,
      })
      .eq('recommendation_record_id', recommendationRecordId)
      .eq('phase', 'application_check')
      .in('status', ['sent', 'scheduled']);

    if (reply === 'yes_applied') {
      const productMeta = parseProducts(rec.products);
      const technicalName = rec.technical_name || productMeta.technicalName || null;
      const tradeName = rec.trade_name || productMeta.tradeName || null;
      const appliedDate = new Date().toISOString().slice(0, 10);
      const followUpDate = addDaysDate(OUTCOME_CHECK_DAYS());

      const activity = await cultivationLoggingService.logActivity({
        farmerId,
        activityType: mapApplicationMethod(rec.application_type),
        advisorySessionId: rec.ai_session_id ?? undefined,
        dosageNotes: rec.dosage ?? undefined,
        notes: 'Farmer confirmed recommendation applied (auto follow-up)',
        source: 'recommendation_follow_up',
      });

      await supabase.from('recommendation_applications').upsert(
        {
          recommendation_record_id: recommendationRecordId,
          farmer_id: farmerId,
          block_id: rec.block_id,
          technical_name: technicalName,
          trade_name: tradeName,
          dosage: rec.dosage,
          application_method: rec.application_type,
          applied_at: appliedDate,
          follow_up_date: followUpDate,
          result_status: 'pending',
          applied_by: 'farmer',
          cultivation_activity_id: activity.id,
          updated_at: now,
        },
        { onConflict: 'recommendation_record_id' }
      );

      await supabase
        .from('recommendation_records')
        .update({
          status: 'applied',
          application_status: 'applied',
          applied_at: now,
          updated_at: now,
        })
        .eq('id', recommendationRecordId);

      let skipGenericOutcome = false;
      if (env.MAIOS_DISABLE_GENERIC_OUTCOME !== false && rec.ai_session_id) {
        const { data: session } = await supabase
          .from('ai_advisory_sessions')
          .select('metadata')
          .eq('id', rec.ai_session_id)
          .maybeSingle();
        const meta = (session?.metadata as Record<string, unknown>) ?? {};
        skipGenericOutcome = Boolean(meta.maiosCase ?? meta.gingerSopV3);
      }

      if (!skipGenericOutcome) {
        await this.scheduleJob({
          farmerId,
          recommendationRecordId,
          jobType: 'rec_outcome_check',
          scheduledAt: new Date(
            Date.now() + OUTCOME_CHECK_DAYS() * 24 * 60 * 60 * 1000
          ).toISOString(),
          payload: { language: rec.language, phase: 'outcome_check' },
          sessionId: rec.ai_session_id,
        });
        const secondDays = OUTCOME_SECOND_CHECK_DAYS();
        if (secondDays > OUTCOME_CHECK_DAYS()) {
          await this.scheduleJob({
            farmerId,
            recommendationRecordId,
            jobType: 'rec_outcome_check',
            scheduledAt: new Date(Date.now() + secondDays * 24 * 60 * 60 * 1000).toISOString(),
            payload: {
              language: rec.language,
              phase: 'outcome_check',
              effectivenessCheck: true,
              day: secondDays,
            },
            sessionId: rec.ai_session_id,
          });
        }
      }

      await this.upsertLearningSample(rec, { applicationConfirmed: true });
      const { farmerEventCaptureService } = await import(
        '../intelligence/farmer-event-capture.service.js'
      );
      void farmerEventCaptureService.trackRecommendationApplied({
        farmerId,
        recommendationRecordId,
      });
      await clearConversationPending(farmerId);
      return copy.appliedThanks;
    }

    if (reply === 'not_yet') {
      await supabase
        .from('recommendation_records')
        .update({ application_status: 'pending_application', updated_at: now })
        .eq('id', recommendationRecordId);

      const { count } = await supabase
        .from('recommendation_follow_ups')
        .select('id', { count: 'exact', head: true })
        .eq('recommendation_record_id', recommendationRecordId)
        .eq('phase', 'application_reminder');

      const reminderCount = (count ?? 0) + 1;
      if (reminderCount <= MAX_APPLICATION_REMINDERS()) {
        await this.scheduleJob({
          farmerId,
          recommendationRecordId,
          jobType: 'rec_application_reminder',
          scheduledAt: addDays(1),
          payload: { language: rec.language, reminderCount },
          sessionId: rec.ai_session_id,
        });
      } else {
        await this.escalateNoApplicationConfirmation(farmerId, recommendationRecordId, rec);
      }

      await clearConversationPending(farmerId);
      return copy.notYetReminder;
    }

    // need_clarification
    await supabase
      .from('recommendation_records')
      .update({ application_status: 'need_clarification', updated_at: now })
      .eq('id', recommendationRecordId);

    await createTelecallerTask({
      farmerId,
      title: 'Telecaller Callback Required',
      notes: `Farmer needs clarification on recommendation ${recommendationRecordId.slice(0, 8)}`,
      priority: 'high',
    });

    await clearConversationPending(farmerId);
    return copy.clarificationAck;
  },

  async handleOutcomeReply(
    farmerId: string,
    recommendationRecordId: string,
    reply: OutcomeReply,
    opts?: { kpi?: OutcomeKpiPayload; skipHumanRouting?: boolean }
  ): Promise<string> {
    const rec = await this.loadRecord(recommendationRecordId);
    if (!rec || rec.farmer_id !== farmerId) {
      return 'Could not find your recommendation. Type menu for help.';
    }

    const lang = (rec.language || 'en') as AdvisoryLanguage;
    const copy = followUpCopy(lang);
    const now = new Date().toISOString();

    const outcomeMap: Record<OutcomeReply, 'better' | 'partial' | 'no_improvement'> = {
      improved: 'better',
      partial: 'partial',
      no_improvement: 'no_improvement',
      worsened: 'no_improvement',
    };

    const resultStatusMap: Record<OutcomeReply, string> = {
      improved: 'improved',
      partial: 'partial',
      no_improvement: 'no_improvement',
      worsened: 'worsened',
    };

    if (!opts?.skipHumanRouting) {
      await this.markOutcomeFollowUpResponded(recommendationRecordId, reply);
    } else {
      const now2 = new Date().toISOString();
      await supabase
        .from('recommendation_follow_ups')
        .update({
          status: 'completed',
          farmer_response: reply,
          responded_at: now2,
          updated_at: now2,
        })
        .eq('recommendation_record_id', recommendationRecordId)
        .eq('phase', 'outcome_check');
    }

    if (opts?.kpi) {
      await supabase
        .from('recommendation_records')
        .update({
          outcome_kpi: opts.kpi,
          outcome_source: 'whatsapp_kpi',
          updated_at: now,
        })
        .eq('id', recommendationRecordId);
    }

    await supabase
      .from('recommendation_applications')
      .update({
        result_status: resultStatusMap[reply],
        updated_at: now,
      })
      .eq('recommendation_record_id', recommendationRecordId);

    await recommendationRecordsService.recordOutcome(
      recommendationRecordId,
      outcomeMap[reply === 'worsened' ? 'no_improvement' : reply],
      { notes: `WhatsApp follow-up: ${reply}` }
    );

    await accuracyMetricsService.logFollowupOutcome({
      farmerId,
      sessionId: rec.ai_session_id ?? undefined,
      outcome:
        reply === 'improved'
          ? 'improved'
          : reply === 'worsened'
            ? 'worsened'
            : reply === 'partial'
              ? 'partial'
              : 'no_improvement',
      notes: `Recommendation ${recommendationRecordId}: ${reply}`,
    });

    await this.upsertLearningSample(rec, {
      applicationConfirmed: true,
      outcome: reply,
      escalated: reply === 'worsened' || reply === 'no_improvement',
    });

    if (reply === 'improved' || reply === 'partial') {
      await aiReuseService.markOutcomeForSession(rec.ai_session_id, true).catch(() => {});
      await learningLoopService.onLearningSampleReady(recommendationRecordId).catch(() => {});
      await clearConversationPending(farmerId);
      return reply === 'partial' ? copy.slightImprovementThanks : copy.improvedThanks;
    }

    if (reply === 'worsened') {
      await this.escalateWorsened(farmerId, rec);
      await clearConversationPending(farmerId);
      return copy.worsenedReply;
    }

    await this.escalateNoImprovement(farmerId, recommendationRecordId, rec);
    await clearConversationPending(farmerId);
    return copy.noImprovementReply;
  },

  async resolvePendingRecommendationId(farmerId: string): Promise<string | null> {
    const { data: session } = await supabase
      .from('conversation_sessions')
      .select('context')
      .eq('farmer_id', farmerId)
      .eq('channel', 'whatsapp')
      .maybeSingle();

    const ctx = (session?.context ?? {}) as Record<string, unknown>;
    if (typeof ctx.pendingRecommendationRecordId === 'string') {
      return ctx.pendingRecommendationRecordId;
    }

    const { data: rec } = await supabase
      .from('recommendation_records')
      .select('id')
      .eq('farmer_id', farmerId)
      .in('status', ['communicated', 'applied'])
      .in('application_status', ['pending_application', 'applied'])
      .order('communicated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return rec?.id ?? null;
  },

  async processAutomationJob(job: {
    farmer_id: string;
    job_type: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const recId = String(job.payload.recommendationRecordId ?? '');
    if (!recId) {
      logger.warn({ jobType: job.job_type }, 'Recommendation follow-up job missing rec id');
      return;
    }

    switch (job.job_type) {
      case 'rec_application_check':
        await this.sendApplicationCheck(recId);
        break;
      case 'rec_application_reminder': {
        const reminderCount = Number(job.payload.reminderCount ?? 1);
        await this.sendApplicationReminder(recId, reminderCount);
        break;
      }
      case 'rec_outcome_check':
        await this.sendOutcomeCheck(recId);
        break;
      case 'rec_outcome_reminder': {
        const reminderCount = Number(job.payload.reminderCount ?? 1);
        await this.sendOutcomeReminder(recId, reminderCount);
        break;
      }
      case 'rec_outcome_no_response':
        await this.escalateOutcomeNoResponse(job.farmer_id, recId);
        break;
      case 'rec_no_response_escalation':
        await this.escalateNoApplicationConfirmation(job.farmer_id, recId, null);
        break;
      default:
        break;
    }
  },

  async escalateNoApplicationConfirmation(
    farmerId: string,
    recommendationRecordId: string,
    rec: RecRow | null
  ): Promise<void> {
    const row = rec ?? (await this.loadRecord(recommendationRecordId));
    await visitAdvisoryEscalationService.escalate({
      farmerId,
      reason: 'recommendation_not_applied',
      recommendationRecordId,
      fieldFindingId: row?.field_finding_id ? String(row.field_finding_id) : null,
      issueLabel: row?.issue_detected,
      notes: `No application confirmation after reminders. Rec ${recommendationRecordId.slice(0, 8)}`,
    });
  },

  async escalateNoImprovement(
    farmerId: string,
    recommendationRecordId: string,
    rec: RecRow
  ): Promise<void> {
    await createTelecallerTask({
      farmerId,
      title: 'Reassessment Required',
      notes: `No improvement after recommendation ${recommendationRecordId.slice(0, 8)}. Issue: ${rec.issue_detected ?? 'n/a'}`,
      priority: 'high',
    });

    const sessionId = await resolveEscalationSessionId(rec);
    await visitAdvisoryEscalationService.scheduleEscalationJob({
      farmerId,
      reason: 'recommendation_not_applied',
      sessionId,
      scheduledAt: addDays(2),
      payload: {
        recommendationRecordId,
        fieldFindingId: rec.field_finding_id ?? null,
        visitIssueId: rec.visit_issue_id ?? null,
        issueLabel: rec.issue_detected,
        notes: 'Scheduled callback after no improvement',
      },
    }).catch(() => {});

    if (sessionId) {
      await escalationService.ensureOpenEscalation({
        sessionId,
        farmerId,
        reason: 'No improvement after recommendation (Day-5 follow-up)',
        confidence_at_escalation: 0.5,
        priority: 'high',
      });
    }
  },

  async escalateWorsened(farmerId: string, rec: RecRow): Promise<void> {
    await visitAdvisoryEscalationService.escalate({
      farmerId,
      reason: 'outcome_worse',
      recommendationRecordId: rec.id,
      fieldFindingId: rec.field_finding_id ? String(rec.field_finding_id) : null,
      issueLabel: rec.issue_detected,
      notes: `Recommendation ${rec.id.slice(0, 8)}`,
      priority: 'urgent',
    });

    const sessionId = await resolveEscalationSessionId(rec);
    await visitAdvisoryEscalationService.scheduleEscalationJob({
      farmerId,
      reason: 'outcome_worse',
      sessionId,
      scheduledAt: addDays(1),
      payload: {
        recommendationRecordId: rec.id,
        fieldFindingId: rec.field_finding_id ?? null,
        visitIssueId: rec.visit_issue_id ?? null,
        issueLabel: rec.issue_detected,
        notes: 'Scheduled callback after worsened outcome',
      },
    }).catch(() => {});

    if (sessionId) {
      await escalationService.ensureOpenEscalation({
        sessionId,
        farmerId,
        reason: 'Worsened after recommendation (Day-5 follow-up)',
        confidence_at_escalation: 0.4,
        priority: 'urgent',
      });
    }
  },

  async scheduleNoResponseEscalation(recommendationRecordId: string, farmerId: string): Promise<void> {
    await this.scheduleJob({
      farmerId,
      recommendationRecordId,
      jobType: 'rec_no_response_escalation',
      scheduledAt: addDays(NO_RESPONSE_ESCALATION_DAYS()),
      payload: {},
    });
  },

  async getTelecallerFollowUpDetail(recommendationRecordId: string) {
    const rec = await this.loadRecord(recommendationRecordId);
    if (!rec) return null;

    const [{ data: application }, { data: followUps }, { data: sessions }] = await Promise.all([
      supabase
        .from('recommendation_applications')
        .select('*')
        .eq('recommendation_record_id', recommendationRecordId)
        .maybeSingle(),
      supabase
        .from('recommendation_follow_ups')
        .select('*')
        .eq('recommendation_record_id', recommendationRecordId)
        .order('created_at', { ascending: false }),
      rec.ai_session_id
        ? supabase
            .from('ai_advisory_sessions')
            .select('id, confidence_score, status, created_at')
            .eq('id', rec.ai_session_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return {
      recommendation: rec,
      application: application ?? null,
      followUps: followUps ?? [],
      session: sessions ?? null,
      escalationStatus: followUps?.some((f) => f.status === 'escalated') ?? false,
    };
  },

  async getKpis(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: recs } = await supabase
      .from('recommendation_records')
      .select(
        'id, status, application_status, outcome, communicated_at, applied_at, needs_human_outcome_review, outcome_kpi'
      )
      .gte('created_at', since);

    const rows = recs ?? [];
    const communicated = rows.filter((r) =>
      ['communicated', 'applied', 'outcome_recorded'].includes(String(r.status))
    );
    const applied = rows.filter(
      (r) => r.application_status === 'applied' || r.status === 'applied' || r.status === 'outcome_recorded'
    );
    const outcomes = rows.filter((r) => r.status === 'outcome_recorded');
    const success = outcomes.filter((r) => r.outcome === 'better' || r.outcome === 'partial');

    const { data: outcomeFollowUps } = await supabase
      .from('recommendation_follow_ups')
      .select('status, farmer_response, phase')
      .eq('phase', 'outcome_check')
      .gte('created_at', since);

    const outcomeSent = (outcomeFollowUps ?? []).filter((f) => f.status === 'sent' || f.status === 'responded' || f.status === 'completed');
    const outcomeResponded = (outcomeFollowUps ?? []).filter((f) =>
      ['responded', 'completed'].includes(String(f.status))
    );

    let photoUploaded = 0;
    let fullyImproved = 0;
    let slightImproved = 0;
    for (const r of rows) {
      const kpi = r.outcome_kpi as OutcomeKpiPayload | null;
      if (kpi?.photoUploaded) photoUploaded += 1;
      if (kpi?.improvementLevel === 'fully_improved') fullyImproved += 1;
      if (kpi?.improvementLevel === 'slight_improvement') slightImproved += 1;
    }

    const { count: pendingFollowUps } = await supabase
      .from('recommendation_follow_ups')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'scheduled')
      .gte('scheduled_at', since);

    const needsHumanReview = rows.filter(
      (r) => r.needs_human_outcome_review && !r.outcome
    ).length;

    return {
      periodDays: days,
      recommendationsCommunicated: communicated.length,
      applicationRatePct:
        communicated.length > 0
          ? Math.round((applied.length / communicated.length) * 100)
          : 0,
      outcomeRecorded: outcomes.length,
      successRatePct:
        outcomes.length > 0 ? Math.round((success.length / outcomes.length) * 100) : 0,
      whatsappKpi: {
        outcomeMessagesSent: outcomeSent.length,
        outcomeResponseRatePct:
          outcomeSent.length > 0
            ? Math.round((outcomeResponded.length / outcomeSent.length) * 100)
            : 0,
        fullyImprovedCount: fullyImproved,
        slightImprovementCount: slightImproved,
        photoUploadedCount: photoUploaded,
        pendingHumanVerification: needsHumanReview,
      },
      pendingScheduledFollowUps: pendingFollowUps ?? 0,
      noResponseFarmers: rows.filter((r) => r.application_status === 'pending_application').length,
    };
  },

  async upsertLearningSample(
    rec: RecRow,
    patch: {
      applicationConfirmed?: boolean;
      outcome?: string;
      escalated?: boolean;
    }
  ): Promise<void> {
    const productMeta = parseProducts(rec.products);
    const snapshot = {
      issue: rec.issue_detected,
      text: rec.recommendation_text.slice(0, 2000),
      dosage: rec.dosage,
      applicationType: rec.application_type,
      technicalName: rec.technical_name || productMeta.technicalName,
      tradeName: rec.trade_name || productMeta.tradeName,
      products: rec.products,
    };

    const { data: existing } = await supabase
      .from('ai_learning_samples')
      .select('id')
      .eq('recommendation_record_id', rec.id)
      .maybeSingle();

    const visitIssueId = (rec as RecRow & { visit_issue_id?: string | null }).visit_issue_id;
    const fieldFindingId = (rec as RecRow & { field_finding_id?: string | null }).field_finding_id;

    const row = {
      farmer_id: rec.farmer_id,
      ai_session_id: rec.ai_session_id,
      visit_issue_id: visitIssueId ?? null,
      field_finding_id: fieldFindingId ?? null,
      crop_type: rec.farm_blocks?.crop_type ?? null,
      disease_label: rec.issue_detected,
      dap: rec.dap_at_recommendation,
      severity: rec.severity,
      recommendation_snapshot: snapshot,
      application_confirmed: patch.applicationConfirmed ?? null,
      outcome: patch.outcome ?? null,
      escalated: patch.escalated ?? false,
    };

    if (existing?.id) {
      await supabase.from('ai_learning_samples').update(row).eq('id', existing.id);
    } else {
      await supabase.from('ai_learning_samples').insert({
        recommendation_record_id: rec.id,
        ...row,
      });
    }
  },

  async buildBlockTimelineEvents(blockId: string, farmerId: string) {
    const events: Array<{ title: string; at: string; kind: string; detail?: string }> = [];

    const { data: recs } = await supabase
      .from('recommendation_records')
      .select(
        'id, created_at, communicated_at, applied_at, issue_detected, status, application_status, outcome'
      )
      .eq('block_id', blockId)
      .eq('farmer_id', farmerId)
      .order('created_at', { ascending: false })
      .limit(10);

    for (const r of recs ?? []) {
      events.push({
        kind: 'diagnosis',
        title: 'Diagnosis / recommendation created',
        at: String(r.created_at),
        detail: r.issue_detected ?? undefined,
      });
      if (r.communicated_at) {
        events.push({
          kind: 'recommendation_sent',
          title: 'Recommendation sent',
          at: String(r.communicated_at),
        });
      }
      if (r.applied_at || r.application_status === 'applied') {
        events.push({
          kind: 'recommendation_applied',
          title: 'Recommendation applied',
          at: String(r.applied_at ?? r.communicated_at),
        });
      }
      if (r.status === 'outcome_recorded') {
        events.push({
          kind: 'follow_up_completed',
          title: 'Follow-up completed',
          at: String(r.applied_at ?? r.created_at),
          detail: r.outcome ? `Result: ${r.outcome}` : undefined,
        });
      }
    }

    const { data: apps } = await supabase
      .from('recommendation_applications')
      .select('applied_at, trade_name, technical_name, result_status')
      .eq('block_id', blockId)
      .eq('farmer_id', farmerId)
      .order('applied_at', { ascending: false })
      .limit(5);

    for (const a of apps ?? []) {
      events.push({
        kind: 'application_entry',
        title: `Application recorded — ${a.trade_name || a.technical_name || 'Treatment'}`,
        at: `${a.applied_at}T12:00:00.000Z`,
        detail: a.result_status ? `Result: ${a.result_status}` : undefined,
      });
    }

    return events;
  },
};

function mapApplicationMethod(
  applicationType: string | null
): 'spray_applied' | 'fertigation' | 'drench' | 'other' {
  const t = (applicationType ?? '').toLowerCase();
  if (/drench|root/i.test(t)) return 'drench';
  if (/fertig/i.test(t)) return 'fertigation';
  if (/spray|foliar/i.test(t)) return 'spray_applied';
  return 'spray_applied';
}

async function conversationPatchPending(
  farmerId: string,
  recommendationRecordId: string,
  phase: 'application' | 'outcome' | 'compliance'
): Promise<void> {
  const { data } = await supabase
    .from('conversation_sessions')
    .select('context')
    .eq('farmer_id', farmerId)
    .eq('channel', 'whatsapp')
    .maybeSingle();

  const ctx = (data?.context ?? {}) as Record<string, unknown>;
  await supabase
    .from('conversation_sessions')
    .update({
      context: {
        ...ctx,
        pendingRecommendationRecordId: recommendationRecordId,
        pendingRecommendationFollowUp: phase,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('farmer_id', farmerId)
    .eq('channel', 'whatsapp');
}

async function clearConversationPending(farmerId: string): Promise<void> {
  const { data } = await supabase
    .from('conversation_sessions')
    .select('context')
    .eq('farmer_id', farmerId)
    .eq('channel', 'whatsapp')
    .maybeSingle();

  const ctx = { ...((data?.context ?? {}) as Record<string, unknown>) };
  delete ctx.pendingRecommendationRecordId;
  delete ctx.pendingRecommendationFollowUp;

  await supabase
    .from('conversation_sessions')
    .update({ context: ctx, updated_at: new Date().toISOString() })
    .eq('farmer_id', farmerId)
    .eq('channel', 'whatsapp');
}
