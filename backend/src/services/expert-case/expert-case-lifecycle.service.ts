import { createHash, randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import { blockService } from '../core/block.service.js';
import {
  buildExpertCaseKey,
  normalizeIssueFingerprint,
  priorityTierFromPriority,
  queueWeightForPriority,
  slaMinutesForPriority,
  type ExpertCaseLinkType,
  type ExpertCaseRevisionSource,
} from '../../domain/expert-case/types.js';

export type EnsureExpertCaseInput = {
  farmerId: string;
  sessionId?: string | null;
  escalationId?: string | null;
  blockId?: string | null;
  cropType?: string | null;
  issueLabel?: string | null;
  reason?: string | null;
  priority?: string | null;
  confidence?: number | null;
  reasonCodes?: string[];
  actorEmail?: string | null;
  source?: ExpertCaseRevisionSource;
  payload?: Record<string, unknown>;
};

function addMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export const expertCaseLifecycleService = {
  enabled(): boolean {
    return env.ENABLE_EXPERT_CASES === true;
  },

  dedupeEnabled(): boolean {
    return this.enabled() && env.ENABLE_EXPERT_CASE_DEDUPE === true;
  },

  recurrenceEnabled(): boolean {
    return this.enabled() && env.ENABLE_EXPERT_CASE_RECURRENCE === true;
  },

  async ensureFromAdvisory(input: EnsureExpertCaseInput): Promise<{
    caseId: string;
    created: boolean;
    merged: boolean;
  } | null> {
    if (!this.enabled()) return null;

    try {
      const blockId =
        input.blockId ??
        (await blockService.getPrimaryBlock(input.farmerId).then((b) => b?.id ?? null));
      const fingerprint = normalizeIssueFingerprint(
        input.issueLabel ?? input.reason?.replace(/^Advisory review:\s*/i, '') ?? null
      );
      const priority = input.priority ?? 'normal';
      const caseKey = buildExpertCaseKey({
        farmerId: input.farmerId,
        blockId,
        fingerprint,
      });

      if (this.dedupeEnabled()) {
        const open = await this.findOpenCase({
          farmerId: input.farmerId,
          blockId,
          fingerprint,
        });
        if (open) {
          await this.appendRevision({
            caseId: open.id,
            source: input.source ?? 'advisory_session',
            createdBy: input.actorEmail ?? 'system',
            payload: {
              sessionId: input.sessionId,
              escalationId: input.escalationId,
              reason: input.reason,
              ...(input.payload ?? {}),
            },
          });
          if (input.escalationId) {
            await this.linkArtifact({
              caseId: open.id,
              linkType: 'escalation',
              entityId: input.escalationId,
              isPrimary: false,
            });
            await supabase
              .from('agronomist_escalations')
              .update({
                expert_case_id: open.id,
                expert_link_role: 'duplicate_merged',
              })
              .eq('id', input.escalationId);
          }
          if (input.sessionId) {
            await this.linkArtifact({
              caseId: open.id,
              linkType: 'advisory_session',
              entityId: input.sessionId,
            });
          }
          return { caseId: open.id, created: false, merged: true };
        }
      }

      if (this.recurrenceEnabled()) {
        const recentClosed = await this.findRecentClosedRecurrence({
          farmerId: input.farmerId,
          blockId,
          fingerprint,
        });
        if (recentClosed) {
          const previousGeneration = Number(
            String(recentClosed.case_key ?? '').match(/:g(\d+)$/)?.[1] ?? 1
          );
          const created = await this.createCase({
            ...input,
            blockId,
            fingerprint,
            caseKey: buildExpertCaseKey({
              farmerId: input.farmerId,
              blockId,
              fingerprint,
              generation: previousGeneration + 1,
            }),
            recurrenceOfCaseId: recentClosed.id,
            parentCaseId: recentClosed.id,
            priority,
          });
          return { caseId: created, created: true, merged: false };
        }
      }

      const caseId = await this.createCase({
        ...input,
        blockId,
        fingerprint,
        caseKey,
        priority,
      });
      return { caseId, created: true, merged: false };
    } catch (err) {
      logger.warn({ err, farmerId: input.farmerId }, 'Expert case ensure failed (non-blocking)');
      return null;
    }
  },

  async findOpenCase(params: {
    farmerId: string;
    blockId?: string | null;
    fingerprint: string;
  }): Promise<{ id: string; current_revision: number } | null> {
    let q = supabase
      .from('expert_cases')
      .select('id, current_revision')
      .eq('farmer_id', params.farmerId)
      .eq('open_fingerprint', params.fingerprint)
      .in('review_flag', ['open', 'awaiting_capacity'])
      .is('merged_into_case_id', null)
      .order('opened_at', { ascending: false })
      .limit(1);
    if (params.blockId) q = q.eq('block_id', params.blockId);
    else q = q.is('block_id', null);
    const { data } = await q.maybeSingle();
    return data ?? null;
  },

  async findRecentClosedRecurrence(params: {
    farmerId: string;
    blockId?: string | null;
    fingerprint: string;
  }): Promise<{ id: string; case_key: string } | null> {
    const since = new Date(
      Date.now() - env.EXPERT_CASE_RECURRENCE_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    let q = supabase
      .from('expert_cases')
      .select('id, case_key')
      .eq('farmer_id', params.farmerId)
      .eq('open_fingerprint', params.fingerprint)
      .eq('review_flag', 'closed')
      .gte('closed_at', since)
      .order('closed_at', { ascending: false })
      .limit(1);
    if (params.blockId) q = q.eq('block_id', params.blockId);
    const { data } = await q.maybeSingle();
    return data ?? null;
  },

  async createCase(params: EnsureExpertCaseInput & {
    blockId?: string | null;
    fingerprint: string;
    caseKey: string;
    priority: string;
    recurrenceOfCaseId?: string;
    parentCaseId?: string;
  }): Promise<string> {
    const slaMinutes = slaMinutesForPriority(params.priority);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('expert_cases')
      .insert({
        case_key: params.caseKey,
        farmer_id: params.farmerId,
        block_id: params.blockId ?? null,
        crop_type: params.cropType ?? null,
        primary_issue_label: params.issueLabel ?? params.reason?.slice(0, 200) ?? null,
        open_fingerprint: params.fingerprint,
        status: 'intake',
        review_flag: 'open',
        reason_codes: params.reasonCodes ?? [],
        priority_tier: priorityTierFromPriority(params.priority),
        priority: params.priority,
        priority_score: queueWeightForPriority(params.priority) * 100,
        sla_started_at: now,
        sla_due_at: addMinutes(slaMinutes),
        queue_weight: queueWeightForPriority(params.priority),
        confidence_at_open: params.confidence ?? null,
        recurrence_of_case_id: params.recurrenceOfCaseId ?? null,
        parent_case_id: params.parentCaseId ?? null,
        metadata: {
          reason: params.reason ?? null,
          sessionId: params.sessionId ?? null,
        },
      })
      .select('id')
      .single();
    if (error) throw error;
    const caseId = String(data.id);

    await this.appendRevision({
      caseId,
      source: params.source ?? 'advisory_session',
      createdBy: params.actorEmail ?? 'system',
      payload: {
        sessionId: params.sessionId,
        escalationId: params.escalationId,
        reason: params.reason,
        ...(params.payload ?? {}),
      },
      forceRevision: 1,
    });

    if (params.escalationId) {
      await this.linkArtifact({
        caseId,
        linkType: 'escalation',
        entityId: params.escalationId,
        isPrimary: true,
      });
      await supabase
        .from('agronomist_escalations')
        .update({
          expert_case_id: caseId,
          expert_link_role: 'primary_ingress',
        })
        .eq('id', params.escalationId);
    }
    if (params.sessionId) {
      await this.linkArtifact({
        caseId,
        linkType: 'advisory_session',
        entityId: params.sessionId,
        isPrimary: true,
      });
    }
    return caseId;
  },

  async appendRevision(params: {
    caseId: string;
    source: ExpertCaseRevisionSource;
    createdBy?: string;
    payload?: Record<string, unknown>;
    forceRevision?: number;
  }): Promise<number> {
    const { data: row } = await supabase
      .from('expert_cases')
      .select('current_revision')
      .eq('id', params.caseId)
      .maybeSingle();
    const nextRevision = params.forceRevision ?? Number(row?.current_revision ?? 0) + 1;

    await supabase.from('expert_case_revisions').insert({
      case_id: params.caseId,
      revision: nextRevision,
      source: params.source,
      payload: params.payload ?? {},
      created_by: params.createdBy ?? 'system',
    });

    await supabase
      .from('expert_cases')
      .update({
        current_revision: nextRevision,
        pending_draft_revision: nextRevision,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.caseId);

    // Supersede any pending draft on new evidence
    await supabase
      .from('expert_case_drafts')
      .update({ status: 'superseded', updated_at: new Date().toISOString() })
      .eq('case_id', params.caseId)
      .eq('status', 'pending');

    return nextRevision;
  },

  async linkArtifact(params: {
    caseId: string;
    linkType: ExpertCaseLinkType;
    entityId: string;
    isPrimary?: boolean;
    mergedFromCaseId?: string | null;
  }): Promise<void> {
    await supabase.from('expert_case_links').upsert(
      {
        case_id: params.caseId,
        link_type: params.linkType,
        entity_id: params.entityId,
        is_primary: params.isPrimary ?? false,
        merged_from_case_id: params.mergedFromCaseId ?? null,
      },
      { onConflict: 'link_type,entity_id' }
    );
  },

  async getById(caseId: string) {
    const { data, error } = await supabase
      .from('expert_cases')
      .select('*')
      .eq('id', caseId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async listOpen(params?: { limit?: number; ownerEmail?: string | null }) {
    let q = supabase
      .from('expert_cases')
      .select('*')
      .eq('review_flag', 'open')
      .is('merged_into_case_id', null)
      .order('priority_tier', { ascending: true })
      .order('sla_due_at', { ascending: true, nullsFirst: false })
      .order('queued_at', { ascending: true })
      .limit(params?.limit ?? 50);
    if (params?.ownerEmail) q = q.eq('owner_email', params.ownerEmail.toLowerCase());
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async closeCase(params: {
    caseId: string;
    closedBy: string;
    summary?: Record<string, unknown>;
  }): Promise<void> {
    await supabase
      .from('expert_cases')
      .update({
        status: 'closed',
        review_flag: 'closed',
        assignment_status: 'completed',
        closed_at: new Date().toISOString(),
        closed_by: params.closedBy,
        close_summary: params.summary ?? {},
        owner_email: null,
        lease_token: null,
        lease_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.caseId);
  },

  contentHash(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value ?? {})).digest('hex');
  },

  newId(): string {
    return randomUUID();
  },
};
