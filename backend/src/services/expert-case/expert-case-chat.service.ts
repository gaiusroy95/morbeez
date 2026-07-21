import type { ExpertCaseReviewDraft } from '@morbeez/shared/expert-case';
import { draftNeedsDilutionClarification, emptyExpertCaseDraft } from '@morbeez/shared/expert-case';
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
import { parseDilutionVolumeL } from './expert-case-treatment-extraction.service.js';
import { copilotMsg, normalizeCopilotLocale } from './expert-case-copilot-i18n.js';
import {
  buildExpertCaseNavigation,
  formatCaseListMessage,
} from './expert-case-navigation.service.js';

export type ExpertChatMessageInput = {
  caseId: string;
  ownerEmail: string;
  leaseToken?: string | null;
  content: string;
  uiLocale?: string | null;
};

export type ExpertCaseDraftPayload = ExpertCaseReviewDraft;

const stringOrNull = { type: ['string', 'null'] as const };
const numberOrNull = { type: ['number', 'null'] as const };
const intOrNull = { type: ['integer', 'null'] as const };
const boolOrNull = { type: ['boolean', 'null'] as const };
const stringArray = { type: 'array' as const, items: { type: 'string' } };

const treatmentActivitySchema = {
  type: 'object' as const,
  additionalProperties: false,
  properties: {
    method: stringOrNull,
    product: stringOrNull,
    dose: stringOrNull,
    dilutionVolumeL: numberOrNull,
    dilutionNotes: stringOrNull,
    interval: stringOrNull,
    notes: stringOrNull,
  },
  required: [
    'method',
    'product',
    'dose',
    'dilutionVolumeL',
    'dilutionNotes',
    'interval',
    'notes',
  ],
};

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
        treatmentActivities: {
          type: 'array' as const,
          items: treatmentActivitySchema,
        },
        sprayVolumeL: numberOrNull,
        dilutionNotes: stringOrNull,
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
        'treatmentActivities',
        'sprayVolumeL',
        'dilutionNotes',
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

    await supabase.from('expert_case_extractions').insert({
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
    navigation?: {
      action: 'next' | 'previous' | 'list';
      targetCaseId: string | null;
      caseNavigation?: Awaited<ReturnType<typeof buildExpertCaseNavigation>>;
    };
  }> {
    if (!this.enabled()) throw new UnauthorizedError('Expert Copilot chat is disabled');
    const owned = await this.assertOwner(input);
    const content = input.content.trim();
    if (!content) throw new ConflictError('Message is empty');

    const locale = normalizeCopilotLocale(input.uiLocale);
    const [priorPending, links, farmerRow] = await Promise.all([
      this.getPendingDraft(input.caseId),
      supabase.from('expert_case_links').select('*').eq('case_id', input.caseId),
      supabase
        .from('farmers')
        .select('preferred_language')
        .eq('id', owned.farmer_id)
        .maybeSingle(),
    ]);
    let currentDraft =
      (priorPending?.draft_json as ExpertCaseDraftPayload | null | undefined) ??
      emptyExpertCaseDraft();

    const briefing = await loadExpertCaseBriefing({
      expertCase: owned as unknown as Record<string, unknown>,
      links: links.data ?? [],
    });
    const farmerLocale = normalizeCopilotLocale(
      farmerRow.data?.preferred_language ?? locale
    );

    const farmerAnswers = parseFarmerAnswerMessage(content);
    const dilutionVolumeL = parseDilutionVolumeL(content);
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

    if (dilutionVolumeL != null) {
      const activities = (currentDraft.treatmentActivities ?? []).map((row) =>
        /spray|foliar/i.test(String(row.method ?? '')) && row.dilutionVolumeL == null
          ? {
              ...row,
              dilutionVolumeL,
              dilutionNotes: `${dilutionVolumeL} L spray volume`,
            }
          : row
      );
      currentDraft = mergeExpertCaseDraft(currentDraft, {
        sprayVolumeL: dilutionVolumeL,
        dilutionNotes: `${dilutionVolumeL} L spray volume`,
        treatmentActivities: activities.length ? activities : currentDraft.treatmentActivities,
        unresolvedFields: (currentDraft.unresolvedFields ?? []).filter(
          (field) => field !== 'dilutionVolume'
        ),
      });
    }

    const intent = detectCopilotIntent(content, currentDraft);

    if (
      intent === 'nav_next_case' ||
      intent === 'nav_previous_case' ||
      intent === 'nav_list_cases'
    ) {
      const caseNavigation = await buildExpertCaseNavigation({
        ownerEmail: input.ownerEmail,
        caseId: input.caseId,
      });

      if (intent === 'nav_list_cases') {
        const result = await this.persistDraftResult({
          caseId: input.caseId,
          ownerEmail: input.ownerEmail,
          leaseToken: input.leaseToken,
          owned,
          agronomistContent: content,
          assistantMessage: formatCaseListMessage(caseNavigation, locale),
          clarification: null,
          draft: currentDraft,
          metadata: { intent, caseNavigation },
        });
        return {
          ...result,
          navigation: { action: 'list', targetCaseId: null, caseNavigation },
        };
      }

      const isNext = intent === 'nav_next_case';
      const targetCaseId = isNext ? caseNavigation.nextCaseId : caseNavigation.previousCaseId;
      const assistantMessage = isNext
        ? targetCaseId
          ? copilotMsg(locale, 'navOpeningNext')
          : copilotMsg(locale, 'navNoNext')
        : targetCaseId
          ? copilotMsg(locale, 'navOpeningPrevious')
          : copilotMsg(locale, 'navNoPrevious');

      const result = await this.persistDraftResult({
        caseId: input.caseId,
        ownerEmail: input.ownerEmail,
        leaseToken: input.leaseToken,
        owned,
        agronomistContent: content,
        assistantMessage,
        clarification: null,
        draft: currentDraft,
        metadata: { intent, caseNavigation, targetCaseId },
      });
      return {
        ...result,
        navigation: {
          action: isNext ? 'next' : 'previous',
          targetCaseId,
          caseNavigation,
        },
      };
    }

    if (intent === 'open_images') {
      const result = applyOpenImagesIntent(currentDraft, briefing, locale);
      return this.persistDraftResult({
        caseId: input.caseId,
        ownerEmail: input.ownerEmail,
        leaseToken: input.leaseToken,
        owned,
        agronomistContent: content,
        assistantMessage: result.assistantMessage,
        clarification: copilotMsg(locale, 'wantAnnotated'),
        draft: result.draft,
        metadata: { intent, uiLocale: locale },
      });
    }

    if (intent === 'enable_annotations') {
      const result = applyAnnotationIntent(currentDraft, locale);
      return this.persistDraftResult({
        caseId: input.caseId,
        ownerEmail: input.ownerEmail,
        leaseToken: input.leaseToken,
        owned,
        agronomistContent: content,
        assistantMessage: result.assistantMessage,
        clarification: null,
        draft: result.draft,
        metadata: { intent, uiLocale: locale },
      });
    }

    if (intent === 'apply_label_dose') {
      const result = applyLabelDoseIntent(currentDraft, locale);
      const enriched = enrichDraftAfterExtraction({
        draft: result.draft,
        briefing,
        runValidations: true,
        locale: farmerLocale,
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
          copilotMsg(locale, 'resistanceFrac'),
          copilotMsg(locale, 'phytotoxicityLow'),
          copilotMsg(locale, 'safetyPpe'),
          enriched.farmerQuestions?.length
            ? `\n${copilotMsg(locale, 'missingInfoSend')}\n${enriched.farmerQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
        clarification: enriched.farmerQuestions?.length
          ? copilotMsg(locale, 'askSendFarmerQs')
          : null,
        draft: enriched,
        metadata: { intent, uiLocale: locale },
      });
    }

    if (intent === 'send_farmer_questions') {
      const result = await applySendFarmerQuestionsIntent({
        caseId: input.caseId,
        farmerId: String(owned.farmer_id),
        draft: currentDraft,
        actorEmail: input.ownerEmail,
        uiLocale: locale,
        farmerLocale,
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
        metadata: { intent, intentId: result.intentId, uiLocale: locale },
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
      uiLocale: locale,
    });

    let draft = mergeExpertCaseDraft(currentDraft, extraction.draft);
    draft = enrichDraftAfterExtraction({
      draft,
      briefing,
      runValidations: true,
      locale: farmerLocale,
      latestMessage: content,
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
      clarification = copilotMsg(locale, 'askLabelDose');
    } else if (draftNeedsDilutionClarification(draft) && !clarification) {
      clarification = copilotMsg(locale, 'askDilution');
    } else if (
      (draft.farmerQuestions?.length ?? 0) > 0 &&
      !draft.farmerQuestionsSent &&
      !clarification
    ) {
      clarification = copilotMsg(locale, 'askSendFarmerQs');
    }

    const assistantParts = [
      extraction.assistantMessage || copilotMsg(locale, 'extracting'),
      draft.validations
        ? [
            '',
            copilotMsg(locale, 'runningValidations'),
            draft.validations.dosage?.askLabelDose
              ? copilotMsg(locale, 'dosageAsk', {
                  message: draft.validations.dosage.message || '',
                })
              : draft.validations.dosage?.askDilution
                ? copilotMsg(locale, 'dilutionAsk', {
                    message: draft.validations.dosage.dilutionMessage || '',
                  })
                : copilotMsg(locale, 'dosageOk'),
            copilotMsg(locale, 'validationsAttached'),
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
        uiLocale: locale,
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
    uiLocale?: string | null;
  }): Promise<{
    assistantMessage: string;
    clarification: string | null;
    draft: ExpertCaseDraftPayload;
  }> {
    const locale = normalizeCopilotLocale(params.uiLocale);
    const fallback: {
      assistantMessage: string;
      clarification: string | null;
      draft: ExpertCaseDraftPayload;
    } = {
      assistantMessage: copilotMsg(locale, 'extracting'),
      clarification: copilotMsg(locale, 'clarifyDiagnosis'),
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
          'When the expert gives multiple application activities (e.g. foliar spray AND soil drench), populate treatmentActivities with one row per activity (method, product, dose, dilutionVolumeL, interval).',
          'For foliar sprays, capture spray tank / dilution water volume in liters (dilutionVolumeL, sprayVolumeL, dilutionNotes) when stated.',
          'Preserve explicit fields; never invent products, doses, IDs, or approvals.',
          'Unknown fields are null and listed in unresolvedFields.',
          'Ask at most one clarification for the whole case; when clarificationAlreadyAsked is true, clarification must be null.',
          `Write assistantMessage and clarification in language code "${locale}" (simple spoken style for Indian agronomists).`,
          'Keep structured field values (diagnosis names, product names, doses, evidence) in English so forms/tables stay consistent.',
          'assistantMessage should briefly confirm extraction.',
          'If the message is a composite recommendation, fill as many structured fields as possible.',
        ].join(' '),
        userPrompt: JSON.stringify({
          caseId: params.caseId,
          currentRevision: params.currentRevision,
          uiLocale: locale,
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
