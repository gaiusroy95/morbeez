import type { VisitAssistantRecommendationValidationRequest } from '@morbeez/shared/visit-assistant';
import type { SafetyGateDecision } from '../../domain/expert-case/types.js';
export type SafetyGateInput = {
    aggregateType: string;
    aggregateId: string;
    caseId?: string | null;
    recommendationRevision: string;
    policyVersion?: string;
    actorEmail?: string | null;
    validation: VisitAssistantRecommendationValidationRequest;
    /** Free-text / dosage fields for desk reviews without structured materials. */
    unstructured?: {
        recommendationText?: string | null;
        dosage?: string | null;
        cropType?: string | null;
        applicationType?: string | null;
        phiDays?: number | null;
        reiHours?: number | null;
    };
};
export type SafetyGateResult = {
    decisionId: string;
    decision: SafetyGateDecision;
    contentHash: string;
    blockers: unknown[];
    warnings: unknown[];
    allowsApproval: boolean;
    allowsFarmerCommunication: boolean;
    allowsEvidenceSave: boolean;
};
export declare const recommendationSafetyGateService: {
    enforced(): boolean;
    evaluate(input: SafetyGateInput): Promise<SafetyGateResult>;
    assertAllowsApproval(params: {
        aggregateType: string;
        aggregateId: string;
        contentHash?: string | null;
    }): Promise<SafetyGateResult | null>;
    override(params: {
        decisionId: string;
        overrideBy: string;
        reason: string;
        capabilityGranted: boolean;
    }): Promise<SafetyGateResult>;
};
//# sourceMappingURL=recommendation-safety-gate.service.d.ts.map