import { createHash, randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { supabase } from '../../lib/supabase.js';
import { expertCaseLifecycleService } from './expert-case-lifecycle.service.js';
import { recommendationSafetyGateService } from '../safety/recommendation-safety-gate.service.js';
import { learningGovernanceService } from '../learning/learning-governance.service.js';
import { governanceAuditService } from '../governance/governance-audit.service.js';

export type CaseReviewCommitInput = {
  caseId: string;
  commandId?: string;
  idempotencyKey: string;
  actorEmail: string;
  leaseToken?: string | null;
  expectedRevision: number;
  draft: {
    diagnosis?: string | null;
    confidence?: number | null;
    severity?: string | null;
    recommendationText?: string | null;
    dosage?: string | null;
    followUpDays?: number | null;
    recoveryStatus?: string | null;
    knowledgeCandidate?: boolean;
    notes?: string | null;
  };
  safetyDecisionId?: string | null;
  closeCase?: boolean;
  summary?: Record<string, unknown>;
};

function requestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? {})).digest('hex');
}

export function buildExpertCaseCommitRequestHash(
  input: Pick<CaseReviewCommitInput, 'caseId' | 'expectedRevision' | 'draft' | 'closeCase'>
): string {
  return requestHash({
    caseId: input.caseId,
    expectedRevision: input.expectedRevision,
    draft: input.draft,
    closeCase: input.closeCase ?? false,
  });
}

export const expertCaseCommitService = {
  enabled(): boolean {
    return env.ENABLE_EXPERT_CASES === true && env.ENABLE_EXPERT_COMMIT_RPCS === true;
  },

  async commitCaseReview(input: CaseReviewCommitInput): Promise<{
    commandId: string;
    caseId: string;
    revision: number;
    closed: boolean;
    communicationIntentId?: string | null;
    knowledgeCandidateId?: string | null;
  }> {
    if (!this.enabled()) {
      throw new UnauthorizedError('Expert commit RPCs are disabled');
    }

    const hash = buildExpertCaseCommitRequestHash(input);

    const { data: existing } = await supabase
      .from('operation_commands')
      .select('*')
      .eq('scope', 'expert_case_review')
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle();

    if (existing) {
      if (existing.request_hash !== hash) {
        throw new ConflictError('idempotency_key_payload_mismatch');
      }
      if (existing.status === 'succeeded' && existing.response_json) {
        return existing.response_json as {
          commandId: string;
          caseId: string;
          revision: number;
          closed: boolean;
          communicationIntentId?: string | null;
          knowledgeCandidateId?: string | null;
        };
      }
    }

    const commandId = existing?.id ? String(existing.id) : input.commandId ?? randomUUID();
    if (!existing) {
      const { error: cmdErr } = await supabase.from('operation_commands').insert({
        id: commandId,
        scope: 'expert_case_review',
        idempotency_key: input.idempotencyKey,
        request_hash: hash,
        actor_email: input.actorEmail,
        actor_role: 'agronomist',
        status: 'accepted',
        aggregate_type: 'expert_case',
        aggregate_id: input.caseId,
      });
      if (cmdErr) throw cmdErr;
    }

    try {
      const caseRow = await expertCaseLifecycleService.getById(input.caseId);
      if (!caseRow) throw new NotFoundError('Expert case not found');
      if (caseRow.review_flag === 'closed') throw new ConflictError('case_already_closed');

      if (env.ENABLE_EXPERT_CASE_OWNERSHIP) {
        if (String(caseRow.owner_email ?? '').toLowerCase() !== input.actorEmail.toLowerCase()) {
          throw new UnauthorizedError('Only the case owner may commit');
        }
        if (input.leaseToken && String(caseRow.lease_token ?? '') !== input.leaseToken) {
          throw new ConflictError('lease_token_mismatch');
        }
      }

      if (
        env.ENABLE_EXPERT_CASE_VERSION_LOCK &&
        Number(caseRow.current_revision) !== input.expectedRevision
      ) {
        throw new ConflictError('stale_base_revision');
      }
      if (input.closeCase && (!input.summary || Object.keys(input.summary).length === 0)) {
        throw new ConflictError('final_summary_required');
      }

      if (env.ENFORCE_SERVER_RECOMMENDATION_SAFETY) {
        await recommendationSafetyGateService.assertAllowsApproval({
          aggregateType: 'expert_case',
          aggregateId: input.caseId,
        });
      }

      const revision = await expertCaseLifecycleService.appendRevision({
        caseId: input.caseId,
        source: 'expert_draft',
        createdBy: input.actorEmail,
        payload: { draft: input.draft, commandId },
      });

      await supabase.from('expert_case_drafts').insert({
        case_id: input.caseId,
        base_revision: input.expectedRevision,
        draft_revision: revision,
        status: 'approved',
        owner_email: input.actorEmail.toLowerCase(),
        draft_json: input.draft,
      });

      // Ledger event
      const { data: lastLedger } = await supabase
        .from('domain_event_ledger')
        .select('sequence')
        .eq('aggregate_type', 'expert_case')
        .eq('aggregate_id', input.caseId)
        .order('sequence', { ascending: false })
        .limit(1)
        .maybeSingle();
      const sequence = Number(lastLedger?.sequence ?? 0) + 1;
      await supabase.from('domain_event_ledger').insert({
        command_id: commandId,
        aggregate_type: 'expert_case',
        aggregate_id: input.caseId,
        sequence,
        event_type: 'case_review_committed',
        actor_email: input.actorEmail,
        before_state: { revision: caseRow.current_revision },
        after_state: { revision, draft: input.draft },
        metadata: { closeCase: input.closeCase ?? false },
      });

      let communicationIntentId: string | null = null;
      if (env.ENABLE_RECOMMENDATION_COMMUNICATION_OUTBOX && input.draft.recommendationText) {
        const contentHash = requestHash(input.draft);
        const { data: intent, error: intentErr } = await supabase
          .from('communication_intents')
          .upsert(
            {
              aggregate_type: 'expert_case',
              aggregate_id: input.caseId,
              case_id: input.caseId,
              channel: 'whatsapp',
              purpose: 'recommendation',
              content_version: revision,
              content_hash: contentHash,
              recipient_snapshot: { farmerId: caseRow.farmer_id },
              payload: {
                recommendationText: input.draft.recommendationText,
                dosage: input.draft.dosage,
                diagnosis: input.draft.diagnosis,
              },
              status: 'queued',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'aggregate_type,aggregate_id,channel,purpose,content_version' }
          )
          .select('id')
          .single();
        if (intentErr) throw intentErr;
        communicationIntentId = String(intent.id);

        await supabase.from('event_outbox').insert({
          event_type: 'expert.communication.queued',
          source: 'expert_case_commit',
          payload: { intentId: communicationIntentId, caseId: input.caseId },
          idempotency_key: `comm:${communicationIntentId}`,
          status: 'pending',
        });
      }

      let knowledgeCandidateId: string | null = null;
      if (
        input.closeCase ||
        input.draft.knowledgeCandidate ||
        env.ENABLE_LEARNING_CANDIDATE_SHADOW
      ) {
        const candidate = await learningGovernanceService.submitCandidate({
          candidateType: 'case_review_correction',
          claimKey: `${caseRow.crop_type ?? 'crop'}:${input.draft.diagnosis ?? 'unknown'}`,
          payload: input.draft,
          caseId: input.caseId,
          proposedBy: input.actorEmail,
          sourceEventIds: [],
        });
        knowledgeCandidateId = candidate.id;
      }

      let closed = false;
      if (input.closeCase) {
        await expertCaseLifecycleService.closeCase({
          caseId: input.caseId,
          closedBy: input.actorEmail,
          summary: {
            ...(input.summary ?? {}),
            draft: input.draft,
            revision,
            commandId,
          },
        });
        closed = true;
      }

      const response = {
        commandId,
        caseId: input.caseId,
        revision,
        closed,
        communicationIntentId,
        knowledgeCandidateId,
      };

      await supabase
        .from('operation_commands')
        .update({
          status: 'succeeded',
          response_json: response,
          completed_at: new Date().toISOString(),
        })
        .eq('id', commandId);

      if (env.ENFORCE_GOVERNANCE_AUDIT) {
        await governanceAuditService.append({
          actorEmail: input.actorEmail,
          actorRole: 'agronomist',
          command: 'expert_case_review_commit',
          entityType: 'expert_case',
          entityId: input.caseId,
          entityVersion: String(revision),
          beforeHash: requestHash({ revision: caseRow.current_revision }),
          afterHash: requestHash({ revision, draft: input.draft }),
          reason: input.closeCase ? 'commit_and_close' : 'commit_review',
          payload: { commandId },
        });
      }

      return response;
    } catch (err) {
      await supabase
        .from('operation_commands')
        .update({
          status: 'failed',
          error_text: err instanceof Error ? err.message : String(err),
          completed_at: new Date().toISOString(),
        })
        .eq('id', commandId);
      throw err;
    }
  },
};
