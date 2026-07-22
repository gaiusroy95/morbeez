export type CommunicationTimelineEntry = {
    at: string;
    kind: string;
    summary: string;
    source?: string;
};
export declare const communicationTimelineService: {
    buildForFarmer(farmerId: string, limit?: number): Promise<CommunicationTimelineEntry[]>;
};
//# sourceMappingURL=communication-timeline.service.d.ts.map