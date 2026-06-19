export declare const goldLearningQueueService: {
    enqueue(params: {
        sessionId: string;
        cropType?: string;
        district?: string;
        failureType?: string;
        metadata?: Record<string, unknown>;
    }): Promise<void>;
};
export declare const modelEvalService: {
    runEval(): Promise<{
        accuracy: number;
        falsePositiveRate: number;
        recoveryRate: number;
    }>;
};
export declare const retrainingPipelineService: {
    runWeekly(): Promise<{
        exported: number;
        status: string;
    }>;
};
//# sourceMappingURL=retraining-pipeline.service.d.ts.map