export type PrintDocType =
  | 'picking_slip'
  | 'packing_slip'
  | 'tax_invoice'
  | 'courier_label'
  | 'return_inspection';

export type PrintPayload = {
  ok?: boolean;
  type: PrintDocType;
  company: {
    companyName: string;
    formattedAddress: string;
    gstin: string;
    customerCareNumber: string;
    quotationLogoUrl?: string;
    termsAndConditions?: string;
  };
  document: Record<string, unknown>;
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

const BASE_CSS = `
  body { font-family: system-ui, sans-serif; font-size: 13px; color: #1a2e24; margin: 16px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  h2 { font-size: 16px; margin: 16px 0 8px; }
  h3 { font-size: 14px; margin: 12px 0 6px; }
  .muted { color: #6b7c72; }
  .mono { font-family: monospace; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { border: 1px solid #e5ebe7; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #e8f5ec; font-weight: 600; }
  .header { display: flex; gap: 16px; margin-bottom: 16px; border-bottom: 2px solid #215c3a; padding-bottom: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .label-box { border: 2px solid #000; padding: 12px; max-width: 400px; }
  .qr { font-size: 18px; font-weight: 700; letter-spacing: 1px; word-break: break-all; }
`;

function pickingSlipHtml(doc: Record<string, unknown>): string {
  const lines = (doc.lines as Array<Record<string, unknown>>) ?? [];
  const rows = lines
    .map(
      (l) =>
        `<tr><td class="mono">${esc(l.sku)}</td><td>${esc(l.productTitle)}</td><td>${esc(l.batchCode)}</td><td class="mono">${esc(l.rackLocation)}</td><td>${esc(l.qty)}</td><td class="mono">${esc(l.qrPayload)}</td></tr>`
    )
    .join('');
  return `
    <p><strong>Order:</strong> ${esc(doc.orderId)} | <strong>Pick list:</strong> ${esc(String(doc.pickListId ?? '').slice(0, 8))}…</p>
    <table><thead><tr><th>SKU</th><th>Product</th><th>Batch</th><th>Rack</th><th>Qty</th><th>Scan</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function packingSlipHtml(doc: Record<string, unknown>): string {
  const lines = (doc.lines as Array<Record<string, unknown>>) ?? [];
  const addr = ((doc.shippingAddress as string[]) ?? []).map((l) => `<p>${esc(l)}</p>`).join('');
  const rows = lines
    .map(
      (l) =>
        `<tr><td>${esc(l.productTitle)}</td><td>${esc(l.sku)}</td><td>${esc(l.batchCode)}</td><td>${esc(l.qty)}</td></tr>`
    )
    .join('');
  return `
    <div class="grid">
      <div><h3>Ship to</h3><p>${esc(doc.customerName)}</p>${addr}${doc.phone ? `<p>Phone: ${esc(doc.phone)}</p>` : ''}</div>
      <div><p><strong>Order:</strong> ${esc(doc.orderId)}</p><p><strong>Weight:</strong> ${esc(doc.totalWeightKg)} kg</p></div>
    </div>
    <table><thead><tr><th>Product</th><th>SKU</th><th>Batch</th><th>Qty</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function courierLabelHtml(doc: Record<string, unknown>): string {
  return `
    <div class="label-box">
      <p><strong>To:</strong> ${esc(doc.customerName)}</p>
      <p>${esc(doc.addressLine1)}</p>
      <p>${esc(doc.city)} ${esc(doc.state)} ${esc(doc.pincode)}</p>
      <p><strong>Phone:</strong> ${esc(doc.phone)}</p>
      <hr />
      <p><strong>Order:</strong> ${esc(doc.orderName ?? doc.orderId)}</p>
      <p><strong>AWB:</strong> <span class="mono">${esc(doc.awb)}</span></p>
      <p><strong>Courier:</strong> ${esc(doc.courierName)}</p>
      ${doc.codAmount ? `<p><strong>COD:</strong> ${formatInr(doc.codAmount)}</p>` : ''}
      <p class="qr">${esc(doc.qrCode ?? doc.barcode)}</p>
    </div>`;
}

function taxInvoiceHtml(doc: Record<string, unknown>, company: PrintPayload['company']): string {
  const lines = (doc.lines as Array<Record<string, unknown>>) ?? [];
  const rows = lines
    .map(
      (l, i) =>
        `<tr><td>${i + 1}</td><td>${esc(l.description)}<br/><span class="muted">${esc(l.sku)}</span></td><td>${esc(l.hsnCode)}</td><td>${esc(l.qty)}</td><td>${formatInr(l.unitPrice)}</td><td>${formatInr(l.lineTotal ?? l.unitPrice)}</td></tr>`
    )
    .join('');
  return `
    <div class="header">
      <div><h1>${esc(company.companyName)}</h1><p class="muted">${esc(company.formattedAddress)}</p>${company.gstin ? `<p>GSTIN ${esc(company.gstin)}</p>` : ''}</div>
      <div><h2>TAX INVOICE</h2><p># ${esc(doc.invoiceNumber)}</p><p>Date: ${esc(doc.invoiceDate)}</p></div>
    </div>
    <p><strong>Bill to:</strong> ${esc(doc.customerName)}</p>
    <table><thead><tr><th>#</th><th>Item</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <p><strong>Total:</strong> ${formatInr(doc.total)}</p>
    <p class="muted">${esc(doc.totalInWords)}</p>`;
}

function returnInspectionHtml(doc: Record<string, unknown>): string {
  return `<p><strong>Return:</strong> ${esc(doc.returnNumber ?? doc.id)}</p><p>Status: ${esc(doc.status)}</p><p>${esc(doc.notes)}</p>`;
}

export function buildDocumentHtml(payload: PrintPayload): string {
  const { company, document: doc, type } = payload;
  let body = '';
  if (type === 'tax_invoice') {
    body = taxInvoiceHtml(doc, company);
  } else if (type === 'picking_slip') {
    body = pickingSlipHtml(doc);
  } else if (type === 'packing_slip') {
    body = packingSlipHtml(doc);
  } else if (type === 'courier_label') {
    body = courierLabelHtml(doc);
  } else if (type === 'return_inspection') {
    body = returnInspectionHtml(doc);
  } else {
    body = `<pre>${esc(JSON.stringify(doc, null, 2))}</pre>`;
  }

  const title = type === 'tax_invoice' ? 'Tax Invoice' : String(doc.title ?? type.replace(/_/g, ' '));

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title><style>${BASE_CSS}</style></head><body>
    ${
      type !== 'tax_invoice' && type !== 'courier_label'
        ? `<div class="header"><div><h1>${esc(title)}</h1><p class="muted">${esc(company.companyName)}</p><p class="muted">${esc(company.formattedAddress)}</p></div></div>`
        : ''
    }
    ${body}
  </body></html>`;
}
