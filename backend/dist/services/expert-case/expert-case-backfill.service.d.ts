/**
 * Shadow backfill: link open escalations into expert_cases without changing
 * legacy queue behavior. Safe to re-run (idempotent per escalation link).
 */
export declare const expertCaseBackfillService: {
    backfillOpenEscalations(limit?: number): Promise<{
        scanned: number;
        created: number;
        merged: number;
        skipped: number;
        errors: number;
    }>;
    reconcileLinkedEscalations(limit?: number): Promise<{
        checked: number;
        repaired: number;
    }>;
};
//# sourceMappingURL=expert-case-backfill.service.d.ts.map