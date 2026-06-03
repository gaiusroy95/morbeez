import type { AdvisoryLanguage } from '../../ai/types.js';
import type { SessionContext } from '../scenarios/session-context.types.js';
export type SimilarLearnedCase = {
    reuseCaseId: string;
    issueLabel: string;
    symptomKey: string;
    score: number;
    hitCount: number;
    confidence: number;
    staffVerified: boolean;
};
export type FollowUpQuestion = {
    id: string;
    kind: 'yes_no' | 'photo';
    text: string;
};
type IntakeContext = NonNullable<SessionContext['diagnosisIntake']>;
export declare const diagnosisFollowUpService: {
    enabled(): boolean;
    findSimilarLearnedCases(params: {
        cropType: string;
        district: string | null;
        symptomsText: string;
        limit?: number;
    }): Promise<SimilarLearnedCase[]>;
    buildQuestions(params: {
        language: AdvisoryLanguage;
        symptomsText: string;
        similarCases: SimilarLearnedCase[];
        needsPhoto: boolean;
        category: string;
    }): FollowUpQuestion[];
    enrichedSymptoms(intake: IntakeContext): string;
    startIntake(params: {
        farmerId: string;
        phone: string;
        language: AdvisoryLanguage;
        symptomsText: string;
        cropType: string;
        hasPhoto: boolean;
    }): Promise<{
        started: boolean;
        message?: string;
    }>;
    sendCurrentQuestion(phone: string, language: AdvisoryLanguage, intake: IntakeContext, prefix?: string): Promise<void>;
    parseButtonReply(text: string): {
        questionId: string;
        answer: "yes" | "no";
    } | null;
    parseTextAnswer(text: string): "yes" | "no" | "skip" | null;
    handleIntakeMessage(params: {
        farmerId: string;
        phone: string;
        language: AdvisoryLanguage;
        text: string;
        hasPhoto: boolean;
    }): Promise<{
        handled: true;
        ready: false;
    } | {
        handled: true;
        ready: true;
        enrichedSymptoms: string;
    } | {
        handled: false;
    }>;
    /** After intake, try exact reuse; else return enriched text for Crop Doctor. */
    resolveAfterIntake(params: {
        farmerId: string;
        cropType: string;
        activePlotId?: string | null;
        enrichedSymptoms: string;
        compactHistory?: string;
    }): Promise<{
        reused: boolean;
        matchIssue?: string;
    }>;
};
export {};
//# sourceMappingURL=diagnosis-follow-up.service.d.ts.map