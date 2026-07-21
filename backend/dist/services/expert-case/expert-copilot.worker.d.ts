export declare class ExpertCopilotWorker {
    private timer;
    start(): void;
    stop(): void;
    runCycle(): Promise<void>;
    reconcileCapacity(): Promise<number>;
    restoreCapacityQueue(): Promise<number>;
    processCommunicationIntents(limit?: number): Promise<number>;
}
export declare const expertCopilotWorker: ExpertCopilotWorker;
export declare function startExpertCopilotWorker(): void;
//# sourceMappingURL=expert-copilot.worker.d.ts.map