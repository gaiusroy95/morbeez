import { createHash } from 'node:crypto';
import type { FarmActivityAssistantDraftV1, FarmActivityAssistantSubEvent } from '@morbeez/shared/farm-activity-assistant';
import { env } from '../../config/env.js';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import { whatsappOsAdminService } from '../admin/whatsapp-os-admin.service.js';
import { cropSeasonService } from '../farmer/crop-season.service.js';
import { roiFlowService } from '../whatsapp/roi/roi-flow.service.js';
import { farmActivityDraftService } from './farm-activity-draft.service.js';

export type FarmActivityCommitResult = {
  draftId: string;
  revision: number;
  commandId: string;
  activityIds: string[];
  roiEntryIds: string[];
  harvestIds: string[];
};

function requestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? {})).digest('hex');
}

function fieldValue<T>(field: { value: T | null } | undefined): T | null {
  return field?.value ?? null;
}

function moneyAmount(field: { value: { amount: number; currency: string } | null } | undefined): number | null {
  const value = fieldValue(field);
  return value && Number.isFinite(value.amount) ? Number(value.amount) : null;
}

function mapActivityType(label: string | null): 'spray_applied' | 'fertigation' | 'drench' | 'scouting' | 'other' {
  const text = (label ?? '').toLowerCase();
  if (/spray|pesticide|fungicide|insecticide/.test(text)) return 'spray_applied';
  if (/fertigat|fertiliz|nutrition|manure|urea/.test(text)) return 'fertigation';
  if (/drench/.test(text)) return 'drench';
  if (/scout|inspect|observe|monitor/.test(text)) return 'scouting';
  return 'other';
}

function buildProvenance(draft: FarmActivityAssistantDraftV1, modality: string) {
  return {
    sourceChannel: 'whatsapp',
    inputModality: modality,
    messageId: draft.source.messageId,
    language: draft.source.language.code,
    transcript: draft.source.transcript.map((item) => item.text).join(' ').trim() || null,
    sourceText: draft.source.text ?? null,
    draftId: draft.draftId,
    revision: draft.revision,
  };
}

async function resolveBlockId(
  farmerId: string,
  blockRef: string | null,
  fallbackBlockId?: string | null
): Promise<string | null> {
  if (fallbackBlockId) return fallbackBlockId;
  if (!blockRef) return null;
  const needle = blockRef.trim().toLowerCase();
  if (/^[0-9a-f-]{36}$/i.test(needle)) {
    const { data } = await supabase
      .from('farm_blocks')
      .select('id')
      .eq('id', needle)
      .eq('farmer_id', farmerId)
      .is('archived_at', null)
      .maybeSingle();
    return data?.id ? String(data.id) : null;
  }
  const { data: blocks } = await supabase
    .from('farm_blocks')
    .select('id, name, plot_label')
    .eq('farmer_id', farmerId)
    .is('archived_at', null);
  const match = (blocks ?? []).find((block) => {
    const names = [block.name, block.plot_label].filter(Boolean).map((v) => String(v).trim().toLowerCase());
    return names.includes(needle);
  });
  return match?.id ? String(match.id) : null;
}

export const farmActivityCommitService = {
  enabled(): boolean {
    return env.ENABLE_FARM_ACTIVITY_ASSISTANT === true;
  },

  async commitDraft(input: {
    farmerId: string;
    draftId: string;
    expectedRevision: number;
    actor?: string;
    fallbackBlockId?: string | null;
  }): Promise<FarmActivityCommitResult> {
    if (!this.enabled()) {
      throw new ValidationError('Farm Activity Assistant is disabled');
    }

    const draftRow = await farmActivityDraftService.getById(input.draftId);
    if (!draftRow || draftRow.farmer_id !== input.farmerId) {
      throw new NotFoundError('Farm activity draft not found');
    }
    if (draftRow.revision !== input.expectedRevision) {
      throw new ConflictError('stale_draft_revision');
    }
    if (!['awaiting_confirm', 'open', 'clarifying', 'confirmed'].includes(draftRow.status)) {
      throw new ConflictError('draft_not_confirmable');
    }

    const draft = draftRow.draft_json;
    const actor = input.actor ?? 'whatsapp:farmer';
    const idempotencyKey = `farm_activity:${draft.draftId}:r${draft.revision}`;
    const hash = requestHash({
      draftId: draft.draftId,
      revision: draft.revision,
      subEvents: draft.subEvents,
    });

    const { data: beginData, error: beginError } = await supabase.rpc('farm_activity_commit_draft', {
      p_draft_id: draft.draftId,
      p_idempotency_key: idempotencyKey,
      p_request_hash: hash,
      p_expected_revision: draft.revision,
      p_actor: actor,
    });
    if (beginError) {
      logger.error({ err: beginError, draftId: draft.draftId }, 'farm_activity_commit_draft failed');
      throw new ConflictError(beginError.message || 'commit_begin_failed');
    }

    const begin = (beginData ?? {}) as {
      commit_command_id?: string;
      activity_ids?: string[];
      roi_entry_ids?: string[];
      harvest_ids?: string[];
      status?: string;
    };

    if (
      begin.status === 'confirmed'
      && Array.isArray(begin.activity_ids)
      && begin.commit_command_id
    ) {
      return {
        draftId: draft.draftId,
        revision: draft.revision,
        commandId: String(begin.commit_command_id),
        activityIds: begin.activity_ids.map(String),
        roiEntryIds: (begin.roi_entry_ids ?? []).map(String),
        harvestIds: (begin.harvest_ids ?? []).map(String),
      };
    }

    const commandId = String(begin.commit_command_id ?? '');
    if (!commandId) {
      throw new ConflictError('commit_command_missing');
    }

    // Replay if draft already confirmed for this command.
    if (draftRow.status === 'confirmed' && draftRow.metadata) {
      const existing = await farmActivityDraftService.getById(draft.draftId);
      if (existing?.status === 'confirmed') {
        return {
          draftId: draft.draftId,
          revision: draft.revision,
          commandId,
          activityIds: ((existing as { committed_activity_ids?: string[] }).committed_activity_ids ?? []).map(String),
          roiEntryIds: ((existing as { committed_roi_entry_ids?: string[] }).committed_roi_entry_ids ?? []).map(String),
          harvestIds: ((existing as { committed_harvest_ids?: string[] }).committed_harvest_ids ?? []).map(String),
        };
      }
    }

    const modality = draft.source.transcript.length
      ? 'voice'
      : draft.source.media.some((m) => m.kind === 'document' || m.kind === 'image')
        ? 'invoice'
        : 'text';
    const provenance = buildProvenance(draft, modality);

    const activityIds: string[] = [];
    const roiEntryIds: string[] = [];
    const harvestIds: string[] = [];

    try {
      for (const event of draft.subEvents) {
        const written = await this.writeSubEvent({
          farmerId: input.farmerId,
          draft,
          event,
          commandId,
          provenance,
          fallbackBlockId: input.fallbackBlockId ?? null,
        });
        activityIds.push(...written.activityIds);
        roiEntryIds.push(...written.roiEntryIds);
        harvestIds.push(...written.harvestIds);
      }

      await farmActivityDraftService.markConfirmed({
        draftId: draft.draftId,
        revision: draft.revision,
        commandId,
        activityIds,
        roiEntryIds,
        harvestIds,
        actor,
      });

      const response = {
        draft_id: draft.draftId,
        revision: draft.revision,
        status: 'confirmed',
        commit_command_id: commandId,
        activity_ids: activityIds,
        roi_entry_ids: roiEntryIds,
        harvest_ids: harvestIds,
        ledger_writes: 'completed',
      };

      await supabase
        .from('operation_commands')
        .update({
          status: 'succeeded',
          response_json: response,
          updated_at: new Date().toISOString(),
        })
        .eq('id', commandId);

      return {
        draftId: draft.draftId,
        revision: draft.revision,
        commandId,
        activityIds,
        roiEntryIds,
        harvestIds,
      };
    } catch (err) {
      logger.error({ err, draftId: draft.draftId, commandId }, 'Farm activity commit ledger write failed');
      await supabase
        .from('operation_commands')
        .update({
          status: 'failed',
          error_json: { message: err instanceof Error ? err.message : String(err) },
          updated_at: new Date().toISOString(),
        })
        .eq('id', commandId);
      throw err;
    }
  },

  async writeSubEvent(input: {
    farmerId: string;
    draft: FarmActivityAssistantDraftV1;
    event: FarmActivityAssistantSubEvent;
    commandId: string;
    provenance: Record<string, unknown>;
    fallbackBlockId: string | null;
  }): Promise<{ activityIds: string[]; roiEntryIds: string[]; harvestIds: string[] }> {
    const { farmerId, draft, event, commandId, provenance, fallbackBlockId } = input;
    const activityIds: string[] = [];
    const roiEntryIds: string[] = [];
    const harvestIds: string[] = [];

    if (event.kind === 'activity') {
      const blockId = await resolveBlockId(
        farmerId,
        fieldValue(event.blockRef),
        fallbackBlockId
      );
      if (!blockId) {
        throw new ValidationError('Block is required before confirming an activity');
      }
      const activityLabel = fieldValue(event.activityType) ?? fieldValue(event.description) ?? 'Field activity';
      const occurredOn = fieldValue(event.occurredOn) ?? new Date().toISOString().slice(0, 10);
      const notes = [
        fieldValue(event.description),
        fieldValue(event.quantity) != null
          ? `Qty: ${fieldValue(event.quantity)} ${fieldValue(event.unit) ?? ''}`.trim()
          : null,
      ].filter(Boolean).join(' · ');

      const activity = await whatsappOsAdminService.createFieldActivity({
        blockId,
        activityType: mapActivityType(activityLabel),
        activityLabel,
        activityDate: occurredOn,
        notes: notes || undefined,
        source: 'whatsapp',
        status: 'completed',
      });

      await supabase
        .from('cultivation_activities')
        .update({
          farm_activity_draft_id: draft.draftId,
          farm_activity_draft_revision: draft.revision,
          source_command_id: commandId,
          input_modality: provenance.inputModality,
          provenance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activity.id);

      activityIds.push(String(activity.id));
      return { activityIds, roiEntryIds, harvestIds };
    }

    if (event.kind === 'labour' || event.kind === 'purchase' || event.kind === 'expense') {
      const amount =
        event.kind === 'labour'
          ? moneyAmount(event.totalCost) ?? moneyAmount(event.rate)
          : event.kind === 'purchase'
            ? moneyAmount(event.totalCost) ?? moneyAmount(event.unitPrice)
            : moneyAmount(event.amount);
      if (amount == null || amount <= 0) {
        throw new ValidationError(`Amount is required to confirm ${event.kind}`);
      }

      const occurredOn =
        fieldValue(event.occurredOn) ?? new Date().toISOString().slice(0, 10);
      const blockId = await resolveBlockId(
        farmerId,
        event.kind === 'purchase' || event.kind === 'labour' ? null : null,
        fallbackBlockId
      );

      const entryType =
        event.kind === 'labour' ? 'labour' : event.kind === 'purchase' ? 'purchase' : 'misc';
      const comments =
        event.kind === 'labour'
          ? [fieldValue(event.workType), fieldValue(event.workerCount) != null ? `${fieldValue(event.workerCount)} workers` : null]
              .filter(Boolean).join(' · ')
          : event.kind === 'purchase'
            ? [fieldValue(event.itemName), fieldValue(event.vendorName)].filter(Boolean).join(' · ')
            : [fieldValue(event.category), fieldValue(event.description), fieldValue(event.paidTo)]
                .filter(Boolean).join(' · ');

      const roiEntryId = await roiFlowService.recordEntry({
        farmerId,
        entryType,
        amount,
        entryDate: occurredOn,
        comments: comments || `WhatsApp ${event.kind}`,
        blockId: blockId ?? undefined,
      });

      await supabase
        .from('farmer_roi_entries')
        .update({
          farm_activity_draft_id: draft.draftId,
          farm_activity_draft_revision: draft.revision,
          source_command_id: commandId,
          input_modality: provenance.inputModality,
          provenance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', roiEntryId);

      roiEntryIds.push(roiEntryId);
      return { activityIds, roiEntryIds, harvestIds };
    }

    if (event.kind === 'harvest') {
      const quantity = fieldValue(event.quantity);
      const saleAmount = moneyAmount(event.saleAmount);
      const occurredOn = fieldValue(event.occurredOn) ?? new Date().toISOString().slice(0, 10);
      const blockId = await resolveBlockId(farmerId, fieldValue(event.blockRef), fallbackBlockId);

      if (quantity != null && quantity > 0 && saleAmount != null && saleAmount > 0) {
        const pricePerKg = saleAmount / quantity;
        const recorded = await cropSeasonService.recordHarvestSale(farmerId, {
          blockId: blockId ?? undefined,
          harvestDate: occurredOn,
          yieldKg: quantity,
          sellingPricePerKg: pricePerKg,
          buyer: fieldValue(event.buyerName) ?? undefined,
        });

        if (recorded.entryId) {
          await supabase
            .from('farmer_roi_entries')
            .update({
              farm_activity_draft_id: draft.draftId,
              farm_activity_draft_revision: draft.revision,
              source_command_id: commandId,
              input_modality: provenance.inputModality,
              provenance,
              updated_at: new Date().toISOString(),
            })
            .eq('id', recorded.entryId);
          roiEntryIds.push(String(recorded.entryId));
        }

        const { data: harvestRow } = await supabase
          .from('harvest_records')
          .select('id')
          .eq('roi_entry_id', recorded.entryId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (harvestRow?.id) {
          await supabase
            .from('harvest_records')
            .update({
              farm_activity_draft_id: draft.draftId,
              farm_activity_draft_revision: draft.revision,
              source_command_id: commandId,
              provenance,
              updated_at: new Date().toISOString(),
            })
            .eq('id', harvestRow.id);
          harvestIds.push(String(harvestRow.id));
        }
        return { activityIds, roiEntryIds, harvestIds };
      }

      if (saleAmount != null && saleAmount > 0) {
        // Income without inventing a 1 kg harvest row.
        const roiEntryId = await roiFlowService.recordEntry({
          farmerId,
          entryType: 'income',
          amount: saleAmount,
          entryDate: occurredOn,
          comments: [
            fieldValue(event.cropName),
            fieldValue(event.buyerName),
            quantity != null ? `${quantity} ${fieldValue(event.unit) ?? ''}`.trim() : null,
          ].filter(Boolean).join(' · ') || 'Harvest income',
          blockId: blockId ?? undefined,
          incomeSubtype: 'other',
        });
        await supabase
          .from('farmer_roi_entries')
          .update({
            farm_activity_draft_id: draft.draftId,
            farm_activity_draft_revision: draft.revision,
            source_command_id: commandId,
            input_modality: provenance.inputModality,
            provenance,
            updated_at: new Date().toISOString(),
          })
          .eq('id', roiEntryId);
        roiEntryIds.push(roiEntryId);
        return { activityIds, roiEntryIds, harvestIds };
      }

      throw new ValidationError('Harvest confirmation needs quantity+price or sale amount');
    }

    if (event.kind === 'inventory_movement') {
      if (!env.ENABLE_FARM_ACTIVITY_INVENTORY_SYNC) {
        logger.info({ draftId: draft.draftId, eventId: event.id }, 'Skipping inventory movement (flag off)');
        return { activityIds, roiEntryIds, harvestIds };
      }
      throw new ValidationError('Inventory sync commit is not enabled in this phase');
    }

    return { activityIds, roiEntryIds, harvestIds };
  },
};
