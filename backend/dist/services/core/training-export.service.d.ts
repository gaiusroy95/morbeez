export type TrainingDataset = 'events' | 'images' | 'samples' | 'weather';
export type ExportFormat = 'json' | 'csv';
export type QaEntityType = 'training_event' | 'crop_image';
export type QaFlag = 'needs_review' | 'approved' | 'excluded';
export declare const trainingExportService: {
    getDashboardStats(days?: number): Promise<{
        periodDays: number;
        since: string;
        trainingEvents: {
            total: number;
            corrections: number;
            approvals: number;
            correctionRatePct: number;
            labelAccuracyPct: number;
            qaNeedsReview: number;
            bySurface: Record<string, number>;
        };
        cropImages: {
            total: number;
            pending: number;
            reviewed: number;
            correctionRatePct: number;
        };
        learningSamples: {
            total: number;
            withOutcome: number;
            outcomeCoveragePct: number;
        };
        recommendationOutcomes: {
            total: number;
            counts: {
                better: number;
                partial: number;
                no_improvement: number;
                unknown: number;
            };
            issueResolvedCount: number;
            successRatePct: number;
        };
    }>;
    listQaFlags(limit?: number): Promise<{
        flags: {
            entityType: QaEntityType;
            entityId: string;
            reason: string;
            aiLabel: string | null;
            humanLabel: string | null;
            reviewedAt: string | null;
            qaFlag: string | null;
        }[];
        total: number;
    }>;
    setQaFlag(params: {
        entityType: QaEntityType;
        entityId: string;
        flag: QaFlag;
        notes?: string;
        reviewedBy: string;
    }): Promise<{
        ok: boolean;
        entityType: QaEntityType;
        entityId: string;
        flag: QaFlag;
    }>;
    exportDataset(params: {
        dataset: TrainingDataset | "all";
        format: ExportFormat;
        since?: string;
        limit?: number;
    }): Promise<{
        contentType: string;
        filename: string;
        body: string;
    }>;
    exportVisitCaseBundle(fieldFindingId: string): Promise<{
        exportedAt: string;
        fieldFindingId: string;
        finding: any;
        blockAssessment: {
            blockHealth: any;
            cropPerformance: any;
            soilMoisture: any;
        };
        issues: any[];
        measurements: any[];
        visitPhotos: any[];
        aiCases: any[];
        recommendations: any[];
        trainingEvents: any[];
        learningSamples: any[];
        followUps: Record<string, unknown>[];
        callbacks: Record<string, unknown>[];
        workflowArtifacts: {
            overview: {
                visitedAt: any;
                dapAtVisit: any;
                stageAtVisit: any;
                agronomistName: any;
            };
            photos: any[];
            measurements: any[];
            issues: any[];
            aiAnalysis: any[];
            followUpQa: unknown[];
            recommendations: unknown[];
            outcomes: any[];
            learning: {
                events: any[];
                samples: any[];
            };
        };
    }>;
};
//# sourceMappingURL=training-export.service.d.ts.map