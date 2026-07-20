import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import { whatsappService } from '../whatsapp/whatsapp.service.js';
import { farmerReplyPolishService } from '../whatsapp/pipeline/farmer-reply-polish.service.js';
import { expertCaseOwnershipService } from './expert-case-ownership.service.js';
import { expertCaseQueueService } from './expert-case-queue.service.js';
import { toAdvisoryLanguage } from './expert-case-copilot-i18n.js';
import type { AdvisoryLanguage } from '../ai/types.js';

const INTERVAL_MS = 30_000;
const COMMUNICATION_MAX_ATTEMPTS = 5;

function communicationText(payload: Record<string, unknown>): string {
  const diagnosis = String(payload.diagnosis ?? '').trim();
  const recommendation = String(payload.recommendationText ?? '').trim();
  const treatment = String(payload.treatmentProduct ?? '').trim();
  const dosage = String(payload.dosage ?? '').trim();
  const method = String(payload.applicationMethod ?? '').trim();
  const timing = String(payload.applicationTiming ?? '').trim();
  const nutrition = [payload.nutritionProduct, payload.nutritionDose]
    .filter(Boolean)
    .map(String)
    .join(' · ');
  const precautions = Array.isArray(payload.precautions)
    ? (payload.precautions as string[]).filter(Boolean).join('; ')
    : '';
  const cultural = Array.isArray(payload.culturalPractices)
    ? (payload.culturalPractices as string[]).filter(Boolean).join('; ')
    : '';
  const followUp = payload.followUpDays != null ? `Follow-up in ${payload.followUpDays} days. Please send fresh photos.` : '';
  return [
    diagnosis ? `Expert review: ${diagnosis}` : 'Expert recommendation',
    treatment || recommendation,
    dosage ? `Dosage: ${dosage}` : '',
    method || timing ? `Apply: ${[method, timing].filter(Boolean).join(' · ')}` : '',
    nutrition ? `Nutrition: ${nutrition}` : '',
    cultural ? `Field practice: ${cultural}` : '',
    precautions ? `Caution: ${precautions}` : '',
    followUp,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 4000);
}

export class ExpertCopilotWorker {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer || env.NODE_ENV === 'test') return;
    if (
      !env.ENABLE_EXPERT_COPILOT_LEASE_REAPER &&
      !env.ENABLE_EXPERT_COPILOT_AUTO_ASSIGN &&
      !env.ENABLE_RECOMMENDATION_COMMUNICATION_OUTBOX
    ) {
      return;
    }
    this.timer = setInterval(() => void this.runCycle(), INTERVAL_MS);
    void this.runCycle();
    logger.info({ intervalMs: INTERVAL_MS }, 'Expert Copilot worker started');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runCycle(): Promise<void> {
    try {
      await expertCaseOwnershipService.reaperExpiredLeases();
      await this.reconcileCapacity();
      await this.restoreCapacityQueue();
      await expertCaseQueueService.autoAssignBatch();
      await this.processCommunicationIntents();
    } catch (err) {
      logger.error({ err }, 'Expert Copilot worker cycle failed');
    }
  }

  async reconcileCapacity(): Promise<number> {
    if (!env.ENABLE_EXPERT_CASE_OWNERSHIP) return 0;
    const { data: capacities } = await supabase.from('expert_capacity_state').select('*');
    let reconciled = 0;
    for (const capacity of capacities ?? []) {
      const email = String(capacity.employee_email).toLowerCase();
      const { data: cases } = await supabase
        .from('expert_cases')
        .select('queue_weight')
        .eq('owner_email', email)
        .eq('review_flag', 'open');
      const count = cases?.length ?? 0;
      const weight = (cases ?? []).reduce((sum, row) => sum + Number(row.queue_weight ?? 1), 0);
      if (
        count !== Number(capacity.active_case_count) ||
        weight !== Number(capacity.active_weight)
      ) {
        await supabase
          .from('expert_capacity_state')
          .update({
            active_case_count: count,
            active_weight: weight,
            version: Number(capacity.version ?? 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('employee_profile_id', capacity.employee_profile_id);
        reconciled += 1;
      }
    }
    return reconciled;
  }

  async restoreCapacityQueue(): Promise<number> {
    if (!expertCaseQueueService.enabled()) return 0;
    const { data: capacity } = await supabase
      .from('expert_capacity_state')
      .select('employee_profile_id')
      .eq('availability', 'accepting')
      .limit(1);
    if (!capacity?.length) return 0;
    const { data } = await supabase
      .from('expert_cases')
      .update({
        status: 'intake',
        review_flag: 'open',
        assignment_status: 'queued',
        updated_at: new Date().toISOString(),
      })
      .eq('review_flag', 'awaiting_capacity')
      .select('id');
    return data?.length ?? 0;
  }

  async processCommunicationIntents(limit = 10): Promise<number> {
    if (!env.ENABLE_RECOMMENDATION_COMMUNICATION_OUTBOX) return 0;
    const { data: intents } = await supabase
      .from('communication_intents')
      .select('*')
      .in('status', ['queued', 'failed'])
      .order('created_at', { ascending: true })
      .limit(limit);

    let processed = 0;
    for (const intent of intents ?? []) {
      const { data: attempts } = await supabase
        .from('communication_attempts')
        .select('attempt_number')
        .eq('intent_id', intent.id)
        .order('attempt_number', { ascending: false })
        .limit(1);
      const attemptNumber = Number(attempts?.[0]?.attempt_number ?? 0) + 1;
      if (attemptNumber > COMMUNICATION_MAX_ATTEMPTS) continue;

      const lockId = randomUUID();
      const { data: claimed } = await supabase
        .from('communication_intents')
        .update({ status: 'sending', updated_at: new Date().toISOString() })
        .eq('id', intent.id)
        .in('status', ['queued', 'failed'])
        .select('id')
        .maybeSingle();
      if (!claimed) continue;

      const providerKey = `expert-intent:${intent.id}:v${intent.content_version}`;
      try {
        const recipient =
          (intent.recipient_snapshot as {
            farmerId?: string;
            phone?: string;
            language?: string;
          }) ?? {};
        let phone = recipient.phone?.trim() ?? '';
        let language: AdvisoryLanguage = toAdvisoryLanguage(
          (intent.payload as { language?: string } | null)?.language ?? recipient.language
        );
        if (!phone && recipient.farmerId) {
          const { data: farmer } = await supabase
            .from('farmers')
            .select('phone, preferred_language')
            .eq('id', recipient.farmerId)
            .maybeSingle();
          phone = String(farmer?.phone ?? '').trim();
          if (farmer?.preferred_language) {
            language = toAdvisoryLanguage(String(farmer.preferred_language));
          }
        }
        if (!phone) throw new Error('recipient_phone_missing');

        const draftText = communicationText((intent.payload as Record<string, unknown>) ?? {});
        const localized =
          language === 'en'
            ? draftText
            : await farmerReplyPolishService.polish({
                factualDraft: draftText,
                language,
                task: 'agronomy',
                lockedFacts: draftText,
              });

        await whatsappService.sendText(phone, localized);
        await supabase.from('communication_attempts').insert({
          intent_id: intent.id,
          attempt_number: attemptNumber,
          provider_idempotency_key: providerKey,
          provider_message_id: lockId,
        });
        await supabase
          .from('communication_intents')
          .update({ status: 'sent', updated_at: new Date().toISOString() })
          .eq('id', intent.id);
        processed += 1;
      } catch (err) {
        await supabase.from('communication_attempts').insert({
          intent_id: intent.id,
          attempt_number: attemptNumber,
          provider_idempotency_key: providerKey,
          error_text: err instanceof Error ? err.message : String(err),
        });
        await supabase
          .from('communication_intents')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', intent.id);
      }
    }
    return processed;
  }
}

export const expertCopilotWorker = new ExpertCopilotWorker();

export function startExpertCopilotWorker(): void {
  expertCopilotWorker.start();
}
