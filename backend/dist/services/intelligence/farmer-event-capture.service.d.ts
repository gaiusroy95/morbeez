import { farmerEventService } from './farmer-event.service.js';
/**
 * Phase 1: fire-and-forget farmer_events capture. Never throws to callers.
 */
export declare const farmerEventCaptureService: {
    recordSafe(input: Parameters<typeof farmerEventService.record>[0]): Promise<void>;
    captureWhatsAppInteraction(params: {
        farmerId: string;
        direction: "inbound" | "outbound";
        messageType?: string;
        externalMessageId?: string;
        contentPreview?: string;
        employeeEmail?: string | null;
        occurredAt?: string;
    }): Promise<void>;
    recordReactivationIfNeeded(farmerId: string, assigneeEmail: string | null): Promise<void>;
    trackFarmerOnboarded(params: {
        farmerId: string;
        leadId?: string;
        source?: string;
        intent?: string;
        assignedTo?: string | null;
    }): Promise<void>;
    trackLeadAssignment(farmerId: string, agentEmail: string): Promise<void>;
    trackRecommendationMilestone(params: {
        recommendationRecordId: string;
        farmerId: string;
        milestone: "created" | "submitted" | "approved" | "rejected" | "communicated" | "outcome_recorded" | "farmer_feedback";
        employeeEmail?: string | null;
        outcome?: string | null;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
    trackRecommendationApplied(params: {
        farmerId: string;
        recommendationRecordId: string;
    }): Promise<void>;
    trackRoiEntry(params: {
        farmerId: string;
        entryId: string;
        entryType: string;
        amountInr: number;
        entryDate: string;
    }): Promise<void>;
    trackOrderConverted(params: {
        farmerId: string;
        shopifyOrderId: string;
        orderName?: string | null;
        total?: string | number | null;
    }): Promise<void>;
    trackAdvisorySessionCompleted(params: {
        farmerId: string;
        sessionId: string;
        escalated: boolean;
        confidence?: number;
    }): Promise<void>;
    trackCallbackRequested(params: {
        farmerId: string;
        sessionId?: string;
        employeeEmail?: string | null;
    }): Promise<void>;
    trackCaseReviewSubmitted(params: {
        farmerId: string;
        escalationId: string;
        recommendationId?: string | null;
        agentEmail: string;
        submittedForApproval: boolean;
        selfApproved?: boolean;
    }): Promise<void>;
    trackCrmFollowUpCompleted(params: {
        farmerId: string;
        taskId: string;
        agentEmail: string;
    }): Promise<void>;
    trackSoilTestUploaded(params: {
        farmerId: string;
        soilReportId: string;
        blockId?: string | null;
        employeeEmail?: string | null;
    }): Promise<void>;
    trackSiteVisitScheduled(params: {
        farmerId: string;
        taskId: string;
        employeeEmail: string;
        dueAt: string;
        blockId?: string | null;
    }): Promise<void>;
    trackFieldFinding(params: {
        farmerId: string;
        findingId: string;
        agentEmail: string;
    }): Promise<void>;
};
//# sourceMappingURL=farmer-event-capture.service.d.ts.map