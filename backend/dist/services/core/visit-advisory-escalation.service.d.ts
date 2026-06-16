export type VisitEscalationReason = 'outcome_worse' | 'outcome_no_whatsapp_response' | 'recommendation_not_applied' | 'disease_progression';
export declare const visitAdvisoryEscalationService: {
    escalate(params: {
        farmerId: string;
        reason: VisitEscalationReason;
        fieldFindingId?: string | null;
        recommendationRecordId?: string | null;
        visitIssueId?: string | null;
        issueLabel?: string | null;
        notes?: string | null;
        priority?: "normal" | "high" | "urgent";
        leadId?: string | null;
    }): Promise<{
        callbackId: string | null;
        taskCreated: boolean;
    }>;
    processMonitoringProgressionJob(job: {
        farmer_id: string;
        payload: Record<string, unknown>;
    }): Promise<void>;
    processEscalationJob(job: {
        farmer_id: string;
        payload: Record<string, unknown>;
    }): Promise<void>;
    scheduleEscalationJob(params: {
        farmerId: string;
        reason: VisitEscalationReason;
        scheduledAt?: string;
        payload?: Record<string, unknown>;
        sessionId?: string | null;
    }): Promise<void>;
};
//# sourceMappingURL=visit-advisory-escalation.service.d.ts.map