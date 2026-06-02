export type RecommendationAuditAction = 'created' | 'updated' | 'submitted' | 'approved' | 'rejected' | 'communicated' | 'cancelled';
export type RecommendationAuditEntry = {
    action: RecommendationAuditAction;
    by: string;
    at: string;
    note?: string | null;
    fields?: string[];
};
export declare function readAuditLog(metadata: unknown): RecommendationAuditEntry[];
export declare function appendAuditEntry(metadata: unknown, entry: Omit<RecommendationAuditEntry, 'at'> & {
    at?: string;
}): Record<string, unknown>;
export declare function formatAuditLabel(entry: RecommendationAuditEntry): string;
//# sourceMappingURL=recommendation-audit.util.d.ts.map