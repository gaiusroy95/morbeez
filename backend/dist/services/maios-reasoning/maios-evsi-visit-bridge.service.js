import { maiosReasoningPipelineService } from './maios-reasoning-pipeline.service.js';
/** Map v17 EVSI nextEvidence into visit wizard follow-up question drafts (additive, shadow-safe). */
export const maiosEvsiVisitBridgeService = {
    isEnabled() {
        return maiosReasoningPipelineService.isEnabled();
    },
    buildDraftFromReasoning(reasoning) {
        if (!this.isEnabled() || !reasoning?.nextEvidence)
            return null;
        if (reasoning.decision.action === 'LOCK')
            return null;
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
    prependEvsiDrafts(drafts, reasoning, maxQuestions) {
        const cap = maxQuestions ?? drafts.length + 1;
        if (cap <= 0)
            return [];
        const evsi = this.buildDraftFromReasoning(reasoning);
        if (!evsi)
            return drafts.slice(0, cap);
        const key = evsi.questionText.toLowerCase();
        const deduped = drafts.filter((d) => d.questionText.toLowerCase() !== key);
        return [evsi, ...deduped].slice(0, cap);
    },
};
//# sourceMappingURL=maios-evsi-visit-bridge.service.js.map