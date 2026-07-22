import type { MaiosReasoningSnapshot } from '../../domain/maios-reasoning/types.js';
import type { EvsiPlannerHint } from './evsi-planner-hint.types.js';
import type { AdvisoryLanguage } from '../ai/types.js';
import type { InvestigationContext } from '../whatsapp/pipeline/diagnosis-follow-up-reasoning.engine.js';
import type { GeneratedFollowUpQuestion, PostDiagnosisAdvisorySnapshot } from '../whatsapp/pipeline/diagnosis-follow-up-question.generator.js';
/** Map v17 EVSI nextEvidence into WhatsApp structured follow-up questions (additive, shadow-safe). */
export declare const maiosEvsiWhatsappBridgeService: {
    isEnabled(): boolean;
    /** Metadata only — farmer-facing wording comes from the LLM planner. */
    plannerHintFromReasoning(reasoning: MaiosReasoningSnapshot | null | undefined, priorAnswers: Record<string, string>): EvsiPlannerHint | null;
    buildFollowUpFromReasoning(_params: {
        reasoning: MaiosReasoningSnapshot | null | undefined;
        priorAnswers: Record<string, string>;
        questionsAsked: number;
        maxQuestions: number;
    }): GeneratedFollowUpQuestion | null;
    refreshReasoningForPostDiagnosis(params: {
        investigation: InvestigationContext;
        advisory: PostDiagnosisAdvisorySnapshot;
        priorAnswers: Record<string, string>;
        questionTexts: Record<string, string>;
        storedReasoning?: MaiosReasoningSnapshot | null;
        photoCount?: number;
    }): Promise<MaiosReasoningSnapshot | null>;
    refreshReasoningForPreDiagnosis(params: {
        investigation: InvestigationContext;
        priorAnswers: Record<string, string>;
        questionTexts: Record<string, string>;
    }): Promise<MaiosReasoningSnapshot | null>;
    toFollowUpQuestion(generated: GeneratedFollowUpQuestion, _language: AdvisoryLanguage): {
        id: string;
        kind: GeneratedFollowUpQuestion["kind"];
        text: string;
        choices: GeneratedFollowUpQuestion["choices"];
        purpose?: string;
        fromEvsi?: boolean;
    };
};
//# sourceMappingURL=maios-evsi-whatsapp-bridge.service.d.ts.map