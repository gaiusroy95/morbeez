import type { EmployeeScoreSnapshot } from './opportunity-score-store.service.js';
export declare const employeePerformanceEngineService: {
    scoreEmployee(employeeProfileId: string, agentEmail: string): Promise<EmployeeScoreSnapshot>;
    listProfileIdsForBatch(limit?: number): Promise<Array<{
        profileId: string;
        email: string;
    }>>;
    runBatch(opts?: {
        limit?: number;
        dryRun?: boolean;
        employeeProfileId?: string;
    }): Promise<{
        scored: number;
        skipped: number;
        errors: number;
        dryRun: boolean;
    }>;
};
//# sourceMappingURL=employee-performance-engine.service.d.ts.map