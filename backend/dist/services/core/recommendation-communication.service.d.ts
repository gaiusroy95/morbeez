type RecRow = {
    id: string;
    farmer_id: string;
    issue_detected: string | null;
    recommendation_text: string;
    dosage: string | null;
    application_type: string | null;
    weather_warning: string | null;
    language: string;
    status: string;
    communicated_at?: string | null;
    metadata?: Record<string, unknown>;
    farmers?: {
        phone: string | null;
        name: string | null;
        preferred_language: string | null;
    };
};
export type RecommendationMessageExtras = {
    blockName?: string;
    products?: Array<{
        technicalName?: string;
        dose?: string;
        method?: string;
        applicationDay?: number;
        applicationType?: string;
    }>;
    reviewDate?: string;
    monitoringInterval?: string;
};
export declare function buildApprovedRecommendationMessage(row: RecRow, extras?: RecommendationMessageExtras): string;
export declare const recommendationCommunicationService: {
    sendApprovedRecommendation(recommendationId: string, options?: {
        force?: boolean;
    }): Promise<{
        sent: boolean;
        message?: string;
        reason?: string;
    }>;
    sendVisitSummary(params: {
        farmerId: string;
        blockName: string;
        issueSummary: string;
        approvedRecCount: number;
        reviewDateLabel?: string;
    }): Promise<{
        sent: boolean;
        reason?: string;
    }>;
    sendEvidenceRequest(params: {
        farmerId: string;
        blockId: string;
        diagnosis: string;
        photoTypes: string[];
        questions: Array<{
            key: string;
            text: string;
            answer?: string;
        }>;
    }): Promise<{
        sent: boolean;
        reason?: string;
        messageId?: string;
    }>;
    previewVisitMessages(input: {
        farmerId: string;
        blockName?: string;
        recommendationGroups?: Array<{
            applicationType: string;
            applicationDay?: number;
            materials: Array<{
                technicalName: string;
                dose?: string;
                method?: string;
                issueIndex?: number;
            }>;
        }>;
        reviewDate?: string;
        monitoringInterval?: string;
        issues: Array<{
            issueName: string;
            finalDiagnosis?: string;
            finalRecommendation?: string;
            initialRecommendation?: {
                text: string;
                dose?: string;
                method?: string;
            };
        }>;
    }): Promise<{
        issueLabel: string;
        message: string;
        compliancePrompt: string;
    }[]>;
};
export {};
//# sourceMappingURL=recommendation-communication.service.d.ts.map