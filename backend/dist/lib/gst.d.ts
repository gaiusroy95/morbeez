export type GstBreakup = {
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
};
export type InclusiveGstLine = GstBreakup & {
    taxableAmount: number;
    inclusiveAmount: number;
};
/** Unit/line prices that already include GST (e.g. ₹50 inclusive of 18% → taxable ₹42.37). */
export declare function computeInclusiveGstBreakup(params: {
    inclusiveAmount: number;
    gstPercent: number;
    companyState: string;
    customerState: string;
}): InclusiveGstLine;
export declare function computeGstBreakup(params: {
    taxableAmount: number;
    gstPercent: number;
    companyState: string;
    customerState: string;
}): GstBreakup;
export declare function normalizeIndianState(state: string | null | undefined): string;
/** CGST/SGST rate is half of the GST slab (18% slab → 9% each). */
export declare function halfGstRate(gstPercent: number): number;
/** Round invoice-level totals and reconcile GST split to match inclusive − taxable. */
export declare function finalizeInclusiveInvoiceTotals(params: {
    subtotalTaxable: number;
    subtotalInclusive: number;
    cgst: number;
    sgst: number;
    igst: number;
    sameState: boolean;
}): {
    subtotalTaxable: number;
    subtotalInclusive: number;
    cgst: number;
    sgst: number;
    igst: number;
    total: number;
};
//# sourceMappingURL=gst.d.ts.map