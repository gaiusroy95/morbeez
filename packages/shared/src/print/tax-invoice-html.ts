/** Shared Morbeez GST tax invoice HTML — same layout as morbeez-staff WarehousePrintPage. */

export type TaxInvoiceCompany = {
  companyName: string;
  formattedAddress: string;
  gstin: string;
  customerCareNumber: string;
  quotationLogoUrl?: string;
  termsAndConditions?: string;
};

/** Web origin or bundled asset URI for logo fallbacks. */
export type TaxInvoiceRenderOptions = {
  /** Prefix for relative logo paths such as /logo.png (staff console). */
  assetBaseUrl?: string;
  /** Used when company logo is missing or fails to load (mobile bundled asset). */
  fallbackLogoUrl?: string;
};

type GstSlabRow = {
  gstPercent: number;
  halfPercent: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
};

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInr(n: unknown): string {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatQty(n: unknown): string {
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatGstRate(n: unknown): string {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
}

function jsString(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '').replace(/\n/g, '');
}

function resolveInvoiceLogoUrl(
  raw: string | undefined,
  options?: TaxInvoiceRenderOptions
): { primary: string; fallback: string } {
  const trimmed = raw?.trim() ?? '';
  const base = options?.assetBaseUrl?.replace(/\/$/, '') ?? '';
  const fallback =
    options?.fallbackLogoUrl?.trim() ||
    (base ? `${base}/logo.png` : '');

  let primary = trimmed;
  if (primary.startsWith('/') && base) {
    primary = `${base}${primary}`;
  }
  if (!primary && fallback) {
    primary = fallback;
  }

  return { primary, fallback: fallback || primary };
}

function invoiceLogoHtml(company: TaxInvoiceCompany, options?: TaxInvoiceRenderOptions): string {
  const { primary, fallback } = resolveInvoiceLogoUrl(company.quotationLogoUrl, options);
  if (!primary) return '';
  const onError =
    fallback && fallback !== primary
      ? ` onerror="this.onerror=null;this.src='${jsString(fallback)}';"`
      : '';
  return `<img src="${esc(primary)}" alt="Morbeez" class="inv-logo"${onError} />`;
}

function buildGstSlabSummary(lines: Array<Record<string, unknown>>): GstSlabRow[] {
  const slabMap = new Map<number, { cgst: number; sgst: number; igst: number }>();
  for (const l of lines) {
    const pct = Number(l.gstPercent) || 0;
    const prev = slabMap.get(pct) ?? { cgst: 0, sgst: 0, igst: 0 };
    prev.cgst += Number(l.cgst) || 0;
    prev.sgst += Number(l.sgst) || 0;
    prev.igst += Number(l.igst) || 0;
    slabMap.set(pct, prev);
  }
  return [...slabMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([gstPercent, taxes]) => ({
      gstPercent,
      halfPercent: Math.round(gstPercent * 50) / 100,
      cgst: taxes.cgst,
      sgst: taxes.sgst,
      igst: taxes.igst,
      totalTax: taxes.cgst + taxes.sgst + taxes.igst,
    }));
}

export const TAX_INVOICE_CSS = `
.inv-doc { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #111; line-height: 1.35; }
.inv-header { display: grid; grid-template-columns: 120px 1fr 140px; gap: 12px; align-items: start; border-bottom: 2px solid #166534; padding-bottom: 10px; margin-bottom: 10px; }
.inv-logo { display: block; width: auto; max-width: 130px; max-height: 72px; height: auto; object-fit: contain; }
.inv-header-company h1 { margin: 0 0 4px; font-size: 1.15rem; font-weight: 800; text-transform: uppercase; }
.inv-header-company p { margin: 0 0 2px; }
.inv-gstin { font-weight: 700; }
.inv-header-title h2 { margin: 0; font-size: 1.35rem; font-weight: 800; text-align: right; letter-spacing: 0.04em; }
.inv-meta-table, .inv-lines-table, .inv-hsn-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
.inv-meta-table th, .inv-meta-table td, .inv-lines-table th, .inv-lines-table td, .inv-hsn-table th, .inv-hsn-table td { border: 1px solid #cbd5e1; padding: 5px 7px; vertical-align: top; }
.inv-meta-table th, .inv-lines-table th, .inv-hsn-table th { background: #f8fafc; font-weight: 700; text-align: left; width: 18%; }
.inv-lines-table th { text-align: center; }
.inv-lines-subhead th { font-size: 10px; padding: 2px 4px; }
.inv-col-num { width: 28px; }
.inv-col-item { min-width: 180px; text-align: left !important; }
.inv-num { text-align: right !important; white-space: nowrap; }
.inv-item-cell { text-align: left !important; }
.inv-item-cell strong { display: block; }
.inv-sku { display: block; font-size: 10px; color: #475569; }
.inv-address-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.inv-address-box { border: 1px solid #cbd5e1; padding: 8px 10px; min-height: 72px; }
.inv-address-box h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; }
.inv-address-box p { margin: 0 0 2px; }
.inv-address-name { font-weight: 700; }
.inv-bank-section { border-top: 2px dashed #94a3b8; margin-top: 14px; padding-top: 10px; }
.inv-bank-title { margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
.inv-bank-table { width: 100%; max-width: 480px; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
.inv-bank-table th, .inv-bank-table td { border: 1px solid #cbd5e1; padding: 6px 10px; vertical-align: top; }
.inv-bank-table th { background: #f8fafc; font-weight: 700; text-align: left; width: 38%; white-space: nowrap; }
.inv-bank-table td { font-weight: 600; }
.inv-footer-block { margin-top: 16px; }
.inv-footer-main { display: grid; grid-template-columns: 1fr 240px; gap: 14px; margin-bottom: 12px; }
.inv-words { font-weight: 600; margin-bottom: 10px; }
.inv-terms-plain { font-size: 10px; color: #334155; margin: 8px 0; }
.inv-jurisdiction { font-size: 10px; font-weight: 700; text-transform: uppercase; margin-top: 8px; }
.inv-footer-totals table { width: 100%; border-collapse: collapse; font-size: 11px; }
.inv-footer-totals th, .inv-footer-totals td { border: 1px solid #cbd5e1; padding: 5px 8px; }
.inv-footer-totals th { text-align: left; background: #f8fafc; }
.inv-footer-totals td { text-align: right; }
.inv-total-row th, .inv-total-row td { font-size: 12px; }
.inv-for-company { margin-top: 24px; text-align: right; font-weight: 700; }
.inv-hsn-total td { background: #f8fafc; }
.inv-computer-note { margin-top: 12px; font-size: 10px; color: #64748b; }
`;

export function buildTaxInvoiceHtml(
  doc: Record<string, unknown>,
  company: TaxInvoiceCompany,
  options?: TaxInvoiceRenderOptions
): string {
  const lines = (doc.lines as Array<Record<string, unknown>>) ?? [];
  const tax = doc.taxBreakup as { sameState?: boolean; cgst?: number; sgst?: number; igst?: number };
  const sameState = Boolean(tax?.sameState);
  const billTo = (doc.billTo as string[]) ?? [];
  const shipTo = (doc.shipTo as string[]) ?? [];
  const hsnSummary = (doc.hsnSummary as Array<Record<string, unknown>>) ?? [];
  const bank = doc.bankDetails as Record<string, string | null> | undefined;
  const bankRows = [
    { label: 'Name', value: bank?.accountName },
    { label: 'Account Number', value: bank?.accountNumber },
    { label: 'Bank Name', value: bank?.bankName },
    { label: 'Branch', value: bank?.branch },
    { label: 'IFSC Code', value: bank?.ifsc },
  ].filter((row) => row.value);
  const gstSlabSummary =
    (doc.gstSlabSummary as GstSlabRow[] | undefined)?.length
      ? (doc.gstSlabSummary as GstSlabRow[])
      : buildGstSlabSummary(lines);

  const logoHtml = invoiceLogoHtml(company, options);
  const addressLines = company.formattedAddress.split('\n').map((line) => `<p>${esc(line)}</p>`).join('');

  const lineRows = lines
    .map((l, i) => {
      const halfPct = l.halfGstPercent ?? Number(l.gstPercent) / 2;
      const taxCells = sameState
        ? `<td class="inv-num">${formatGstRate(halfPct)}%</td><td class="inv-num">${formatInr(l.cgst)}</td><td class="inv-num">${formatGstRate(halfPct)}%</td><td class="inv-num">${formatInr(l.sgst)}</td>`
        : `<td class="inv-num">${formatGstRate(l.gstPercent)}%</td><td class="inv-num">${formatInr(l.igst)}</td>`;
      const skuParts = [
        l.sku ? `<span class="inv-sku">SKU: ${esc(l.sku)}</span>` : '',
        l.batchCode ? `<span class="inv-sku">Batch: ${esc(l.batchCode)}</span>` : '',
      ].join('');
      return `<tr>
        <td>${i + 1}</td>
        <td class="inv-item-cell"><strong>${esc(l.description)}</strong>${skuParts}</td>
        <td>${esc(l.hsnCode ?? '—')}</td>
        <td class="inv-num">${formatQty(l.qty)}</td>
        <td class="inv-num">${formatInr(l.unitPrice)}</td>
        ${taxCells}
        <td class="inv-num">${formatInr(l.lineTotal ?? l.unitPrice)}</td>
      </tr>`;
    })
    .join('');

  const gstHeader = sameState
    ? `<th colspan="2">CGST</th><th colspan="2">SGST</th>`
    : `<th colspan="2">IGST</th>`;
  const gstSubhead = sameState
    ? `<th>%</th><th>Amt</th><th>%</th><th>Amt</th>`
    : `<th>%</th><th>Amt</th>`;

  const slabTotalRows = sameState
    ? gstSlabSummary
        .flatMap(
          (slab) =>
            `<tr><th>CGST ${formatGstRate(slab.halfPercent)}%</th><td>${formatInr(slab.cgst)}</td></tr>` +
            `<tr><th>SGST ${formatGstRate(slab.halfPercent)}%</th><td>${formatInr(slab.sgst)}</td></tr>`
        )
        .join('')
    : gstSlabSummary
        .map((slab) => `<tr><th>IGST ${formatGstRate(slab.gstPercent)}%</th><td>${formatInr(slab.igst)}</td></tr>`)
        .join('');

  const hsnRows = hsnSummary
    .map((row) => {
      const taxCells = sameState
        ? `<td>${formatGstRate(row.halfPercent ?? Number(row.gstPercent) / 2)}%</td><td class="inv-num">${formatInr(row.cgst)}</td><td>${formatGstRate(row.halfPercent ?? Number(row.gstPercent) / 2)}%</td><td class="inv-num">${formatInr(row.sgst)}</td>`
        : `<td>${formatGstRate(row.gstPercent)}%</td><td class="inv-num">${formatInr(row.igst)}</td>`;
      return `<tr><td>${esc(row.hsn)}</td><td class="inv-num">${formatInr(row.taxableAmount)}</td>${taxCells}<td class="inv-num">${formatInr(row.totalTax)}</td></tr>`;
    })
    .join('');

  const hsnTotalCells = sameState
    ? `<td></td><td class="inv-num"><strong>${formatInr(doc.cgst)}</strong></td><td></td><td class="inv-num"><strong>${formatInr(doc.sgst)}</strong></td>`
    : `<td></td><td class="inv-num"><strong>${formatInr(doc.igst)}</strong></td>`;

  const hsnHeader = sameState
    ? `<th colspan="2">CGST</th><th colspan="2">SGST</th>`
    : `<th colspan="2">IGST</th>`;
  const hsnSubhead = sameState
    ? `<th>Rate</th><th>Amount</th><th>Rate</th><th>Amount</th>`
    : `<th>Rate</th><th>Amount</th>`;

  const bankSection =
    bankRows.length > 0
      ? `<section class="inv-bank-section"><h3 class="inv-bank-title">Company's Bank Details</h3><table class="inv-bank-table"><tbody>${bankRows
          .map((row) => `<tr><th>${esc(row.label)}</th><td>${esc(row.value)}</td></tr>`)
          .join('')}</tbody></table></section>`
      : '';

  const codRow =
    Number(doc.codAmount) > 0
      ? `<tr><th>Payment to be Collected</th><td colspan="3">${formatInr(doc.codAmount)}</td></tr>`
      : '';

  const termsHtml = company.termsAndConditions
    ? `<div class="inv-terms">${company.termsAndConditions}</div>`
    : `<p class="inv-terms-plain">We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>`;

  return `<div class="inv-doc">
    <header class="inv-header">
      <div class="inv-header-logo">${logoHtml}</div>
      <div class="inv-header-company">
        <h1>${esc(company.companyName)}</h1>
        ${addressLines}
        ${company.customerCareNumber ? `<p>Phone: ${esc(company.customerCareNumber)}</p>` : ''}
        ${company.gstin ? `<p class="inv-gstin">GSTIN ${esc(company.gstin)}</p>` : ''}
      </div>
      <div class="inv-header-title"><h2>TAX INVOICE</h2></div>
    </header>
    <table class="inv-meta-table"><tbody>
      <tr><th>Invoice Number</th><td>${esc(doc.invoiceNumber)}</td><th>Place Of Supply</th><td>${esc(doc.placeOfSupply ?? doc.customerState ?? '—')}</td></tr>
      <tr><th>Invoice Date</th><td>${esc(doc.invoiceDate ?? '—')}</td><th>Terms Of Delivery</th><td>${esc(doc.termsOfDelivery ?? '—')}</td></tr>
      <tr><th>Payment Terms</th><td>${esc(doc.paymentTerms ?? doc.paymentMethod ?? '—')}</td><th>Terms of Payment</th><td>${esc(doc.paymentMethod ?? '—')}</td></tr>
      <tr><th>Order</th><td>${esc(doc.orderName ?? '—')}</td><th>Order Date</th><td>${esc(doc.orderDate ?? '—')}</td></tr>
      ${codRow}
    </tbody></table>
    <div class="inv-address-row">
      <div class="inv-address-box">
        <h3>Bill To</h3>
        <p class="inv-address-name">${esc(doc.customerName ?? billTo[0] ?? '—')}</p>
        ${billTo.slice(1).map((line) => `<p>${esc(line)}</p>`).join('')}
        ${doc.customerGstin ? `<p>GSTIN: ${esc(doc.customerGstin)}</p>` : ''}
      </div>
      <div class="inv-address-box">
        <h3>Ship To</h3>
        ${shipTo.length ? shipTo.map((line) => `<p>${esc(line)}</p>`).join('') : `<p>${esc(doc.customerName ?? '—')}</p>`}
      </div>
    </div>
    <table class="inv-lines-table">
      <thead>
        <tr>
          <th class="inv-col-num">#</th>
          <th class="inv-col-item">Item &amp; Description</th>
          <th>HSN/SAC</th>
          <th>Qty</th>
          <th>Rate</th>
          ${gstHeader}
          <th>Amount</th>
        </tr>
        <tr class="inv-lines-subhead"><th colspan="5"></th>${gstSubhead}<th></th></tr>
      </thead>
      <tbody>${lineRows}</tbody>
    </table>
    ${bankSection}
    <div class="inv-footer-block">
      <div class="inv-footer-main">
        <div class="inv-footer-left">
          <p><strong>Total In Words</strong></p>
          <p class="inv-words">${esc(doc.totalInWords ?? '')}</p>
          ${termsHtml}
          <p class="inv-jurisdiction">${esc(doc.jurisdictionNote ?? '')}</p>
        </div>
        <div class="inv-footer-totals">
          <table><tbody>
            <tr><th>Sub Total (Tax Inclusive)</th><td>${formatInr(doc.subtotalInclusive ?? doc.total)}</td></tr>
            <tr><th>Total Taxable Amount</th><td>${formatInr(doc.subtotal)}</td></tr>
            ${slabTotalRows}
            <tr class="inv-total-row"><th>Total</th><td><strong>${formatInr(doc.total)}</strong></td></tr>
            <tr class="inv-total-row"><th>Balance Due</th><td><strong>${formatInr(doc.balanceDue ?? doc.total)}</strong></td></tr>
          </tbody></table>
          <p class="inv-for-company">For ${esc(company.companyName)}</p>
        </div>
      </div>
      <table class="inv-hsn-table">
        <thead>
          <tr><th rowspan="2">HSN/SAC</th><th rowspan="2">Taxable Amount</th>${hsnHeader}<th rowspan="2">Total Tax Amount</th></tr>
          <tr>${hsnSubhead}</tr>
        </thead>
        <tbody>
          ${hsnRows}
          <tr class="inv-hsn-total">
            <td><strong>Total</strong></td>
            <td class="inv-num"><strong>${formatInr(doc.subtotal)}</strong></td>
            ${hsnTotalCells}
            <td class="inv-num"><strong>${formatInr(Number(doc.cgst) + Number(doc.sgst) + Number(doc.igst))}</strong></td>
          </tr>
        </tbody>
      </table>
      <p class="inv-computer-note">This is a computer-generated invoice. No signature is required.</p>
    </div>
  </div>`;
}
