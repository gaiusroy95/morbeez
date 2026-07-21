import type { ExpertCaseReviewDraft } from '@morbeez/shared/expert-case';
import {
  mergeExpertCaseDraft,
  emptyExpertCaseDraft,
} from '@morbeez/shared/expert-case';
import { supabase } from '../../lib/supabase.js';
import {
  enrichDraftAfterExtraction,
  parseFarmerAnswerMessage,
} from './expert-case-copilot-simulation.service.js';
import { parseDilutionVolumeL } from './expert-case-treatment-extraction.service.js';
import { copilotMsg } from './expert-case-copilot-i18n.js';

const YES_RE = /^(yes|y|ok|okay|confirm|approved?|सही|हाँ|हां|അതെ|ஆம்|ಹೌದು)\b/i;
const EDIT_RE = /^(edit|change|no|wrong|തിരുത്ത|மாற்ற|ಬದಲಾಯಿಸ)/i;

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

async function persistFarmerTurn(params: {
  caseId: string;
  content: string;
  draft: ExpertCaseReviewDraft;
  assistantMessage: string;
  baseRevision: number;
}) {
  const turnIndex = await nextTurnIndex(params.caseId);
  const { data: farmerTurn } = await supabase
    .from('expert_case_chat_turns')
    .insert({
      case_id: params.caseId,
      turn_index: turnIndex,
      role: 'farmer',
      content: params.content,
      base_revision: params.baseRevision,
    })
    .select('*')
    .single();

  await supabase.from('expert_case_chat_turns').insert({
    case_id: params.caseId,
    turn_index: turnIndex + 1,
    role: 'assistant',
    content: params.assistantMessage,
    actor_email: 'assistant',
    base_revision: params.baseRevision,
    metadata: { source: 'farmer_whatsapp_inbound' },
  });

  await supabase
    .from('expert_case_drafts')
    .update({ status: 'superseded', updated_at: new Date().toISOString() })
    .eq('case_id', params.caseId)
    .eq('status', 'pending');

  await supabase.from('expert_case_drafts').insert({
    case_id: params.caseId,
    base_revision: params.baseRevision,
    draft_revision: params.baseRevision + 1,
    status: 'pending',
    owner_email: 'farmer@whatsapp',
    draft_json: params.draft,
  });

  return farmerTurn;
}

export const expertCaseInboundService = {
  async tryHandleFarmerReply(params: {
    farmerId: string;
    text: string;
    phone?: string | null;
  }): Promise<boolean> {
    const text = params.text.trim();
    if (!text) return false;

    const { data: previewIntent } = await supabase
      .from('communication_intents')
      .select('*')
      .eq('aggregate_type', 'expert_case')
      .eq('purpose', 'recommendation_preview')
      .eq('status', 'sent')
      .contains('recipient_snapshot', { farmerId: params.farmerId })
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previewIntent && !(previewIntent.payload as { farmerConfirmed?: boolean })?.farmerConfirmed) {
      const caseId = String(previewIntent.case_id ?? previewIntent.aggregate_id);
      if (YES_RE.test(text)) {
        const payload = (previewIntent.payload as Record<string, unknown>) ?? {};
        await supabase
          .from('communication_intents')
          .update({
            payload: { ...payload, farmerConfirmed: true, confirmedAt: new Date().toISOString() },
            updated_at: new Date().toISOString(),
          })
          .eq('id', previewIntent.id);

        const revision = Number(payload.revision ?? 1);
        await supabase.from('communication_intents').upsert(
          {
            aggregate_type: 'expert_case',
            aggregate_id: caseId,
            case_id: caseId,
            channel: 'whatsapp',
            purpose: 'recommendation',
            content_version: revision,
            content_hash: String(previewIntent.content_hash),
            recipient_snapshot: previewIntent.recipient_snapshot,
            payload: { ...payload, farmerConfirmed: true },
            status: 'queued',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'aggregate_type,aggregate_id,channel,purpose,content_version' }
        );

        await supabase
          .from('crm_recommendations')
          .update({ status: 'active' })
          .eq('farmer_id', params.farmerId)
          .eq('status', 'pending');

        await supabase
          .from('cultivation_activities')
          .update({ activity_status: 'completed' })
          .eq('farmer_id', params.farmerId)
          .eq('activity_status', 'pending')
          .like('notes', `%Expert case ${caseId.slice(0, 8)}%`);

        await persistFarmerTurn({
          caseId,
          content: text,
          draft: (payload.draft as ExpertCaseReviewDraft) ?? emptyExpertCaseDraft(),
          assistantMessage: copilotMsg(
            (payload.language as string) ?? 'en',
            'farmerConfirmThanks'
          ),
          baseRevision: revision,
        });
        return true;
      }

      if (EDIT_RE.test(text)) {
        await persistFarmerTurn({
          caseId: String(previewIntent.case_id ?? previewIntent.aggregate_id),
          content: text,
          draft: (previewIntent.payload as { draft?: ExpertCaseReviewDraft }).draft ?? emptyExpertCaseDraft(),
          assistantMessage:
            'Thanks — your agronomist will review your feedback and send an updated recommendation.',
          baseRevision: Number((previewIntent.payload as { revision?: number }).revision ?? 0),
        });
        return true;
      }
    }

    const { data: openCase } = await supabase
      .from('expert_cases')
      .select('id, current_revision, farmer_id')
      .eq('farmer_id', params.farmerId)
      .eq('review_flag', 'open')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!openCase) return false;

    const { data: pendingDraft } = await supabase
      .from('expert_case_drafts')
      .select('*')
      .eq('case_id', openCase.id)
      .eq('status', 'pending')
      .maybeSingle();
    if (!pendingDraft?.draft_json) return false;

    const currentDraft = pendingDraft.draft_json as ExpertCaseReviewDraft;
    if (!currentDraft.farmerQuestionsSent) return false;
    if (currentDraft.farmerAnswers && Object.keys(currentDraft.farmerAnswers).length > 0) {
      return false;
    }

    const farmerAnswers = parseFarmerAnswerMessage(text);
    const dilutionVolumeL = parseDilutionVolumeL(text);
    if (!farmerAnswers && dilutionVolumeL == null) return false;

    let draft = mergeExpertCaseDraft(currentDraft, {
      farmerAnswers: { ...(currentDraft.farmerAnswers ?? {}), ...(farmerAnswers ?? {}) },
      notes: [currentDraft.notes, `Farmer WhatsApp: ${text}`].filter(Boolean).join('\n'),
    });
    if (dilutionVolumeL != null) {
      draft = mergeExpertCaseDraft(draft, {
        sprayVolumeL: dilutionVolumeL,
        dilutionNotes: `${dilutionVolumeL} L spray volume`,
        unresolvedFields: (draft.unresolvedFields ?? []).filter((f) => f !== 'dilutionVolume'),
      });
    }
    draft = enrichDraftAfterExtraction({
      draft,
      runValidations: true,
      latestMessage: text,
    });

    await persistFarmerTurn({
      caseId: String(openCase.id),
      content: text,
      draft,
      assistantMessage: copilotMsg('en', 'farmerAnswersRecorded'),
      baseRevision: Number(openCase.current_revision ?? 0),
    });
    return true;
  },
};
