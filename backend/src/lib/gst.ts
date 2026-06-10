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
export function computeInclusiveGstBreakup(params: {
  inclusiveAmount: number;
  gstPercent: number;
  companyState: string;
  customerState: string;
}): InclusiveGstLine {
  const inclusive = Math.max(0, Number(params.inclusiveAmount) || 0);
  const rate = Math.max(0, Number(params.gstPercent) || 0);
  const divisor = 100 + rate;
  const taxableAmount =
    divisor > 0 ? Math.round((inclusive * 10000) / divisor) / 100 : inclusive;
  const totalGst = Math.round((inclusive - taxableAmount) * 100) / 100;

  const company = (params.companyState ?? '').trim().toLowerCase();
  const customer = (params.customerState ?? '').trim().toLowerCase();
  const sameState = company.length > 0 && customer.length > 0 && company === customer;

  if (sameState) {
    const half = Math.round((totalGst / 2) * 100) / 100;
    return {
      taxableAmount,
      inclusiveAmount: inclusive,
      cgst: half,
      sgst: totalGst - half,
      igst: 0,
      totalGst,
    };
  }

  return {
    taxableAmount,
    inclusiveAmount: inclusive,
    cgst: 0,
    sgst: 0,
    igst: totalGst,
    totalGst,
  };
}

export function computeGstBreakup(params: {
  taxableAmount: number;
  gstPercent: number;
  companyState: string;
  customerState: string;
}): GstBreakup {
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

export function normalizeIndianState(state: string | null | undefined): string {
  return (state ?? '').trim();
}
