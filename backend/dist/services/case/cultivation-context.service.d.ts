export type CultivationTaskContext = {
    overdueTasks: Array<{
        taskKey: string;
        title: string;
        priority: number;
    }>;
    upcomingTasks: Array<{
        taskKey: string;
        title: string;
        priority: number;
    }>;
    hasOverdue: boolean;
};
export declare const cultivationContextService: {
    loadForBlock(params: {
        cropType: string;
        dap?: number | null;
    }): Promise<CultivationTaskContext>;
};
//# sourceMappingURL=cultivation-context.service.d.ts.map