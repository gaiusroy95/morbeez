/** Structured WhatsApp outcome KPI — farmer-facing follow-up after recommendation */
export declare const IMPROVEMENT_LEVELS: readonly ["fully_improved", "slight_improvement", "no_improvement", "worse"];
export type ImprovementLevel = (typeof IMPROVEMENT_LEVELS)[number];
export type OutcomeKpiPayload = {
    improvementLevel: ImprovementLevel;
    photoUploaded?: boolean;
    daysAfterSpray?: number | null;
    newSymptoms?: boolean;
    repeatedIssue?: boolean;
    farmerSatisfaction?: 'positive' | 'neutral' | 'negative' | null;
    aiClassification?: 'positive' | 'partial' | 'failed' | 'uncertain';
    aiConfidence?: number;
    collectedAt: string;
    source: 'whatsapp_button' | 'whatsapp_text' | 'whatsapp_ai' | 'agronomist';
    rawSnippet?: string;
};
export type OutcomeKpiButtonId = 'rec.outcome_full' | 'rec.outcome_slight' | 'rec.outcome_none' | 'rec.outcome_worse' | 'rec.outcome_yes' | 'rec.outcome_no';
export declare function improvementLevelFromButton(buttonId: string): ImprovementLevel | null;
export declare function improvementLevelToOutcomeReply(level: ImprovementLevel): 'improved' | 'partial' | 'no_improvement' | 'worsened';
export declare function improvementLevelToRecordOutcome(level: ImprovementLevel): 'better' | 'partial' | 'no_improvement';
/** Parse farmer free-text / numeric replies during KPI follow-up */
export declare function parseImprovementLevelFromText(text: string): {
    level: ImprovementLevel;
    confidence: number;
} | null;
export declare function aiClassificationFromLevel(level: ImprovementLevel, confidence: number): OutcomeKpiPayload['aiClassification'];
//# sourceMappingURL=outcome-kpi.d.ts.map