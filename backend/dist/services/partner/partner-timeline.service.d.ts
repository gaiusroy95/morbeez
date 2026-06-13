export declare const partnerTimelineService: {
    addEntry(input: {
        farmerId: string;
        body: string;
        authorType: "telecaller" | "partner" | "expert" | "admin" | "system";
        authorEmail?: string | null;
        partnerId?: string | null;
        authorName?: string | null;
        entryType?: "note" | "comment" | "escalation" | "support_request" | "review_request" | "system_event";
        taskId?: string | null;
        fieldFindingId?: string | null;
        metadata?: Record<string, unknown>;
    }): Promise<any>;
    listForFarmer(farmerId: string, limit?: number): Promise<any[]>;
};
//# sourceMappingURL=partner-timeline.service.d.ts.map