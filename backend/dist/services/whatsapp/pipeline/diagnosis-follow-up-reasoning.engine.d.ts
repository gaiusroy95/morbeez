import type { AdvisoryLanguage } from '../../ai/types.js';
import type { DiseaseWeatherPrior } from './disease-weather-rules.service.js';
import type { SimilarLearnedCase } from './diagnosis-follow-up.service.js';
import type { LearnedInvestigationPattern } from './diagnosis-follow-up-question.generator.js';
import { type FollowUpChoiceOption } from './follow-up-question.types.js';
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
    learnedPatterns: LearnedInvestigationPattern[];
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
    enrichSymptomsFromAnswers(initial: string, answers: Record<string, string>, questionTexts: Record<string, string>, questionChoices: Record<string, FollowUpChoiceOption[]>, ctx: InvestigationContext): string;
    formatFieldInvestigationSummary(answers: Record<string, string>, questionTexts: Record<string, string>, questionChoices: Record<string, FollowUpChoiceOption[]>, ctx: InvestigationContext): string;
    inferPrimaryIssueFromIntake(initialSymptoms: string, answers: Record<string, string>, questionTexts: Record<string, string>, questionChoices: Record<string, FollowUpChoiceOption[]>, ctx: InvestigationContext): string;
    synthesizeAllAnswersConclusion(initialSymptoms: string, answers: Record<string, string>, questionTexts: Record<string, string>, questionChoices: Record<string, FollowUpChoiceOption[]>, ctx: InvestigationContext): string;
};
export type PostIntakeDiagnosisPayload = {
    enrichedSymptoms: string;
    fieldInvestigation: string;
    issueLabelHint: string;
    skipReuseCache: true;
    investigationPattern?: LearnedInvestigationPattern;
};
//# sourceMappingURL=diagnosis-follow-up-reasoning.engine.d.ts.map