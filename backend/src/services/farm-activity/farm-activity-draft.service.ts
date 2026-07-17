import {
  validateFarmActivityAssistantDraft,
  type FarmActivityAssistantDraftV1,
  type FarmActivityAssistantField,
  type FarmActivityAssistantSubEvent,
} from '@morbeez/shared/farm-activity-assistant';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';

export type FarmActivityDraftStatus =
  | 'open'
  | 'clarifying'
  | 'awaiting_confirm'
  | 'confirmed'
  | 'cancelled'
  | 'expired'
  | 'superseded';

export type FarmActivityDraftRow = {
  id: string;
  farmer_id: string;
  conversation_session_id: string | null;
  channel: string;
  status: FarmActivityDraftStatus;
  revision: number;
  contract_version: string;
  draft_json: FarmActivityAssistantDraftV1;
  field_confidence: Record<string, unknown>;
  unresolved_fields: unknown[];
  source_message_ids: string[];
  source_provider: string;
  primary_message_id: string | null;
  transcript: string | null;
  detected_language: string | null;
  preferred_language_hint: string | null;
  input_modalities: string[];
  metadata: Record<string, unknown>;
};

function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || (/farm_activity_drafts/i.test(message) && /does not exist|Could not find the table/i.test(message));
}

function collectFields(event: FarmActivityAssistantSubEvent): Array<[string, FarmActivityAssistantField<unknown>]> {
  return Object.entries(event)
    .filter(([key, value]) =>
      !['id', 'kind', 'sequence', 'sourceRefs'].includes(key)
      && value
      && typeof value === 'object'
      && 'value' in (value as object))
    .map(([key, value]) => [key, value as FarmActivityAssistantField<unknown>]);
}

export function summarizeDraftFieldConfidence(draft: FarmActivityAssistantDraftV1): {
  fieldConfidence: Record<string, unknown>;
  unresolvedFields: unknown[];
} {
  const fieldConfidence: Record<string, unknown> = {};
  const unresolvedFields: unknown[] = [];
  for (const event of draft.subEvents) {
    for (const [field, extracted] of collectFields(event)) {
      const path = `${event.id}.${field}`;
      fieldConfidence[path] = {
        confidence: extracted.confidence,
        provenance: extracted.provenance,
        sourceRefs: extracted.sourceRefs,
        resolved: extracted.value !== null,
      };
      if (extracted.value === null && extracted.unresolved) {
        unresolvedFields.push({
          subEventId: event.id,
          field,
          reason: extracted.unresolved.reason,
          detail: extracted.unresolved.detail,
        });
      }
    }
  }
  return { fieldConfidence, unresolvedFields };
}

export function resolveDraftStatus(draft: FarmActivityAssistantDraftV1): FarmActivityDraftStatus {
  if (draft.clarifications.length > 0) return 'clarifying';
  if (draft.subEvents.length === 0) return 'open';
  const hasUnresolved = draft.subEvents.some((event) =>
    collectFields(event).some(([, field]) => field.value === null));
  return hasUnresolved ? 'open' : 'awaiting_confirm';
}

function modalitiesFromDraft(draft: FarmActivityAssistantDraftV1): string[] {
  const modalities = new Set<string>();
  if (draft.source.text) modalities.add('text');
  if (draft.source.transcript.length) modalities.add('voice');
  for (const media of draft.source.media) modalities.add(media.kind);
  return [...modalities];
}

export const farmActivityDraftService = {
  schemaAvailable: null as boolean | null,

  async isSchemaAvailable(): Promise<boolean> {
    if (this.schemaAvailable != null) return this.schemaAvailable;
    const { error } = await supabase.from('farm_activity_drafts').select('id').limit(1);
    if (!error) {
      this.schemaAvailable = true;
      return true;
    }
    if (isMissingRelation(error)) {
      this.schemaAvailable = false;
      return false;
    }
    // Unexpected errors should not permanently disable persistence.
    logger.warn({ err: error }, 'farm_activity_drafts availability probe failed');
    return false;
  },

  async getById(draftId: string): Promise<FarmActivityDraftRow | null> {
    if (!(await this.isSchemaAvailable())) return null;
    const { data, error } = await supabase
      .from('farm_activity_drafts')
      .select('*')
      .eq('id', draftId)
      .maybeSingle();
    if (isMissingRelation(error)) {
      this.schemaAvailable = false;
      return null;
    }
    if (error) {
      logger.warn({ err: error, draftId }, 'Could not load farm activity draft');
      return null;
    }
    return data as FarmActivityDraftRow | null;
  },

  async getActiveForFarmer(farmerId: string, channel = 'whatsapp'): Promise<FarmActivityDraftRow | null> {
    if (!(await this.isSchemaAvailable())) return null;
    const { data, error } = await supabase
      .from('farm_activity_drafts')
      .select('*')
      .eq('farmer_id', farmerId)
      .eq('channel', channel)
      .in('status', ['open', 'clarifying', 'awaiting_confirm'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (isMissingRelation(error)) {
      this.schemaAvailable = false;
      return null;
    }
    if (error) {
      logger.warn({ err: error, farmerId }, 'Could not load active farm activity draft');
      return null;
    }
    return data as FarmActivityDraftRow | null;
  },

  async persistExtraction(input: {
    farmerId: string;
    conversationSessionId?: string | null;
    preferredLanguageHint?: string | null;
    detectedLanguage: string;
    codeMixed: boolean;
    clarificationAttempts: number;
    draft: FarmActivityAssistantDraftV1;
    transcript?: string | null;
  }): Promise<FarmActivityDraftRow | null> {
    if (!(await this.isSchemaAvailable())) return null;

    const validated = validateFarmActivityAssistantDraft(input.draft);
    if (!validated.ok) {
      logger.warn({ errors: validated.errors }, 'Skipping farm activity draft persistence for invalid draft');
      return null;
    }

    const draft = validated.value;
    const { fieldConfidence, unresolvedFields } = summarizeDraftFieldConfidence(draft);
    const status = resolveDraftStatus(draft);
    const now = new Date().toISOString();
    const ttlMinutes = Math.max(5, Number(env.FARM_ACTIVITY_DRAFT_TTL_MINUTES ?? 60));
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
    const payload = {
      id: draft.draftId,
      farmer_id: input.farmerId,
      conversation_session_id: input.conversationSessionId ?? null,
      channel: draft.source.channel,
      status,
      revision: Math.max(1, draft.revision),
      contract_version: draft.contractVersion,
      draft_json: draft,
      field_confidence: fieldConfidence,
      unresolved_fields: unresolvedFields,
      source_message_ids: [draft.source.messageId],
      source_provider: draft.source.channel,
      primary_message_id: draft.source.messageId,
      transcript: input.transcript ?? (draft.source.transcript.map((item) => item.text).join(' ') || null),
      detected_language: input.detectedLanguage,
      preferred_language_hint: input.preferredLanguageHint ?? null,
      input_modalities: modalitiesFromDraft(draft),
      expires_at: expiresAt,
      metadata: {
        codeMixed: input.codeMixed,
        clarificationAttempts: input.clarificationAttempts,
      },
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('farm_activity_drafts')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .maybeSingle();

    if (isMissingRelation(error)) {
      this.schemaAvailable = false;
      return null;
    }
    if (error) {
      logger.warn({ err: error, draftId: draft.draftId }, 'Could not persist farm activity draft');
      return null;
    }

    await supabase.from('farm_activity_draft_events').insert({
      draft_id: draft.draftId,
      event_type: draft.clarifications.length ? 'clarification_asked' : 'extracted',
      revision: Math.max(1, draft.revision),
      actor: 'system:farm-activity-extraction',
      payload: {
        clarificationCount: draft.clarifications.length,
        subEventCount: draft.subEvents.length,
        codeMixed: input.codeMixed,
      },
      source_message_id: draft.source.messageId,
    });

    return data as FarmActivityDraftRow;
  },

  async appendEvent(input: {
    draftId: string;
    eventType: string;
    revision: number;
    actor: string;
    payload?: Record<string, unknown>;
    sourceMessageId?: string | null;
  }): Promise<void> {
    if (!(await this.isSchemaAvailable())) return;
    await supabase.from('farm_activity_draft_events').insert({
      draft_id: input.draftId,
      event_type: input.eventType,
      revision: input.revision,
      actor: input.actor,
      payload: input.payload ?? {},
      source_message_id: input.sourceMessageId ?? null,
    });
  },

  async markCancelled(input: {
    draftId: string;
    revision: number;
    reason?: string;
    actor?: string;
  }): Promise<FarmActivityDraftRow | null> {
    if (!(await this.isSchemaAvailable())) return null;
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('farm_activity_drafts')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        cancel_reason: input.reason ?? 'farmer_cancelled',
        updated_at: now,
      })
      .eq('id', input.draftId)
      .eq('revision', input.revision)
      .in('status', ['open', 'clarifying', 'awaiting_confirm'])
      .select('*')
      .maybeSingle();
    if (error) {
      logger.warn({ err: error, draftId: input.draftId }, 'Could not cancel farm activity draft');
      return null;
    }
    if (data) {
      await this.appendEvent({
        draftId: input.draftId,
        eventType: 'cancelled',
        revision: input.revision,
        actor: input.actor ?? 'whatsapp:farmer',
        payload: { reason: input.reason ?? 'farmer_cancelled' },
      });
    }
    return data as FarmActivityDraftRow | null;
  },

  async markConfirmed(input: {
    draftId: string;
    revision: number;
    commandId: string;
    activityIds: string[];
    roiEntryIds: string[];
    harvestIds: string[];
    actor?: string;
  }): Promise<FarmActivityDraftRow | null> {
    if (!(await this.isSchemaAvailable())) return null;
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('farm_activity_drafts')
      .update({
        status: 'confirmed',
        confirmed_at: now,
        commit_command_id: input.commandId,
        committed_activity_ids: input.activityIds,
        committed_roi_entry_ids: input.roiEntryIds,
        committed_harvest_ids: input.harvestIds,
        updated_at: now,
      })
      .eq('id', input.draftId)
      .eq('revision', input.revision)
      .select('*')
      .maybeSingle();
    if (error) {
      logger.warn({ err: error, draftId: input.draftId }, 'Could not mark farm activity draft confirmed');
      return null;
    }
    if (data) {
      await this.appendEvent({
        draftId: input.draftId,
        eventType: 'confirmed',
        revision: input.revision,
        actor: input.actor ?? 'whatsapp:farmer',
        payload: {
          commandId: input.commandId,
          activityIds: input.activityIds,
          roiEntryIds: input.roiEntryIds,
          harvestIds: input.harvestIds,
        },
      });
    }
    return data as FarmActivityDraftRow | null;
  },
};
