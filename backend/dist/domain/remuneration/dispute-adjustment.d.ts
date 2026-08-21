export declare const DISPUTE_STATUSES: readonly ["open", "upheld", "rejected"];
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];
export declare function disputeAdjustmentInr(originalInr: number, disputedInr?: number | null): number;
/** Adjustment is a new negative row. Original earning is never deleted or rewritten. */
export declare function adjustmentRow(input: {
    originalId: string;
    originalInr: number;
    disputedInr?: number | null;
    reason: string;
}): {
    parentEarningId: string;
    amountInr: number;
    reason: string;
};
//# sourceMappingURL=dispute-adjustment.d.ts.map