import type { MaiosReasoningSnapshot } from '../../domain/maios-reasoning/types.js';
import type { VisitFollowUpQuestionDraft } from '../core/visit-ai-questions.service.js';
export type EvsiVisitQuestionDraft = VisitFollowUpQuestionDraft & {
    evsiQuestionId?: string;
    expectedInformationGain?: number;
};
/** Map v17 EVSI nextEvidence into visit wizard follow-up question drafts (additive, shadow-safe). */
export declare const maiosEvsiVisitBridgeService: {
    isEnabled(): boolean;
    buildDraftFromReasoning(reasoning: MaiosReasoningSnapshot | null | undefined): EvsiVisitQuestionDraft | null;
    prependEvsiDrafts(drafts: VisitFollowUpQuestionDraft[], reasoning: MaiosReasoningSnapshot | null | undefined, maxQuestions?: number): EvsiVisitQuestionDraft[];
};
//# sourceMappingURL=maios-evsi-visit-bridge.service.d.ts.map