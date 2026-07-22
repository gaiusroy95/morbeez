import type { ExpertCaseBriefing, ExpertCaseReviewDraft, ExpertCaseValidations } from '@morbeez/shared/expert-case';
import { draftHasTreatment, emptyExpertCaseDraft, mergeExpertCaseDraft } from '@morbeez/shared/expert-case';
import { type CopilotUiLocale } from './expert-case-copilot-i18n.js';
export type CopilotIntent = 'open_images' | 'enable_annotations' | 'apply_label_dose' | 'send_farmer_questions' | 'approve' | 'nav_next_case' | 'nav_previous_case' | 'nav_list_cases' | 'free_text';
export declare function detectCaseNavIntent(message: string): 'next' | 'previous' | 'list' | null;
export declare function detectCopilotIntent(message: string, draft: ExpertCaseReviewDraft | null | undefined): CopilotIntent;
export declare function loadExpertCaseBriefing(params: {
    expertCase: Record<string, unknown>;
    links: Array<Record<string, unknown>>;
}): Promise<ExpertCaseBriefing>;
export declare function applyOpenImagesIntent(draft: ExpertCaseReviewDraft, briefing: ExpertCaseBriefing | null, locale?: CopilotUiLocale | string): {
    draft: ExpertCaseReviewDraft;
    assistantMessage: string;
};
export declare function applyAnnotationIntent(draft: ExpertCaseReviewDraft, locale?: CopilotUiLocale | string): {
    draft: ExpertCaseReviewDraft;
    assistantMessage: string;
};
export declare function applyLabelDoseIntent(draft: ExpertCaseReviewDraft, locale?: CopilotUiLocale | string): {
    draft: ExpertCaseReviewDraft;
    assistantMessage: string;
};
export declare function applySendFarmerQuestionsIntent(params: {
    caseId: string;
    farmerId: string;
    draft: ExpertCaseReviewDraft;
    actorEmail: string;
    /** Agronomist UI locale for chat replies; farmer WhatsApp uses farmer preferred language. */
    uiLocale?: CopilotUiLocale | string;
    farmerLocale?: CopilotUiLocale | string | null;
}): Promise<{
    draft: ExpertCaseReviewDraft;
    assistantMessage: string;
    intentId?: string | null;
}>;
/** Deterministic validation suite once treatment is present. */
export declare function buildCopilotValidations(draft: ExpertCaseReviewDraft, briefing?: ExpertCaseBriefing | null): ExpertCaseValidations;
export declare function ensureMissingFarmerQuestions(draft: ExpertCaseReviewDraft, briefing?: ExpertCaseBriefing | null, locale?: CopilotUiLocale | string): ExpertCaseReviewDraft;
export declare function enrichDraftAfterExtraction(params: {
    draft: ExpertCaseReviewDraft;
    briefing?: ExpertCaseBriefing | null;
    runValidations: boolean;
    locale?: CopilotUiLocale | string;
    latestMessage?: string;
}): ExpertCaseReviewDraft;
export declare function parseFarmerAnswerMessage(text: string): Record<string, string> | null;
export { draftHasTreatment, emptyExpertCaseDraft, mergeExpertCaseDraft };
//# sourceMappingURL=expert-case-copilot-simulation.service.d.ts.map