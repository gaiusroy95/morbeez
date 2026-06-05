export type GstBreakup = {
    cgst: number;
    sgst: number;
    igst: number;
    totalGst: number;
};
export declare function computeGstBreakup(params: {
    taxableAmount: number;
    gstPercent: number;
    companyState: string;
    customerState: string;
}): GstBreakup;
export declare function normalizeIndianState(state: string | null | undefined): string;
//# sourceMappingURL=gst.d.ts.map