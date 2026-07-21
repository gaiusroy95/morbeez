export type AuditAppendInput = {
    actorEmail?: string | null;
    actorRole?: string | null;
    requestId?: string | null;
    command: string;
    entityType: string;
    entityId?: string | null;
    entityVersion?: string | null;
    beforeHash?: string | null;
    afterHash?: string | null;
    reason?: string | null;
    payload?: Record<string, unknown>;
};
export declare const governanceAuditService: {
    enabled(): boolean;
    append(input: AuditAppendInput): Promise<{
        sequence: number;
        eventHash: string;
    }>;
    verifyChain(limit?: number): Promise<{
        ok: boolean;
        checked: number;
        brokenAt?: number;
    }>;
};
//# sourceMappingURL=governance-audit.service.d.ts.map