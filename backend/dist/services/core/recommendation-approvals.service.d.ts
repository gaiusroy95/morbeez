import { type RecommendationAuditEntry } from './recommendation-audit.util.js';
export declare const recommendationApprovalsService: {
    list(params: {
        status?: string;
        createdBy?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        items: {
            id: string;
            farmerId: string;
            status: string;
            source: string;
            issueDetected: string | null;
            recommendationText: string;
            dosage: string | null;
            language: string;
            createdBy: string | null;
            reviewedBy: string | null;
            approvedBy: string | null;
            approvedAt: string | null;
            createdAt: string;
            updatedAt: string;
            farmerName: string | null;
            farmerPhone: string | null;
            blockLabel: string | null;
            cropType: string | null;
            lastAudit: string | null;
        }[];
        total: number;
        limit: number;
        offset: number;
    }>;
    getDetail(id: string): Promise<{
        products: {};
        applicationType: string | null;
        weatherWarning: string | null;
        outcomeNotes: string | null;
        canEdit: boolean;
        auditLog: {
            label: string;
            action: import("./recommendation-audit.util.js").RecommendationAuditAction;
            by: string;
            at: string;
            note?: string | null;
            fields?: string[];
        }[];
        id: string;
        farmerId: string;
        status: string;
        source: string;
        issueDetected: string | null;
        recommendationText: string;
        dosage: string | null;
        language: string;
        createdBy: string | null;
        reviewedBy: string | null;
        approvedBy: string | null;
        approvedAt: string | null;
        createdAt: string;
        updatedAt: string;
        farmerName: string | null;
        farmerPhone: string | null;
        blockLabel: string | null;
        cropType: string | null;
        lastAudit: string | null;
    }>;
    assertCanEdit(row: {
        status: string;
        created_by?: string | null;
    }, editorEmail: string, editorRole: string): void;
    update(id: string, patch: {
        issueDetected?: string;
        recommendationText?: string;
        dosage?: string;
        language?: string;
        applicationType?: string;
        weatherWarning?: string;
    }, editorEmail: string, editorRole: string): Promise<any>;
    recordAudit(id: string, entry: Omit<RecommendationAuditEntry, "at"> & {
        at?: string;
    }): Promise<void>;
};
//# sourceMappingURL=recommendation-approvals.service.d.ts.map