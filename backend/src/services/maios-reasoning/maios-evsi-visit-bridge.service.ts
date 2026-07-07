import type { MaiosReasoningSnapshot } from '../../domain/maios-reasoning/types.js';
import type { VisitFollowUpQuestionDraft } from '../core/visit-ai-questions.service.js';
import { maiosReasoningPipelineService } from './maios-reasoning-pipeline.service.js';

export type EvsiVisitQuestionDraft = VisitFollowUpQuestionDraft & {
  evsiQuestionId?: string;
  expectedInformationGain?: number;
};

/** Map v17 EVSI nextEvidence into visit wizard follow-up question drafts (additive, shadow-safe). */
export const maiosEvsiVisitBridgeService = {
  isEnabled(): boolean {
    return maiosReasoningPipelineService.isEnabled();
  },

  buildDraftFromReasoning(
    reasoning: MaiosReasoningSnapshot | null | undefined
  ): EvsiVisitQuestionDraft | null {
    if (!this.isEnabled() || !reasoning?.nextEvidence) return null;
    if (reasoning.decision.action === 'LOCK') return null;

    const next = reasoning.nextEvidence;
    if (next.kind === 'question') {
      return {
        questionText: next.label,
        answerType: 'yes_no_unknown',
        kind: 'yes_no',
        evsiQuestionId: next.id,
        expectedInformationGain: next.expectedInformationGain,
      };
    }

    if (next.kind === 'photo_slot') {
      return {
        questionText: `Can you capture a clearer photo of the ${next.id.replace(/_/g, ' ')}?`,
        answerType: 'yes_no_unknown',
        kind: 'yes_no',
        evsiQuestionId: `photo:${next.id}`,
        expectedInformationGain: next.expectedInformationGain,
      };
    }

    return null;
  },

  prependEvsiDrafts(
    drafts: VisitFollowUpQuestionDraft[],
    reasoning: MaiosReasoningSnapshot | null | undefined
  ): EvsiVisitQuestionDraft[] {
    const evsi = this.buildDraftFromReasoning(reasoning);
    if (!evsi) return drafts;

    const key = evsi.questionText.toLowerCase();
    const deduped = drafts.filter((d) => d.questionText.toLowerCase() !== key);
    return [evsi, ...deduped];
  },
};
