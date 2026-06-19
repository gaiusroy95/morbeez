export type MonitoringSeverity = 'low' | 'medium' | 'high';
export type MonitoringPlanItemRow = {
    id: string;
    recommendationRecordId: string;
    intervalDays: number;
    checkType: string;
    severity: MonitoringSeverity;
    nextCheckAt: string;
    createdAt: string;
};
export type MonitoringPlanMaterialHint = {
    category?: string | null;
    technicalName?: string | null;
};
export declare const monitoringPlanService: {
    resolveIntervalDays(severity: string | null | undefined, materials?: MonitoringPlanMaterialHint[]): number;
    resolveCheckType(materials?: MonitoringPlanMaterialHint[]): string;
    createForRecommendation(recommendationRecordId: string, opts?: {
        severity?: string | null;
        checkType?: string;
        materials?: MonitoringPlanMaterialHint[];
        intervalDays?: number;
        from?: Date;
    }): Promise<MonitoringPlanItemRow>;
    listByRecommendation(recommendationRecordId: string): Promise<MonitoringPlanItemRow[]>;
    deleteForRecommendation(recommendationRecordId: string): Promise<void>;
    previewForVisit(input: {
        issues: Array<{
            localId: string;
            issueName: string;
            severity: string;
        }>;
        recommendationGroups?: Array<{
            applicationType: string;
            applicationDay?: number;
            materials: Array<{
                technicalName: string;
                category?: string;
            }>;
        }>;
    }): {
        localId: string;
        issueLocalId: string;
        issueLabel: string;
        intervalDays: number;
        checkType: string;
        severity: MonitoringSeverity;
    }[];
    scheduleProgressionJob(params: {
        farmerId: string;
        fieldFindingId: string;
        visitIssueId: string;
        severity: string;
        sessionId?: string | null;
        intervalDays?: number;
    }): Promise<void>;
};
//# sourceMappingURL=monitoring-plan.service.d.ts.map