type AiDiagnosisRow = {
    label: string;
    confidence: number;
};
export declare const agronomistCaseReviewService: {
    listQueue(params: {
        status?: string;
        sort?: "priority" | "newest";
        page?: number;
        limit?: number;
    }): Promise<{
        items: {
            id: any;
            caseRef: string;
            farmerName: string;
            farmerPhone: {} | null;
            cropType: {};
            dap: number | null;
            confidence: number | null;
            priority: any;
            status: any;
            reason: any;
            createdAt: any;
            createdLabel: string | null;
            timeAgo: string;
            farmerDisagrees: boolean;
            feedbackId: any;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    getCaseDetail(escalationId: string): Promise<{
        escalation: {
            id: any;
            farmerId: string;
            caseRef: string;
            sessionId: any;
            status: any;
            priority: any;
            reason: any;
            confidence: any;
            createdAt: any;
            createdLabel: string | null;
            timeAgo: string;
            agronomistNotes: any;
            correction: any;
        };
        lifecycle: {
            confidenceBand: string | null;
            autoSent: boolean;
            autoSentAt: string | null;
            humanReviewed: boolean;
            humanReviewedAt: string | null;
            humanReviewedBy: string | null;
            corrected: boolean;
            correctedAt: string | null;
            routingDecidedAt: string | null;
        } | null;
        farmer: {
            id: unknown;
            name: string;
            phone: unknown;
            district: unknown;
            language: unknown;
        } | null;
        block: {
            id: string;
            name: string;
            cropType: string;
            dap: number;
        } | null;
        location: {
            district: {} | null;
            village: string | null;
            state: string | null;
            weatherSummary: string | null;
        };
        images: {
            id: string;
            url: string;
            caption: string | null;
            at: string;
        }[];
        inquiry: {
            farmerQuestion: string | null;
            whatsappResponse: string | null;
        };
        review: {
            action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent" | null;
            correctDiagnosis: any;
            severity: "mild" | "moderate" | "severe" | null;
            recommendationText: string | null;
            dosage: string | null;
            notesForLearning: string | null;
            recommendationId: string | null;
            recommendationStatus: string | null;
        };
        ai: {
            topDiagnoses: AiDiagnosisRow[];
            summary: string;
            probableIssue: string | null;
            confidence: any;
            treatments: unknown;
            precautions: unknown;
        };
        confidenceBreakdown: {
            label: string;
            score: number;
        }[];
        context: {
            lastSpray: {
                product: any;
                dosage: any;
                at: string | null;
                appliedAt: string;
            } | null;
            soil: {
                ph: {} | null;
                ec: {} | null;
                organicCarbon: {} | null;
                testedAt: string | null;
            } | null;
            previousIssue: {
                issue: any;
                outcome: any;
                status: any;
            } | null;
            rainfallNote: string | null;
        };
        farmerFeedback: {
            id: any;
            status: any;
            disagrees: boolean;
            farmerDiagnosis: any;
            farmerExperience: any;
            farmerProduct: any;
            farmerOutcome: any;
            aiIssue: any;
            cropExperienceYears: number | null;
        } | null;
        productRecommendations: {
            title: unknown;
            reason: unknown;
            handle: unknown;
        }[];
        similarCases: {
            id: any;
            symptomKey: any;
            issueLabel: any;
            district: any;
            dap: any;
        }[];
        existingRecommendation: {
            id: string;
            status: string;
            issueDetected: any;
            recommendationText: any;
        } | null;
        timeline: {
            at: string | null;
            label: string;
            status: "done" | "pending";
            kind: "whatsapp" | "ai" | "farmer" | "pending";
        }[];
    }>;
    submitReview(escalationId: string, body: {
        action: "approve_ai" | "correct_ai" | "partial_match" | "escalate_urgent";
        correctDiagnosis?: string;
        severity?: "mild" | "moderate" | "severe";
        recommendationText?: string;
        dosage?: string;
        notesForLearning?: string;
        submitForApproval?: boolean;
    }, agent: {
        email: string;
        adminUserId: string;
        role: string;
    }): Promise<{
        escalationId: string;
        recommendationId: string;
        submittedForApproval: boolean;
        selfApproved: boolean;
        verifiedAnswerIndexed: boolean;
        message: string;
    }>;
    listDiagnosisLabels(params: {
        cropType?: string | null;
        search?: string | null;
    }): Promise<string[]>;
    createDiagnosisLabel(params: {
        label: string;
        cropType?: string | null;
    }): Promise<{
        id: string;
        label: string;
    }>;
};
export {};
//# sourceMappingURL=agronomist-case-review.service.d.ts.map