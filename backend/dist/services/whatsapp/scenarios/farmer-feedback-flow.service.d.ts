import type { AdvisoryLanguage } from '../../ai/types.js';
import { isFarmerDisagreementIntent } from '../../core/farmer-feedback-intent.service.js';
import type { ScenarioSenders } from './whatsapp-scenario-router.service.js';
export type FarmerFeedbackCaptureStep = 'diagnosis' | 'experience_years' | 'experience' | 'product' | 'outcome';
export declare function parseFarmerOutcomeAnswer(text: string): 'improved' | 'partial' | 'no_change' | null;
export declare const farmerFeedbackFlowService: {
    isDisagreementIntent: typeof isFarmerDisagreementIntent;
    parseOutcomeAnswer: typeof parseFarmerOutcomeAnswer;
    resumeAfterActivityCommit(params: {
        farmerId: string;
        phone: string;
        lang: AdvisoryLanguage;
        send: ScenarioSenders;
    }): Promise<boolean>;
    canStartDisagreement(farmerId: string): Promise<{
        sessionId: string | null;
        aiIssue: string | null;
        aiConfidence: number | null;
    } | null>;
    startFlow(params: {
        farmerId: string;
        phone: string;
        lang: AdvisoryLanguage;
        send: ScenarioSenders;
        initialText?: string;
    }): Promise<void>;
    tryHandleCapture(params: {
        farmerId: string;
        phone: string;
        lang: AdvisoryLanguage;
        text: string;
        send: ScenarioSenders;
        messageId?: string;
    }): Promise<boolean>;
};
//# sourceMappingURL=farmer-feedback-flow.service.d.ts.map