export type VisitCommandCenterRow = {
    id: string;
    farmerId: string;
    farmerName: string;
    blockName: string | null;
    cropName: string | null;
    priority: 'normal' | 'urgent' | 'emergency';
    status: string;
    visitedAt: string | null;
    dueAt: string | null;
    issueSummary: string | null;
    monitoringRecovery?: {
        d3: string | null;
        d7: string | null;
        d14: string | null;
    };
};
declare const PRIORITIES: readonly ["normal", "urgent", "emergency"];
export declare const visitCommandCenterService: {
    updatePriority(findingId: string, priority: (typeof PRIORITIES)[number]): Promise<{
        id: string;
        priority: (typeof PRIORITIES)[number];
    }>;
    getCommandCenter(agentEmail: string): Promise<{
        summary: {
            todaysVisits: number;
            openIssues: number;
            priorityCount: number;
            openEscalations: number;
            pendingFollowUps: number;
            aiReviewCases: number;
        };
        todaysVisits: {
            id: string;
            title: string;
            dueAt: string | null;
            dueLabel: string;
            farmerId: string | null;
            leadId: string | null;
            farmerName: string;
            location: string | null;
            blockName: string | null;
            cropName: string | null;
            notes: string | null;
        }[];
        priorityQueue: VisitCommandCenterRow[];
        scheduledVisits: {
            id: string;
            title: string;
            dueAt: string | null;
            dueLabel: string;
            farmerId: string | null;
            leadId: string | null;
            farmerName: string;
            location: string | null;
            blockName: string | null;
            cropName: string | null;
            notes: string | null;
        }[];
    }>;
};
export {};
//# sourceMappingURL=visit-command-center.service.d.ts.map