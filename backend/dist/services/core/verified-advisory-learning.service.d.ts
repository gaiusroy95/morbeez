import type { AdvisoryLanguage, StructuredAdvisory } from '../ai/types.js';
import type { DiagnoseResult } from '../ai/types.js';
export type PromoteVerifiedAnswerInput = {
    sessionId: string;
    farmerId: string;
    issueLabel: string;
    /** Farmer-facing answer (English). */
    farmerSummaryEn: string;
    farmerSummaryMl?: string;
    verifiedBy: string;
    products?: DiagnoseResult['productRecommendations'];
    confidence?: number;
    /** Extra strings to index (e.g. agronomist diagnosis label). */
    extraSymptomSources?: (string | undefined | null)[];
    /** When true, index under district '' so all regions get this answer for the same question. */
    global?: boolean;
    /** WhatsApp intake Q&A — indexed so AI can plan follow-ups for similar cases. */
    investigationPattern?: {
        initialSymptoms: string;
        issueLabel: string;
        qa: Array<{
            question: string;
            answer: string;
            kind?: string;
        }>;
    };
};
declare function uniqueSymptomKeys(sources: (string | undefined | null)[]): string[];
/**
 * Permanent verified answers for WhatsApp / Crop Doctor reuse.
 * When staff corrects an AI reply, we index it by the farmer's original question text
 * so the same (or similar) question returns the edited answer — for any farmer in region + globally.
 */
export declare const verifiedAdvisoryLearningService: {
    uniqueSymptomKeys: typeof uniqueSymptomKeys;
    loadSessionQuestionSources(sessionId: string): Promise<{
        cropType: string;
        symptomsText: string | null;
        voiceTranscript: string | null;
        investigationPattern?: PromoteVerifiedAnswerInput["investigationPattern"];
    } | null>;
    /**
     * Index agronomist-verified answer for reuse (regional + optional global district '').
     */
    promoteVerifiedAnswer(input: PromoteVerifiedAnswerInput): Promise<{
        symptomKeys: string[];
        districts: string[];
    }>;
    patchSessionOutput(sessionId: string, advisory: StructuredAdvisory): Promise<void>;
    /**
     * Match farmer free-text to a verified reuse case (before OpenAI).
     */
    matchFarmerQuestion(params: {
        farmerId: string;
        cropType: string;
        text: string;
        language?: AdvisoryLanguage;
        activePlotId?: string | null;
    }): Promise<{
        advisory: StructuredAdvisory;
        issueLabel: string;
        reuseCaseId: string;
    } | null>;
    /**
     * Same farmer asked again in another language — reuse recent diagnosis content.
     */
    matchPeerRecentSession(params: {
        farmerId: string;
        cropType: string;
        text: string;
        language: AdvisoryLanguage;
    }): Promise<{
        advisory: StructuredAdvisory;
        issueLabel: string;
        reuseCaseId: string;
    } | null>;
    formatFarmerMessage(advisory: StructuredAdvisory, language: AdvisoryLanguage): string;
    promoteFromRecommendationRecord(recommendationRecordId: string, verifiedBy: string): Promise<void>;
};
export {};
//# sourceMappingURL=verified-advisory-learning.service.d.ts.map