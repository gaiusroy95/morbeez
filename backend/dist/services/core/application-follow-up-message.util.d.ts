import type { AdvisoryLanguage, DosageItem, StructuredAdvisory } from '../ai/types.js';
export type ApplicationFollowUpContext = {
    issueLabel: string;
    recommendedOn: string;
    summary: string;
};
type RecommendationFields = {
    issue_detected?: string | null;
    recommendation_text?: string | null;
    products?: unknown;
    dosage?: string | null;
    application_type?: string | null;
    technical_name?: string | null;
    trade_name?: string | null;
    communicated_at?: string | null;
    created_at?: string | null;
};
export declare function formatRecommendationDate(iso: string | null | undefined, lang: AdvisoryLanguage): string;
export declare function summarizeDosageGuidance(items: DosageItem[] | null | undefined): string;
export declare function summarizeFromStructuredAdvisory(advisory: Partial<StructuredAdvisory>, lang: AdvisoryLanguage): string;
export declare function summarizeFromRecommendationFields(rec: RecommendationFields): string;
export declare function buildApplicationFollowUpContext(input: {
    issueLabel?: string | null;
    recommendedAt?: string | null;
    summary?: string | null;
    lang: AdvisoryLanguage;
}): ApplicationFollowUpContext;
export declare function contextFromRecommendationRecord(rec: RecommendationFields, lang: AdvisoryLanguage): ApplicationFollowUpContext;
export declare function formatApplicationCheckMessage(lang: AdvisoryLanguage, ctx: ApplicationFollowUpContext): string;
export declare function loadApplicationFollowUpContext(params: {
    farmerId: string;
    lang: AdvisoryLanguage;
    advisorySessionId?: string | null;
    recommendationRecordId?: string | null;
}): Promise<ApplicationFollowUpContext>;
export {};
//# sourceMappingURL=application-follow-up-message.util.d.ts.map