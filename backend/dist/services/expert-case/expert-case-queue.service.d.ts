type QueueBucket = 'my_work' | 'available' | 'at_risk' | 'intervention';
export declare function scoreExpertCaseQueue(row: {
    priority_tier?: string | null;
    sla_due_at?: string | null;
    queued_at?: string | null;
    requeue_count?: number | null;
    queue_weight?: number | null;
}): number;
export declare const expertCaseQueueService: {
    enabled(): boolean;
    listBuckets(ownerEmail: string): Promise<Record<QueueBucket, Record<string, unknown>[]>>;
    matchExpertsForCase(caseId: string): Promise<Array<{
        email: string;
        score: number;
        generalistFallback: boolean;
    }>>;
    autoAssignBatch(limit?: number): Promise<number>;
    markAwaitingCapacity(caseId: string): Promise<void>;
};
export {};
//# sourceMappingURL=expert-case-queue.service.d.ts.map