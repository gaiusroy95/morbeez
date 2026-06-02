import type { AdvisoryLanguage } from '../ai/types.js';
export declare const agronomistWorkflowService: {
    listReviewQueue(limit?: number): Promise<{
        items: unknown[];
    }>;
    getFindingDetail(findingId: string): Promise<{
        finding: any;
        recommendation: any;
    }>;
    generateAiSuggestion(findingId: string): Promise<{
        sessionId: string;
        escalated: boolean;
        escalationId: string | undefined;
        advisory: {
            probableIssue: string;
            confidence: number;
            uncertain: boolean;
            farmerSummaryEn: string;
            farmerSummaryMl: string;
            treatments: import("../ai/types.js").TreatmentItem[];
            dosageGuidance: import("../ai/types.js").DosageItem[];
            precautions: string[];
        };
        productRecommendations: import("../ai/types.js").ProductRecommendation[];
        suggested: {
            issueDetected: string;
            recommendationText: string;
            dosage: string | undefined;
            weatherWarning: string | undefined;
            products: import("../ai/types.js").ProductRecommendation[];
            language: AdvisoryLanguage;
        };
        existingRecommendationId: any;
    }>;
    saveDraft(input: {
        findingId: string;
        farmerId: string;
        blockId?: string;
        leadId?: string;
        aiSessionId?: string;
        issueDetected?: string;
        recommendationText: string;
        products?: unknown[];
        dosage?: string;
        applicationType?: string;
        weatherWarning?: string;
        language?: string;
        createdBy: string;
        recommendationId?: string;
    }): Promise<any>;
    submitForApproval(recommendationId: string, reviewedBy: string): Promise<any>;
    listAgronomistSubmissions(status?: string, limit?: number, createdBy?: string): Promise<{
        id: string;
        farmerId: string;
        status: string;
        source: string;
        issueDetected: string | null;
        recommendationText: string;
        dosage: string | null;
        language: string;
        createdBy: string | null;
        reviewedBy: string | null;
        approvedBy: string | null;
        approvedAt: string | null;
        createdAt: string;
        updatedAt: string;
        farmerName: string | null;
        farmerPhone: string | null;
        blockLabel: string | null;
        cropType: string | null;
        lastAudit: string | null;
    }[]>;
};
//# sourceMappingURL=agronomist-workflow.service.d.ts.map