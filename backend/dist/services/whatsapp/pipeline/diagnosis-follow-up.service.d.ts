import type { AdvisoryLanguage } from '../../ai/types.js';
import type { SessionContext } from '../scenarios/session-context.types.js';
import { type InvestigationContext, type PostIntakeDiagnosisPayload } from './diagnosis-follow-up-reasoning.engine.js';
import { type FollowUpQuestionKind } from './diagnosis-follow-up-question.generator.js';
import { type FollowUpChoiceOption } from './follow-up-question.types.js';
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
    kind: FollowUpQuestionKind;
    text: string;
    choices: FollowUpChoiceOption[];
    purpose?: string;
    libraryId?: string;
    fromExpertLibrary?: boolean;
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
    buildInvestigationContext(params: {
        farmerId: string;
        language: AdvisoryLanguage;
        symptomsText: string;
        cropType: string;
        hasPhoto: boolean;
    }): Promise<InvestigationContext>;
    planNextQuestionForIntake(investigation: InvestigationContext, intake: IntakeContext): Promise<{
        intakeComplete: boolean;
        question?: FollowUpQuestion;
    }>;
    buildPostIntakePayload(intake: IntakeContext, investigation: InvestigationContext): PostIntakeDiagnosisPayload;
    startIntake(params: {
        farmerId: string;
        phone: string;
        language: AdvisoryLanguage;
        symptomsText: string;
        cropType: string;
        hasPhoto: boolean;
    }): Promise<{
        started: boolean;
        mode?: "learned" | "evidence";
    }>;
    sendCurrentQuestion(phone: string, language: AdvisoryLanguage, intake: IntakeContext, prefix?: string): Promise<void>;
    parseButtonReply(text: string): {
        questionId: string;
        answer: string;
    } | null;
    parseTextAnswer(text: string): "yes" | "no" | "skip" | "within_7d" | "over_14d" | "never" | "unsure" | null;
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
        postIntake: PostIntakeDiagnosisPayload;
        escalateHint?: boolean;
    } | {
        handled: false;
    }>;
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