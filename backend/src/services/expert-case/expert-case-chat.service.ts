import { env } from '../../config/env.js';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { supabase } from '../../lib/supabase.js';
import { openaiStrictJsonSchemaCompletion } from '../ai/providers/openai.provider.js';
import { logger } from '../../lib/logger.js';

export type ExpertChatMessageInput = {
  caseId: string;
  ownerEmail: string;
  leaseToken?: string | null;
  content: string;
};

export type ExpertCaseDraftPayload = {
  diagnosis?: string | null;
  confidence?: number | null;
  severity?: string | null;
  recommendationText?: string | null;
  dosage?: string | null;
  followUpDays?: number | null;
  recoveryStatus?: string | null;
  knowledgeCandidate?: boolean;
  notes?: string | null;
  unresolvedFields?: string[];
};

const draftSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assistantMessage: { type: 'string' },
    clarification: { type: ['string', 'null'] },
    draft: {
      type: 'object',
      additionalProperties: false,
      properties: {
        diagnosis: { type: ['string', 'null'] },
        confidence: { type: ['number', 'null'] },
        severity: { type: ['string', 'null'] },
        recommendationText: { type: ['string', 'null'] },
        dosage: { type: ['string', 'null'] },
        followUpDays: { type: ['integer', 'null'] },
        recoveryStatus: { type: ['string', 'null'] },
        knowledgeCandidate: { type: ['boolean', 'null'] },
        notes: { type: ['string', 'null'] },
        unresolvedFields: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'diagnosis',
        'confidence',
        'severity',
        'recommendationText',
        'dosage',
        'followUpDays',
        'recoveryStatus',
        'knowledgeCandidate',
        'notes',
        'unresolvedFields',
      ],
    },
  },
  required: ['assistantMessage', 'clarification', 'draft'],
};

function validateDraftExtraction(value: unknown): {
  ok: true;
  value: { assistantMessage: string; clarification: string | null; draft: ExpertCaseDraftPayload };
} | { ok: false; errors: string[] } {
  if (!value || typeof value !== 'object') return { ok: false, errors: ['not an object'] };
  const row = value as Record<string, unknown>;
  if (typeof row.assistantMessage !== 'string') return { ok: false, errors: ['assistantMessage'] };
  if (!row.draft || typeof row.draft !== 'object') return { ok: false, errors: ['draft'] };
  return {
    ok: true,
    value: {
      assistantMessage: row.assistantMessage,
      clarification: typeof row.clarification === 'string' ? row.clarification : null,
      draft: row.draft as ExpertCaseDraftPayload,
    },
  };
}

function mergeDraft(
  base: ExpertCaseDraftPayload | null | undefined,
  patch: ExpertCaseDraftPayload
): ExpertCaseDraftPayload {
  const merged: ExpertCaseDraftPayload = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'unresolvedFields') continue;
    if (value !== null && value !== undefined) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  merged.unresolvedFields = [...new Set(patch.unresolvedFields ?? base?.unresolvedFields ?? [])];
  return merged;
}

export const expertCaseChatService = {
  enabled(): boolean {
    return env.ENABLE_EXPERT_CASES === true && env.ENABLE_EXPERT_COPILOT_CHAT === true;
  },

  async assertOwner(params: {
    caseId: string;
    ownerEmail: string;
    leaseToken?: string | null;
  }) {
    const { data } = await supabase
      .from('expert_cases')
      .select('id, owner_email, lease_token, lease_expires_at, current_revision, review_flag')
      .eq('id', params.caseId)
      .maybeSingle();
    if (!data) throw new NotFoundError('Expert case not found');
    if (data.review_flag !== 'open') throw new ConflictError('Case is not open for chat');
    if (String(data.owner_email ?? '').toLowerCase() !== params.ownerEmail.trim().toLowerCase()) {
      throw new UnauthorizedError('Only the case owner may chat');
    }
    if (
      env.ENABLE_EXPERT_CASE_OWNERSHIP &&
      params.leaseToken &&
      String(data.lease_token ?? '') !== params.leaseToken
    ) {
      throw new ConflictError('Lease token mismatch');
    }
    if (
      data.lease_expires_at &&
      new Date(String(data.lease_expires_at)).getTime() < Date.now()
    ) {
      throw new ConflictError('Lease expired — reclaim the case');
    }
    return data;
  },

  async listTurns(caseId: string) {
    const { data, error } = await supabase
      .from('expert_case_chat_turns')
      .select('*')
      .eq('case_id', caseId)
      .order('turn_index', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async getPendingDraft(caseId: string) {
    const { data } = await supabase
      .from('expert_case_drafts')
      .select('*')
      .eq('case_id', caseId)
      .eq('status', 'pending')
      .maybeSingle();
    return data;
  },

  async postMessage(input: ExpertChatMessageInput): Promise<{
    agronomistTurn: Record<string, unknown>;
    assistantTurn: Record<string, unknown>;
    draft: ExpertCaseDraftPayload;
    clarification: string | null;
    baseRevision: number;
  }> {
    if (!this.enabled()) throw new UnauthorizedError('Expert Copilot chat is disabled');
    const owned = await this.assertOwner(input);
    const content = input.content.trim();
    if (!content) throw new ConflictError('Message is empty');

    const { data: last } = await supabase
      .from('expert_case_chat_turns')
      .select('turn_index')
      .eq('case_id', input.caseId)
      .order('turn_index', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextIndex = Number(last?.turn_index ?? 0) + 1;

    const { data: agronomistTurn, error: aErr } = await supabase
      .from('expert_case_chat_turns')
      .insert({
        case_id: input.caseId,
        turn_index: nextIndex,
        role: 'agronomist',
        content,
        actor_email: input.ownerEmail.trim().toLowerCase(),
        lease_token: input.leaseToken ?? null,
        base_revision: owned.current_revision,
      })
      .select('*')
      .single();
    if (aErr) throw aErr;

    const [history, priorPending] = await Promise.all([
      this.listTurns(input.caseId),
      this.getPendingDraft(input.caseId),
    ]);
    const clarificationCount = history.filter((turn) => {
      const metadata = (turn.metadata as { clarification?: unknown } | null) ?? null;
      return turn.role === 'assistant' && Boolean(metadata?.clarification);
    }).length;
    const extraction = await this.extractDraft({
      caseId: input.caseId,
      message: content,
      history: history.map((t) => ({ role: String(t.role), content: String(t.content) })),
      currentRevision: Number(owned.current_revision ?? 0),
      currentDraft:
        (priorPending?.draft_json as ExpertCaseDraftPayload | null | undefined) ?? null,
      clarificationAlreadyAsked: clarificationCount > 0,
    });
    extraction.draft = mergeDraft(
      (priorPending?.draft_json as ExpertCaseDraftPayload | null | undefined) ?? null,
      extraction.draft
    );
    if (clarificationCount > 0) extraction.clarification = null;

    const assistantIndex = nextIndex + 1;
    const { data: assistantTurn, error: sErr } = await supabase
      .from('expert_case_chat_turns')
      .insert({
        case_id: input.caseId,
        turn_index: assistantIndex,
        role: 'assistant',
        content: extraction.assistantMessage,
        actor_email: 'assistant',
        base_revision: owned.current_revision,
        metadata: {
          clarification: extraction.clarification,
          unresolvedFields: extraction.draft.unresolvedFields ?? [],
        },
      })
      .select('*')
      .single();
    if (sErr) throw sErr;

    await supabase
      .from('expert_case_drafts')
      .update({ status: 'superseded', updated_at: new Date().toISOString() })
      .eq('case_id', input.caseId)
      .eq('status', 'pending');

    const draftRevision = Number(owned.current_revision ?? 0);
    await supabase.from('expert_case_drafts').insert({
      case_id: input.caseId,
      base_revision: draftRevision,
      draft_revision: draftRevision + 1,
      status: 'pending',
      owner_email: input.ownerEmail.trim().toLowerCase(),
      draft_json: extraction.draft,
    });

    await supabase.from('expert_case_extractions').insert({
      case_id: input.caseId,
      chat_turn_id: agronomistTurn.id,
      proposal_json: extraction,
      clarification_json: extraction.clarification ? { text: extraction.clarification } : null,
      unresolved_json: { fields: extraction.draft.unresolvedFields ?? [] },
      status: 'proposed',
      base_revision: draftRevision,
    });

    return {
      agronomistTurn,
      assistantTurn,
      draft: extraction.draft,
      clarification: extraction.clarification,
      baseRevision: draftRevision,
    };
  },

  async extractDraft(params: {
    caseId: string;
    message: string;
    history: Array<{ role: string; content: string }>;
    currentRevision: number;
    currentDraft?: ExpertCaseDraftPayload | null;
    clarificationAlreadyAsked?: boolean;
  }): Promise<{
    assistantMessage: string;
    clarification: string | null;
    draft: ExpertCaseDraftPayload;
  }> {
    const fallback = {
      assistantMessage:
        'I captured your note. Please confirm diagnosis, dosage, and follow-up in the draft, or clarify anything unclear.',
      clarification: 'Which diagnosis and treatment should I apply to the draft?',
      draft: {
        diagnosis: null,
        confidence: null,
        severity: null,
        recommendationText: null,
        dosage: null,
        followUpDays: null,
        recoveryStatus: null,
        knowledgeCandidate: false,
        notes: params.message.slice(0, 500),
        unresolvedFields: ['diagnosis', 'recommendationText', 'dosage'],
      } satisfies ExpertCaseDraftPayload,
    };

    try {
      const result = await openaiStrictJsonSchemaCompletion({
        schemaName: 'expert_case_chat_draft_v1',
        schema: draftSchema,
        systemPrompt:
          'You are Morbeez Expert Copilot. Convert explicit, composite, ambiguous, or unsupported agronomist chat into independent structured review sub-events. Preserve clear fields and never guess. Unknown or unsupported fields are null and listed in unresolvedFields. Ask at most one clarification for the whole case; when clarificationAlreadyAsked is true, do not ask another. Never mutate official records or invent IDs, treatments, evidence, or approvals.',
        userPrompt: JSON.stringify({
          caseId: params.caseId,
          currentRevision: params.currentRevision,
          history: params.history.slice(-12),
          latestMessage: params.message,
          currentDraft: params.currentDraft ?? null,
          clarificationAlreadyAsked: params.clarificationAlreadyAsked ?? false,
        }),
        validate: validateDraftExtraction,
      });
      return {
        assistantMessage: result.assistantMessage || fallback.assistantMessage,
        clarification: result.clarification ?? null,
        draft: {
          ...fallback.draft,
          ...result.draft,
          unresolvedFields: result.draft.unresolvedFields ?? [],
        },
      };
    } catch (err) {
      logger.warn({ err, caseId: params.caseId }, 'Expert chat extraction failed — safe fallback');
      return fallback;
    }
  },

  async approveDraft(params: {
    caseId: string;
    ownerEmail: string;
    leaseToken?: string | null;
    expectedBaseRevision: number;
    draftPatch?: ExpertCaseDraftPayload;
  }) {
    if (!this.enabled()) throw new UnauthorizedError('Expert Copilot chat is disabled');
    const owned = await this.assertOwner(params);
    if (
      env.ENABLE_EXPERT_CASE_VERSION_LOCK &&
      Number(owned.current_revision) !== params.expectedBaseRevision
    ) {
      throw new ConflictError('stale_base_revision');
    }

    const pending = await this.getPendingDraft(params.caseId);
    if (!pending) throw new NotFoundError('No pending draft');
    if (Number(pending.base_revision) !== params.expectedBaseRevision) {
      throw new ConflictError('stale_base_revision');
    }

    const merged = {
      ...(pending.draft_json as ExpertCaseDraftPayload),
      ...(params.draftPatch ?? {}),
    };

    await supabase
      .from('expert_case_drafts')
      .update({
        status: 'approved',
        draft_json: merged,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pending.id);

    return { draft: merged, draftId: pending.id, baseRevision: params.expectedBaseRevision };
  },
};
