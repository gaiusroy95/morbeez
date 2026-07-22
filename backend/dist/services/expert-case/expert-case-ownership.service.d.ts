export declare const expertCaseOwnershipService: {
    enabled(): boolean;
    ensureCapacity(email: string): Promise<any>;
    claim(params: {
        caseId: string;
        ownerEmail: string;
        reason?: string;
    }): Promise<{
        caseId: string;
        leaseToken: string;
        leaseExpiresAt: string;
    }>;
    renewLease(params: {
        caseId: string;
        ownerEmail: string;
        leaseToken: string;
    }): Promise<{
        leaseExpiresAt: string;
    }>;
    release(params: {
        caseId: string;
        ownerEmail: string;
        leaseToken?: string | null;
        reason?: string;
        countInterruption?: boolean;
    }): Promise<void>;
    reaperExpiredLeases(limit?: number): Promise<number>;
    setAvailability(params: {
        email: string;
        availability: "accepting" | "paused" | "draining" | "offline";
        reason?: string;
        pausedUntil?: string | null;
    }): Promise<void>;
};
//# sourceMappingURL=expert-case-ownership.service.d.ts.map