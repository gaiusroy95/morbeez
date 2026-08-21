export const DISPUTE_STATUSES = ['open', 'upheld', 'rejected'];
export function disputeAdjustmentInr(originalInr, disputedInr) {
    const original = Math.max(0, Number(originalInr) || 0);
    const asked = disputedInr == null ? original : Math.max(0, Number(disputedInr) || 0);
    return Math.round(Math.min(original, asked) * 100) / 100;
}
/** Adjustment is a new negative row. Original earning is never deleted or rewritten. */
export function adjustmentRow(input) {
    return {
        parentEarningId: input.originalId,
        amountInr: -disputeAdjustmentInr(input.originalInr, input.disputedInr),
        reason: input.reason,
    };
}
//# sourceMappingURL=dispute-adjustment.js.map