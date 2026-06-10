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
//# sourceMappingURL=gst.d.ts.map