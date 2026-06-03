import type { AdvisoryLanguage } from '../../ai/types.js';
import type { DiseaseWeatherPrior } from './disease-weather-rules.service.js';
import type { SimilarLearnedCase } from './diagnosis-follow-up.service.js';
export type FollowUpQuestionKind = 'yes_no' | 'photo' | 'photo_close' | 'photo_rhizome' | 'spray_timing';
export type PlannedFollowUpQuestion = {
    id: string;
    kind: FollowUpQuestionKind;
    textEn: string;
    textMl: string;
    /** Skip asking when farmer message already implies the answer */
    skipHint?: RegExp;
    /** Ask only when prior answer matches */
    afterAnswer?: {
        questionId: string;
        answer: 'yes' | 'no';
    };
};
export type InvestigationContext = {
    language: AdvisoryLanguage;
    cropType: string;
    symptomsText: string;
    hasPhoto: boolean;
    dap?: number;
    similarCases: SimilarLearnedCase[];
    totalVerifiedCases: number;
    matchConfidence: number;
    bestIssueLabel?: string;
    heavyRainLikely: boolean;
    highHumidityLikely: boolean;
    highHeatLikely: boolean;
    weatherRiskScore: number;
    diseasePriors: DiseaseWeatherPrior[];
    lastSprayKnown: boolean;
    category: string;
};
export type ConfidenceBand = 'high' | 'medium' | 'low';
export declare function resolveMatchConfidenceBand(score: number): ConfidenceBand;
export declare function needsMoreEvidence(ctx: InvestigationContext): boolean;
export declare function shouldSkipFollowUpIntake(ctx: InvestigationContext): boolean;
export declare const diagnosisFollowUpReasoningEngine: {
    resolveMatchConfidenceBand: typeof resolveMatchConfidenceBand;
    shouldSkipFollowUpIntake: typeof shouldSkipFollowUpIntake;
    needsMoreEvidence: typeof needsMoreEvidence;
    buildIntro(ctx: InvestigationContext): string;
    planQuestionSequence(ctx: InvestigationContext, maxQuestions: number): PlannedFollowUpQuestion[];
    branchAfterAnswer(questionId: string, answer: "yes" | "no" | "skip", ctx: InvestigationContext): PlannedFollowUpQuestion[];
    toWhatsAppQuestion(q: PlannedFollowUpQuestion, lang: AdvisoryLanguage): {
        id: string;
        kind: "yes_no" | "photo" | "spray_timing";
        text: string;
    };
    enrichSymptomsFromAnswers(initial: string, answers: Record<string, string>, ctx: InvestigationContext): string;
    formatFieldInvestigationSummary(answers: Record<string, string>, ctx: InvestigationContext): string;
    inferPrimaryIssueFromIntake(initialSymptoms: string, answers: Record<string, string>, bestIssueLabel?: string): string;
};
export type PostIntakeDiagnosisPayload = {
    enrichedSymptoms: string;
    fieldInvestigation: string;
    issueLabelHint: string;
    skipReuseCache: true;
};
//# sourceMappingURL=diagnosis-follow-up-reasoning.engine.d.ts.map