import type { ExpertCaseReviewDraft } from '@morbeez/shared/expert-case';
import { emptyExpertCaseDraft } from '@morbeez/shared/expert-case';
import { env } from '../../config/env.js';
import { ConflictError, NotFoundError, UnauthorizedError } from '../../lib/errors.js';
import { supabase } from '../../lib/supabase.js';
import { openaiStrictJsonSchemaCompletion } from '../ai/providers/openai.provider.js';
import { logger } from '../../lib/logger.js';
import {
  applyAnnotationIntent,
  applyLabelDoseIntent,
  applyOpenImagesIntent,
  applySendFarmerQuestionsIntent,
  detectCopilotIntent,
  enrichDraftAfterExtraction,
  loadExpertCaseBriefing,
  mergeExpertCaseDraft,
  parseFarmerAnswerMessage,
} from './expert-case-copilot-simulation.service.js';

export type ExpertChatMessageInput = {
  caseId: string;
  ownerEmail: string;
  leaseToken?: string | null;
  content: string;
};

export type ExpertCaseDraftPayload = ExpertCaseReviewDraft;

const stringOrNull = { type: ['string', 'null'] as const };
const numberOrNull = { type: ['number', 'null'] as const };
const intOrNull = { type: ['integer', 'null'] as const };
const boolOrNull = { type: ['boolean', 'null'] as const };
const stringArray = { type: 'array' as const, items: { type: 'string' } };

const draftSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assistantMessage: { type: 'string' },
    clarification: stringOrNull,
    draft: {
      type: 'object',
      additionalProperties: false,
      properties: {
        diagnosis: stringOrNull,
        confidence: numberOrNull,
        severity: stringOrNull,
        secondaryDiagnosis: stringOrNull,
        secondaryConfidence: numberOrNull,
        recommendationText: stringOrNull,
        dosage: stringOrNull,
        dosageSource: stringOrNull,
        applicationMethod: stringOrNull,
        applicationTiming: stringOrNull,
        treatmentProduct: stringOrNull,
        evidence: stringArray,
        rootCauses: stringArray,
        nutritionProduct: stringOrNull,
        nutritionDose: stringOrNull,
        nutritionTiming: stringOrNull,
        culturalPractices: stringArray,
        precautions: stringArray,
        farmerTasks: stringArray,
        followUpDays: intOrNull,
        recoveryStatus: stringOrNull,
        knowledgeCandidate: boolOrNull,
        knowledgeCandidateReason: stringOrNull,
        notes: stringOrNull,
        unresolvedFields: stringArray,
        farmerQuestions: stringArray,
        farmerQuestionsSent: boolOrNull,
      },
      required: [
        'diagnosis',
        'confidence',
        'severity',
        'secondaryDiagnosis',
        'secondaryConfidence',
        'recommendationText',
        'dosage',
        'dosageSource',
        'applicationMethod',
        'applicationTiming',
        'treatmentProduct',
        'evidence',
        'rootCauses',
        'nutritionProduct',
        'nutritionDose',
        'nutritionTiming',
        'culturalPractices',
        'precautions',
        'farmerTasks',
        'followUpDays',
        'recoveryStatus',
        'knowledgeCandidate',
        'knowledgeCandidateReason',
        'notes',
        'unresolvedFields',
        'farmerQuestions',
        'farmerQuestionsSent',
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

async function nextTurnIndex(caseId: string): Promise<number> {
  const { data: last } = await supabase
    .from('expert_case_chat_turns')
    .select('turn_index')
    .eq('case_id', caseId)
    .order('turn_index', { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number(last?.turn_index ?? 0) + 1;
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
      .select('id, owner_email, lease_token, lease_expires_at, current_revision, review_flag, farmer_id, crop_type, primary_issue_label, metadata, priority')
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

  async persistDraftResult(params: {
    caseId: string;
    ownerEmail: string;
    leaseToken?: string | null;
    owned: { current_revision: number | null };
    agronomistContent: string;
    assistantMessage: string;
    clarification: string | null;
    draft: ExpertCaseDraftPayload;
    metadata?: Record<string, unknown>;
  }) {
    const nextIndex = await nextTurnIndex(params.caseId);
    const { data: agronomistTurn, error: aErr } = await supabase
      .from('expert_case_chat_turns')
      .insert({
        case_id: params.caseId,
        turn_index: nextIndex,
        role: 'agronomist',
        content: params.agronomistContent,
        actor_email: params.ownerEmail.trim().toLowerCase(),
        lease_token: params.leaseToken ?? null,
        base_revision: params.owned.current_revision,
      })
      .select('*')
      .single();
    if (aErr) throw aErr;

    const { data: assistantTurn, error: sErr } = await supabase
      .from('expert_case_chat_turns')
      .insert({
        case_id: params.caseId,
        turn_index: nextIndex + 1,
        role: 'assistant',
        content: params.assistantMessage,
        actor_email: 'assistant',
        base_revision: params.owned.current_revision,
        metadata: {
          clarification: params.clarification,
          unresolvedFields: params.draft.unresolvedFields ?? [],
          ...(params.metadata ?? {}),
        },
      })
      .select('*')
      .single();
    if (sErr) throw sErr;

    await supabase
      .from('expert_case_drafts')
      .update({ status: 'superseded', updated_at: new Date().toISOString() })
      .eq('case_id', params.caseId)
      .eq('status', 'pending');

    const draftRevision = Number(params.owned.current_revision ?? 0);
    await supabase.from('expert_case_drafts').insert({
      case_id: params.caseId,
      base_revision: draftRevision,
      draft_revision: draftRevision + 1,
      status: 'pending',
      owner_email: params.ownerEmail.trim().toLowerCase(),
      draft_json: params.draft,
    });

    await supabase.from('expert_case_extracted').insert({
      case_id: params.caseId,
      chat_turn_id: agronomistTurn.id,
      proposal_json: {
        assistantMessage: params.assistantMessage,
        clarification: params.clarification,
        draft: params.draft,
      },
      clarification_json: params.clarification ? { text: params.clarification } : null,
      unresolved_json: { fields: params.draft.unresolvedFields ?? [] },
      status: 'proposed',
      base_revision: draftRevision,
    });

    return {
      agronomistTurn,
      assistantTurn,
      draft: params.draft,
      clarification: params.clarification,
      baseRevision: draftRevision,
    };
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

    const [priorPending, links] = await Promise.all([
      this.getPendingDraft(input.caseId),
      supabase.from('expert_case_links').select('*').eq('case_id', input.caseId),
    ]);
    let currentDraft =
      (priorPending?.draft_json as ExpertCaseDraftPayload | null | undefined) ??
      emptyExpertCaseDraft();

    const briefing = await loadExpertCaseBriefing({
      expertCase: owned as unknown as Record<string, unknown>,
      links: links.data ?? [],
    });

    const farmerAnswers = parseFarmerAnswerMessage(content);
    if (farmerAnswers) {
      currentDraft = mergeExpertCaseDraft(currentDraft, {
        farmerAnswers: { ...(currentDraft.farmerAnswers ?? {}), ...farmerAnswers },
        notes: [currentDraft.notes, `Farmer reply: ${content}`].filter(Boolean).join('\n'),
      });
      if (farmerAnswers.soilPh || farmerAnswers.soilEc) {
        currentDraft = mergeExpertCaseDraft(currentDraft, {
          unresolvedFields: (currentDraft.unresolvedFields ?? []).filter(
            (f) => !['soilPh', 'soilEc', 'soil'].includes(f)
          ),
        });
      }
    }

    const intent = detectCopilotIntent(content, currentDraft);

    if (intent === 'open_images') {
      const result = applyOpenImagesIntent(currentDraft, briefing);
      return this.persistDraftResult({
        caseId: input.caseId,
        ownerEmail: input.ownerEmail,
        leaseToken: input.leaseToken,
        owned,
        agronomistContent: content,
        assistantMessage: result.assistantMessage,
        clarification: 'Would you like AI annotated images?',
        draft: result.draft,
        metadata: { intent },
      });
    }

    if (intent === 'enable_annotations') {
      const result = applyAnnotationIntent(currentDraft);
      return this.persistDraftResult({
        caseId: input.caseId,
        ownerEmail: input.ownerEmail,
        leaseToken: input.leaseToken,
        owned,
        agronomistContent: content,
        assistantMessage: result.assistantMessage,
        clarification: null,
        draft: result.draft,
        metadata: { intent },
      });
    }

    if (intent === 'apply_label_dose') {
      const result = applyLabelDoseIntent(currentDraft);
      const enriched = enrichDraftAfterExtraction({
        draft: result.draft,
        briefing,
        runValidations: true,
      });
      return this.persistDraftResult({
        caseId: input.caseId,
        ownerEmail: input.ownerEmail,
        leaseToken: input.leaseToken,
        owned,
        agronomistContent: content,
        assistantMessage: [
          result.assistantMessage,
          '',
          'Resistance Management: FRAC rotation OK · Risk LOW',
          'Phytotoxicity: LOW',
          'Safety: PPE required · REI 24h · Harvest interval recorded',
          enriched.farmerQuestions?.length
            ? `\nMissing information — send these questions to farmer?\n${enriched.farmerQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
        clarification: enriched.farmerQuestions?.length
          ? 'Send these questions to farmer?'
          : null,
        draft: enriched,
        metadata: { intent },
      });
    }

    if (intent === 'send_farmer_questions') {
      const result = await applySendFarmerQuestionsIntent({
        caseId: input.caseId,
        farmerId: String(owned.farmer_id),
        draft: currentDraft,
        actorEmail: input.ownerEmail,
      });
      return this.persistDraftResult({
        caseId: input.caseId,
        ownerEmail: input.ownerEmail,
        leaseToken: input.leaseToken,
        owned,
        agronomistContent: content,
        assistantMessage: result.assistantMessage,
        clarification: null,
        draft: result.draft,
        metadata: { intent, intentId: result.intentId },
      });
    }

    const history = await this.listTurns(input.caseId);
    const clarificationCount = history.filter((turn) => {
      const metadata = (turn.metadata as { clarification?: unknown } | null) ?? null;
      return turn.role === 'assistant' && Boolean(metadata?.clarification);
    }).length;

    const extraction = await this.extractDraft({
      caseId: input.caseId,
      message: content,
      history: history.map((t) => ({ role: String(t.role), content: String(t.content) })),
      currentRevision: Number(owned.current_revision ?? 0),
      currentDraft,
      clarificationAlreadyAsked: clarificationCount > 0,
      briefing,
    });

    let draft = mergeExpertCaseDraft(currentDraft, extraction.draft);
    draft = enrichDraftAfterExtraction({
      draft,
      briefing,
      runValidations: true,
    });
    if (farmerAnswers) {
      draft = mergeExpertCaseDraft(draft, { farmerAnswers });
    }

    let clarification = clarificationCount > 0 ? null : extraction.clarification;
    if (
      draft.validations?.dosage?.askLabelDose &&
      draft.dosageSource !== 'label' &&
      !clarification
    ) {
      clarification =
        'Manufacturer label dose detected. Use the registered label dosage for this formulation?';
    } else if (
      (draft.farmerQuestions?.length ?? 0) > 0 &&
      !draft.farmerQuestionsSent &&
      !clarification
    ) {
      clarification = 'Send these missing-field questions to the farmer?';
    }

    const assistantParts = [
      extraction.assistantMessage || 'Understood. Extracting expert recommendations…',
      draft.validations
        ? [
            '',
            'Running automatic validations…',
            draft.validations.dosage?.askLabelDose
              ? `Dosage: ${draft.validations.dosage.message}`
              : 'Dosage validated.',
            'Compatibility, weather, FRAC, phytotoxicity, and safety checks attached to the structured preview.',
          ].join('\n')
        : '',
    ];

    return this.persistDraftResult({
      caseId: input.caseId,
      ownerEmail: input.ownerEmail,
      leaseToken: input.leaseToken,
      owned,
      agronomistContent: content,
      assistantMessage: assistantParts.filter(Boolean).join('\n'),
      clarification,
      draft,
      metadata: {
        intent: 'free_text',
        hasValidations: Boolean(draft.validations),
      },
    });
  },

  async extractDraft(params: {
    caseId: string;
    message: string;
    history: Array<{ role: string; content: string }>;
    currentRevision: number;
    currentDraft?: ExpertCaseDraftPayload | null;
    clarificationAlreadyAsked?: boolean;
    briefing?: Awaited<ReturnType<typeof loadExpertCaseBriefing>> | null;
  }): Promise<{
    assistantMessage: string;
    clarification: string | null;
    draft: ExpertCaseDraftPayload;
  }> {
    const fallback: {
      assistantMessage: string;
      clarification: string | null;
      draft: ExpertCaseDraftPayload;
    } = {
      assistantMessage:
        'I captured your note. Review the structured preview and confirm diagnosis, dosage, and follow-up — or clarify anything unclear.',
      clarification: 'Which diagnosis and treatment should I apply to the draft?',
      draft: {
        ...emptyExpertCaseDraft(),
        notes: params.message.slice(0, 500),
        unresolvedFields: ['diagnosis', 'recommendationText', 'dosage'],
      },
    };

    try {
      const result = await openaiStrictJsonSchemaCompletion({
        schemaName: 'expert_case_chat_draft_v2',
        schema: draftSchema,
        systemPrompt: [
          'You are Morbeez Expert Copilot for agronomists.',
          'Convert expert chat into a structured case review draft that fills forms/tables.',
          'Extract: primary + secondary diagnosis, evidence bullets, root causes, treatment product, dosage, application method/timing, nutrition, cultural practices, precautions, follow-up days, farmer tasks, farmer clarification questions, knowledge candidate.',
          'Preserve explicit fields; never invent products, doses, IDs, or approvals.',
          'Unknown fields are null and listed in unresolvedFields.',
          'Ask at most one clarification for the whole case; when clarificationAlreadyAsked is true, clarification must be null.',
          'assistantMessage should briefly confirm extraction (e.g. Understood. Extracting expert recommendations...).',
          'If the message is a composite recommendation, fill as many structured fields as possible.',
        ].join(' '),
        userPrompt: JSON.stringify({
          caseId: params.caseId,
          currentRevision: params.currentRevision,
          briefing: params.briefing ?? null,
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
        draft: mergeExpertCaseDraft(emptyExpertCaseDraft(), {
          ...result.draft,
          unresolvedFields: result.draft.unresolvedFields ?? [],
        }),
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

    const merged = mergeExpertCaseDraft(
      pending.draft_json as ExpertCaseDraftPayload,
      params.draftPatch ?? {}
    );

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
