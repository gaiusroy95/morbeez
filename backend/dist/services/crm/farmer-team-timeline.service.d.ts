export type TeamTimelineEntry = {
    id: string;
    source: 'timeline' | 'task' | 'visit' | 'escalation' | 'call';
    title: string;
    body: string;
    authorType: string;
    authorName: string | null;
    at: string;
    taskId?: string;
    fieldFindingId?: string;
    metadata?: Record<string, unknown>;
};
export declare const farmerTeamTimelineService: {
    addSystemEntry(input: {
        farmerId: string;
        body: string;
        title?: string;
        entryType?: "note" | "comment" | "escalation" | "support_request" | "review_request" | "system_event";
        taskId?: string;
        fieldFindingId?: string;
        metadata?: Record<string, unknown>;
    }): Promise<any>;
    listForFarmer(farmerId: string, limit?: number): Promise<TeamTimelineEntry[]>;
    addComment(input: {
        farmerId: string;
        body: string;
        authorType: "telecaller" | "partner" | "expert" | "admin";
        authorEmail?: string;
        authorName?: string;
        partnerId?: string;
        entryType?: "note" | "comment" | "support_request";
    }): Promise<any>;
};
//# sourceMappingURL=farmer-team-timeline.service.d.ts.map