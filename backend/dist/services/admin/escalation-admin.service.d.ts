export type EscalationWorkflowStatus = 'pending' | 'agronomist_review' | 'completed';
/** DB statuses that still need agronomist attention */
export declare const OPEN_ESCALATION_DB_STATUSES: readonly ["pending", "assigned", "in_review"];
declare function workflowFromDbStatus(dbStatus: string): {
    workflowStatus: EscalationWorkflowStatus;
    statusLabel: string;
};
declare function dbStatusFromWorkflow(workflow: EscalationWorkflowStatus): string;
export declare const escalationAdminService: {
    workflowFromDbStatus: typeof workflowFromDbStatus;
    dbStatusFromWorkflow: typeof dbStatusFromWorkflow;
    listForFarmer(farmerId: string): Promise<{
        id: any;
        reason: any;
        summary: string;
        priority: any;
        confidence: any;
        status: any;
        workflowStatus: EscalationWorkflowStatus;
        statusLabel: string;
        assignedTo: any;
        createdLabel: string;
        createdAt: any;
    }[]>;
    listEscalationComments(escalationId: string): Promise<{
        id: any;
        author: string;
        authorRole: "agronomist" | "system" | "telecaller";
        body: string;
        createdLabel: string;
        createdAt: any;
    }[]>;
    addEscalationComment(escalationId: string, text: string, agentEmail: string, role: "telecaller" | "agronomist"): Promise<void>;
    list(params: {
        status?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        items: {
            id: any;
            sessionId: any;
            farmerId: any;
            farmerName: string;
            farmerPhone: {} | null;
            cropType: {} | null;
            language: {};
            reason: any;
            confidence: any;
            priority: any;
            status: any;
            assignedTo: any;
            createdAt: any;
            createdLabel: string | null;
            resolvedAt: any;
            resolvedLabel: string | null;
        }[];
        total: number;
        page: number;
        limit: number;
    }>;
    getById(id: string): Promise<{
        id: any;
        sessionId: any;
        farmerId: string;
        farmer: {
            id: unknown;
            name: string;
            phone: unknown;
            district: unknown;
            language: unknown;
        } | null;
        reason: any;
        confidence: any;
        priority: any;
        status: any;
        workflowStatus: EscalationWorkflowStatus;
        statusLabel: string;
        assignedTo: any;
        agronomistNotes: any;
        comments: {
            id: any;
            author: string;
            authorRole: "agronomist" | "system" | "telecaller";
            body: string;
            createdLabel: string;
            createdAt: any;
        }[];
        resolution: any;
        correction: any;
        resolvedAt: any;
        createdAt: any;
        createdLabel: string | null;
        session: {
            cropType: unknown;
            cropStage: unknown;
            symptomsText: unknown;
            voiceTranscript: unknown;
            summaryEn: unknown;
            summaryMl: unknown;
            probableIssue: unknown;
            treatments: unknown;
            precautions: unknown;
        } | null;
        productRecommendations: {
            title: unknown;
            reason: unknown;
            handle: unknown;
        }[];
    }>;
    update(id: string, body: {
        status?: string;
        workflowStatus?: EscalationWorkflowStatus;
        assignedTo?: string;
        agronomistNotes?: string;
        comment?: string;
        commentRole?: "telecaller" | "agronomist";
        resolution?: string;
        correction?: Record<string, unknown>;
    }, agentEmail: string): Promise<{
        id: any;
        sessionId: any;
        farmerId: string;
        farmer: {
            id: unknown;
            name: string;
            phone: unknown;
            district: unknown;
            language: unknown;
        } | null;
        reason: any;
        confidence: any;
        priority: any;
        status: any;
        workflowStatus: EscalationWorkflowStatus;
        statusLabel: string;
        assignedTo: any;
        agronomistNotes: any;
        comments: {
            id: any;
            author: string;
            authorRole: "agronomist" | "system" | "telecaller";
            body: string;
            createdLabel: string;
            createdAt: any;
        }[];
        resolution: any;
        correction: any;
        resolvedAt: any;
        createdAt: any;
        createdLabel: string | null;
        session: {
            cropType: unknown;
            cropStage: unknown;
            symptomsText: unknown;
            voiceTranscript: unknown;
            summaryEn: unknown;
            summaryMl: unknown;
            probableIssue: unknown;
            treatments: unknown;
            precautions: unknown;
        } | null;
        productRecommendations: {
            title: unknown;
            reason: unknown;
            handle: unknown;
        }[];
    }>;
    countPending(): Promise<number>;
    /** Remove a completed escalation from CRM lists (soft dismiss). */
    clear(id: string, agentEmail: string): Promise<{
        ok: boolean;
        alreadyCleared: boolean;
        cleared?: undefined;
    } | {
        ok: boolean;
        cleared: boolean;
        alreadyCleared?: undefined;
    }>;
    /** Clear all completed escalations from the CRM completed tab. */
    clearCompleted(agentEmail: string): Promise<{
        ok: boolean;
        cleared: number;
    }>;
};
export {};
//# sourceMappingURL=escalation-admin.service.d.ts.map