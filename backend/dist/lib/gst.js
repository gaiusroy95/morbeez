export function computeGstBreakup(params) {
    const taxable = Math.max(0, Number(params.taxableAmount) || 0);
    const rate = Math.max(0, Number(params.gstPercent) || 0);
    const totalGst = Math.round((taxable * rate) / 100 * 100) / 100;
    const company = (params.companyState ?? '').trim().toLowerCase();
    const customer = (params.customerState ?? '').trim().toLowerCase();
    const sameState = company.length > 0 && customer.length > 0 && company === customer;
    if (sameState) {
        const half = Math.round((totalGst / 2) * 100) / 100;
        return { cgst: half, sgst: totalGst - half, igst: 0, totalGst };
    }
    return { cgst: 0, sgst: 0, igst: totalGst, totalGst };
}
export function normalizeIndianState(state) {
    return (state ?? '').trim();
}
//# sourceMappingURL=gst.js.map