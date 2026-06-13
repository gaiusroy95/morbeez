import type { StructuredFieldVisitInput } from '../../domain/ai-training/validators.js';
export declare const fieldVisitService: {
    listIssueMaster: (opts?: {
        category?: import("../../domain/ai-training/enums.js").IssueCategory;
        cropType?: string;
        q?: string;
        limit?: number;
    }) => Promise<{
        id: string;
        category: string;
        issueName: string;
        conceptCode: string | null;
        cropType: string | null;
    }[]>;
    listMeasurementTemplates: (cropType: string) => Promise<{
        id: string;
        cropType: string;
        measurementKey: string;
        labelEn: string;
        labelMl: string | null;
        unit: string | null;
        inputType: string;
        options: any;
        required: boolean;
        sortOrder: number;
    }[]>;
    getVisitDetail(findingId: string): Promise<{
        finding: any;
        issues: any[];
        measurements: any[];
        recommendations: any[];
    }>;
    listFarmerFieldFindings(farmerId: string, options?: {
        limit?: number;
        status?: "open" | "monitoring" | "resolved";
        blockId?: string;
    }): Promise<{
        id: string;
        blockId: string | null;
        blockName: string;
        cropType: string | null;
        visitedAt: string;
        dapAtVisit: number | null;
        issueCount: number;
        recommendationCount: number;
        summary: string;
        blockHealth: string | null;
        topIssueNames: string[];
    }[]>;
    submitStructuredVisit(input: StructuredFieldVisitInput, agronomistEmail: string): Promise<{
        findingId: string;
        finding: {
            id: unknown;
            visitedAt: string | null;
            visitedLabel: string;
            blockId: string | null;
            blockName: string;
            cropType: string;
            agronomistName: unknown;
            agronomistRole: {};
            agronomistInitials: string;
            observations: {};
            parameters: {
                label: string;
                value: string;
            }[];
            diseasePest: {};
            diseaseTone: string;
            diseaseLabel: string;
            actionTaken: {};
            followUpAt: string | null;
            followUpLabel: string;
            photoUrls: string[];
            photoCount: number;
            extraPhotoCount: number;
            findingType: string | null;
            severity: string | null;
            affectedAreaPct: number | null;
            aiPrediction: string | null;
            finalConfirmedIssue: string | null;
            weatherContext: Record<string, unknown>;
            weatherSnapshotId: string | null;
        };
        issues: {
            id: string;
            issueName: string;
        }[];
        recommendationIds: string[];
    }>;
    submitStructuredVisitForPartner(input: StructuredFieldVisitInput, agentEmail: string, partnerId: string | null, agentDisplayName: string): Promise<{
        findingId: string;
        finding: {
            id: unknown;
            visitedAt: string | null;
            visitedLabel: string;
            blockId: string | null;
            blockName: string;
            cropType: string;
            agronomistName: unknown;
            agronomistRole: {};
            agronomistInitials: string;
            observations: {};
            parameters: {
                label: string;
                value: string;
            }[];
            diseasePest: {};
            diseaseTone: string;
            diseaseLabel: string;
            actionTaken: {};
            followUpAt: string | null;
            followUpLabel: string;
            photoUrls: string[];
            photoCount: number;
            extraPhotoCount: number;
            findingType: string | null;
            severity: string | null;
            affectedAreaPct: number | null;
            aiPrediction: string | null;
            finalConfirmedIssue: string | null;
            weatherContext: Record<string, unknown>;
            weatherSnapshotId: string | null;
        };
        issues: {
            id: string;
            issueName: string;
        }[];
        recommendationIds: string[];
    }>;
};
//# sourceMappingURL=field-visit.service.d.ts.map