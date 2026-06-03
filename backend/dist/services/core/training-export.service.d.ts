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
};
//# sourceMappingURL=training-export.service.d.ts.map