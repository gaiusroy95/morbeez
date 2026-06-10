import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { paths, toPath } from '../lib/routes';
import { Alert, Btn, Loading } from '../components/ui';
import '../styles/warehouse-print.css';

type DocType = 'picking_slip' | 'packing_slip' | 'tax_invoice' | 'courier_label' | 'return_inspection';

type PrintPayload = {
  ok: boolean;
  type: DocType;
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

function formatInr(n: unknown) {
  const v = Number(n) || 0;
  return `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function WarehousePrintPage() {
  const { docType = '', entityId = '' } = useParams();
  const [data, setData] = useState<PrintPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<PrintPayload>(`/morbeez-staff/api/v1/os/warehouse/documents/${docType}/${entityId}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Document not found'))
      .finally(() => setLoading(false));
  }, [docType, entityId]);

  if (loading) return <Loading label="Loading document…" />;
  if (error || !data) return <Alert tone="error">{error || 'Document not found'}</Alert>;

  const { company, document: doc, type } = data;

  return (
    <div className="warehouse-print-page">
      <div className="warehouse-print-toolbar no-print">
        <Btn size="sm" onClick={() => window.print()}>
          Print
        </Btn>
        <Link className="btn btn-secondary btn-sm" to={toPath(paths.warehouse)}>
          Back to warehouse
        </Link>
      </div>

      <article className={`warehouse-print-doc warehouse-print-doc--${type}`}>
        {type === 'tax_invoice' ? (
          <TaxInvoiceBody doc={doc} company={company} formatInr={formatInr} />
        ) : (
          <>
            <header className="warehouse-print-header">
              {company.quotationLogoUrl ? (
                <img src={company.quotationLogoUrl} alt="" className="warehouse-print-logo" />
              ) : null}
              <div>
                <h1>{String(doc.title ?? type)}</h1>
                <p className="muted">{company.companyName}</p>
                <p className="muted">{company.formattedAddress}</p>
                {company.gstin ? <p className="muted">GSTIN: {company.gstin}</p> : null}
              </div>
            </header>

            {type === 'picking_slip' ? <PickingSlipBody doc={doc} /> : null}
            {type === 'packing_slip' ? <PackingSlipBody doc={doc} /> : null}
            {type === 'courier_label' ? <CourierLabelBody doc={doc} formatInr={formatInr} /> : null}
            {type === 'return_inspection' ? <ReturnInspectionBody doc={doc} formatInr={formatInr} /> : null}
          </>
        )}
      </article>
    </div>
  );
}

function PickingSlipBody({ doc }: { doc: Record<string, unknown> }) {
  const lines = (doc.lines as Array<Record<string, unknown>>) ?? [];
  return (
    <section>
      <p>
        <strong>Order:</strong> {String(doc.orderId)} &nbsp;|&nbsp;
        <strong>Pick list:</strong> {String(doc.pickListId).slice(0, 8)}…
        {doc.pickerId ? (
          <>
            &nbsp;|&nbsp;<strong>Picker:</strong> {String(doc.pickerId)}
          </>
        ) : null}
      </p>
      <table className="warehouse-print-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product</th>
            <th>Batch</th>
            <th>Rack</th>
            <th>Qty</th>
            <th>Scan code</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="mono">{String(l.sku ?? '—')}</td>
              <td>{String(l.productTitle)}</td>
              <td>{String(l.batchCode ?? '—')}</td>
              <td className="mono">{String(l.rackLocation ?? '—')}</td>
              <td>{String(l.qty)}</td>
              <td className="mono">{String(l.qrPayload ?? '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PackingSlipBody({ doc }: { doc: Record<string, unknown> }) {
  const lines = (doc.lines as Array<Record<string, unknown>>) ?? [];
  const addr = (doc.shippingAddress as string[]) ?? [];
  return (
    <section>
      <div className="warehouse-print-grid">
        <div>
          <h3>Ship to</h3>
          <p>{String(doc.customerName)}</p>
          {addr.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          {doc.phone ? <p>Phone: {String(doc.phone)}</p> : null}
        </div>
        <div>
          <p>
            <strong>Order:</strong> {String(doc.orderId)}
          </p>
          <p>
            <strong>Weight (units):</strong> {String(doc.totalWeightKg)}
          </p>
          {doc.specialInstructions ? (
            <p>
              <strong>Instructions:</strong> {String(doc.specialInstructions)}
            </p>
          ) : null}
        </div>
      </div>
      <table className="warehouse-print-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Batch</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td>{String(l.productTitle)}</td>
              <td>{String(l.sku ?? '—')}</td>
              <td>{String(l.batchCode ?? '—')}</td>
              <td>{String(l.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function formatQty(n: unknown) {
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatGstRate(n: unknown) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '');
}

type GstSlabRow = {
  gstPercent: number;
  halfPercent: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
};

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

function TaxInvoiceBody({
  doc,
  company,
  formatInr,
}: {
  doc: Record<string, unknown>;
  company: PrintPayload['company'];
  formatInr: (n: unknown) => string;
}) {
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
  const hasBankDetails = bankRows.length > 0;
  const gstSlabSummary =
    (doc.gstSlabSummary as GstSlabRow[] | undefined)?.length
      ? (doc.gstSlabSummary as GstSlabRow[])
      : buildGstSlabSummary(lines);

  const invoiceLogo = company.quotationLogoUrl?.trim() || '/logo.png';

  return (
    <div className="inv-doc">
      <header className="inv-header">
        <div className="inv-header-logo">
          <img
            src={invoiceLogo}
            alt="Morbeez"
            className="inv-logo"
            onError={(e) => {
              const img = e.currentTarget;
              if (!img.dataset.fallback) {
                img.dataset.fallback = '1';
                img.src = '/logo1.png';
              }
            }}
          />
        </div>
        <div className="inv-header-company">
          <h1>{company.companyName}</h1>
          {company.formattedAddress.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          {company.customerCareNumber ? <p>Phone: {company.customerCareNumber}</p> : null}
          {company.gstin ? <p className="inv-gstin">GSTIN {company.gstin}</p> : null}
        </div>
        <div className="inv-header-title">
          <h2>TAX INVOICE</h2>
        </div>
      </header>

      <table className="inv-meta-table">
        <tbody>
          <tr>
            <th>Invoice Number</th>
            <td>{String(doc.invoiceNumber)}</td>
            <th>Place Of Supply</th>
            <td>{String(doc.placeOfSupply ?? doc.customerState ?? '—')}</td>
          </tr>
          <tr>
            <th>Invoice Date</th>
            <td>{String(doc.invoiceDate ?? '—')}</td>
            <th>Terms Of Delivery</th>
            <td>{String(doc.termsOfDelivery ?? '—')}</td>
          </tr>
          <tr>
            <th>Payment Terms</th>
            <td>{String(doc.paymentTerms ?? doc.paymentMethod ?? '—')}</td>
            <th>Terms of Payment</th>
            <td>{String(doc.paymentMethod ?? '—')}</td>
          </tr>
          <tr>
            <th>Order</th>
            <td>{String(doc.orderName ?? '—')}</td>
            <th>Order Date</th>
            <td>{String(doc.orderDate ?? '—')}</td>
          </tr>
          {Number(doc.codAmount) > 0 ? (
            <tr>
              <th>Payment to be Collected</th>
              <td colSpan={3}>{formatInr(doc.codAmount)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="inv-address-row">
        <div className="inv-address-box">
          <h3>Bill To</h3>
          <p className="inv-address-name">{String(doc.customerName ?? billTo[0] ?? '—')}</p>
          {billTo.slice(1).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          {doc.customerGstin ? <p>GSTIN: {String(doc.customerGstin)}</p> : null}
        </div>
        <div className="inv-address-box">
          <h3>Ship To</h3>
          {shipTo.length ? (
            shipTo.map((line, i) => <p key={i}>{line}</p>)
          ) : (
            <p>{String(doc.customerName ?? '—')}</p>
          )}
        </div>
      </div>

      <table className="inv-lines-table">
        <thead>
          <tr>
            <th className="inv-col-num">#</th>
            <th className="inv-col-item">Item &amp; Description</th>
            <th>HSN/SAC</th>
            <th>Qty</th>
            <th>Rate</th>
            {sameState ? (
              <>
                <th colSpan={2}>CGST</th>
                <th colSpan={2}>SGST</th>
              </>
            ) : (
              <th colSpan={2}>IGST</th>
            )}
            <th>Amount</th>
          </tr>
          <tr className="inv-lines-subhead">
            <th colSpan={5} />
            {sameState ? (
              <>
                <th>%</th>
                <th>Amt</th>
                <th>%</th>
                <th>Amt</th>
              </>
            ) : (
              <>
                <th>%</th>
                <th>Amt</th>
              </>
            )}
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td className="inv-item-cell">
                <strong>{String(l.description)}</strong>
                {l.sku ? <span className="inv-sku">SKU: {String(l.sku)}</span> : null}
                {l.batchCode ? <span className="inv-sku">Batch: {String(l.batchCode)}</span> : null}
              </td>
              <td>{String(l.hsnCode ?? '—')}</td>
              <td className="inv-num">{formatQty(l.qty)}</td>
              <td className="inv-num">{formatInr(l.unitPrice)}</td>
              {sameState ? (
                <>
                  <td className="inv-num">
                    {formatGstRate(l.halfGstPercent ?? Number(l.gstPercent) / 2)}%
                  </td>
                  <td className="inv-num">{formatInr(l.cgst)}</td>
                  <td className="inv-num">
                    {formatGstRate(l.halfGstPercent ?? Number(l.gstPercent) / 2)}%
                  </td>
                  <td className="inv-num">{formatInr(l.sgst)}</td>
                </>
              ) : (
                <>
                  <td className="inv-num">{formatGstRate(l.gstPercent)}%</td>
                  <td className="inv-num">{formatInr(l.igst)}</td>
                </>
              )}
              <td className="inv-num">{formatInr(l.lineTotal ?? l.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {hasBankDetails ? (
        <section className="inv-bank-section">
          <h3 className="inv-bank-title">Company&apos;s Bank Details</h3>
          <table className="inv-bank-table">
            <tbody>
              {bankRows.map((row) => (
                <tr key={row.label}>
                  <th>{row.label}</th>
                  <td>{String(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <div className="inv-footer-block inv-page-break">
        <div className="inv-footer-main">
          <div className="inv-footer-left">
            <p>
              <strong>Total In Words</strong>
            </p>
            <p className="inv-words">{String(doc.totalInWords ?? '')}</p>
            {company.termsAndConditions ? (
              <div
                className="inv-terms"
                dangerouslySetInnerHTML={{ __html: company.termsAndConditions }}
              />
            ) : (
              <p className="inv-terms-plain">
                We declare that this invoice shows the actual price of the goods described and that
                all particulars are true and correct.
              </p>
            )}
            <p className="inv-jurisdiction">{String(doc.jurisdictionNote ?? '')}</p>
          </div>
          <div className="inv-footer-totals">
            <table>
              <tbody>
                <tr>
                  <th>Sub Total (Tax Inclusive)</th>
                  <td>{formatInr(doc.subtotalInclusive ?? doc.total)}</td>
                </tr>
                <tr>
                  <th>Total Taxable Amount</th>
                  <td>{formatInr(doc.subtotal)}</td>
                </tr>
                {sameState
                  ? gstSlabSummary.flatMap((slab) => [
                      <tr key={`cgst-${slab.gstPercent}`}>
                        <th>CGST {formatGstRate(slab.halfPercent)}%</th>
                        <td>{formatInr(slab.cgst)}</td>
                      </tr>,
                      <tr key={`sgst-${slab.gstPercent}`}>
                        <th>SGST {formatGstRate(slab.halfPercent)}%</th>
                        <td>{formatInr(slab.sgst)}</td>
                      </tr>,
                    ])
                  : gstSlabSummary.map((slab) => (
                      <tr key={slab.gstPercent}>
                        <th>IGST {formatGstRate(slab.gstPercent)}%</th>
                        <td>{formatInr(slab.igst)}</td>
                      </tr>
                    ))}
                <tr className="inv-total-row">
                  <th>Total</th>
                  <td>
                    <strong>{formatInr(doc.total)}</strong>
                  </td>
                </tr>
                <tr className="inv-total-row">
                  <th>Balance Due</th>
                  <td>
                    <strong>{formatInr(doc.balanceDue ?? doc.total)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="inv-for-company">For {company.companyName}</p>
          </div>
        </div>

        <table className="inv-hsn-table">
          <thead>
            <tr>
              <th rowSpan={2}>HSN/SAC</th>
              <th rowSpan={2}>Taxable Amount</th>
              {sameState ? (
                <>
                  <th colSpan={2}>CGST</th>
                  <th colSpan={2}>SGST</th>
                </>
              ) : (
                <th colSpan={2}>IGST</th>
              )}
              <th rowSpan={2}>Total Tax Amount</th>
            </tr>
            <tr>
              {sameState ? (
                <>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </>
              ) : (
                <>
                  <th>Rate</th>
                  <th>Amount</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {hsnSummary.map((row, i) => (
              <tr key={i}>
                <td>{String(row.hsn)}</td>
                <td className="inv-num">{formatInr(row.taxableAmount)}</td>
                {sameState ? (
                  <>
                    <td>{formatGstRate(row.halfPercent ?? Number(row.gstPercent) / 2)}%</td>
                    <td className="inv-num">{formatInr(row.cgst)}</td>
                    <td>{formatGstRate(row.halfPercent ?? Number(row.gstPercent) / 2)}%</td>
                    <td className="inv-num">{formatInr(row.sgst)}</td>
                  </>
                ) : (
                  <>
                    <td>{formatGstRate(row.gstPercent)}%</td>
                    <td className="inv-num">{formatInr(row.igst)}</td>
                  </>
                )}
                <td className="inv-num">{formatInr(row.totalTax)}</td>
              </tr>
            ))}
            <tr className="inv-hsn-total">
              <td>
                <strong>Total</strong>
              </td>
              <td className="inv-num">
                <strong>{formatInr(doc.subtotal)}</strong>
              </td>
              {sameState ? (
                <>
                  <td />
                  <td className="inv-num">
                    <strong>{formatInr(doc.cgst)}</strong>
                  </td>
                  <td />
                  <td className="inv-num">
                    <strong>{formatInr(doc.sgst)}</strong>
                  </td>
                </>
              ) : (
                <>
                  <td />
                  <td className="inv-num">
                    <strong>{formatInr(doc.igst)}</strong>
                  </td>
                </>
              )}
              <td className="inv-num">
                <strong>{formatInr(Number(doc.cgst) + Number(doc.sgst) + Number(doc.igst))}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        <p className="inv-computer-note">This is a computer-generated invoice. No signature is required.</p>
      </div>
    </div>
  );
}

function CourierLabelBody({
  doc,
  formatInr,
}: {
  doc: Record<string, unknown>;
  formatInr: (n: unknown) => string;
}) {
  const addr = (doc.deliveryAddress as string[]) ?? [];
  return (
    <section className="warehouse-print-courier">
      <p className="warehouse-print-awb mono">{String(doc.awbCode ?? 'AWB pending')}</p>
      <p>
        <strong>{String(doc.courierName)}</strong>
        {doc.dispatchRack ? (
          <>
            &nbsp;|&nbsp; Rack <strong>{String(doc.dispatchRack)}</strong>
          </>
        ) : null}
      </p>
      {doc.shiprocketLabelUrl ? (
        <p>
          <a href={String(doc.shiprocketLabelUrl)} target="_blank" rel="noreferrer">
            Open Shiprocket thermal label (PDF)
          </a>
        </p>
      ) : null}
      <h3>Deliver to</h3>
      {addr.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
      {doc.contactNumber ? <p>Phone: {String(doc.contactNumber)}</p> : null}
      {Number(doc.codAmount) > 0 ? (
        <p className="warehouse-print-cod">
          <strong>COD: {formatInr(doc.codAmount)}</strong>
        </p>
      ) : (
        <p>Prepaid</p>
      )}
      {doc.barcodePayload ? <p className="mono">{String(doc.barcodePayload)}</p> : null}
      {doc.qrPayload ? (
        <div className="warehouse-print-qr-block">
          <p>
            <strong>Order:</strong> {String(doc.orderId)}
            {doc.printSequence != null ? (
              <>
                &nbsp;|&nbsp; Stack #{String(doc.printSequence)}
              </>
            ) : null}
            {doc.assignedEmployee ? (
              <>
                &nbsp;|&nbsp; Tray: <strong>{String(doc.assignedEmployee)}</strong>
              </>
            ) : null}
          </p>
          <p className="warehouse-print-qr mono">{String(doc.qrPayload)}</p>
          <p className="muted">Scan this QR during pack to verify correct label.</p>
        </div>
      ) : null}
    </section>
  );
}

function ReturnInspectionBody({
  doc,
  formatInr,
}: {
  doc: Record<string, unknown>;
  formatInr: (n: unknown) => string;
}) {
  const lines = (doc.lines as Array<Record<string, unknown>>) ?? [];
  return (
    <section>
      <p>
        <strong>Return #</strong> {String(doc.returnNumber)} &nbsp;|&nbsp;
        <strong>Order:</strong> {String(doc.orderId)} &nbsp;|&nbsp;
        <strong>Status:</strong> {String(doc.status)}
      </p>
      <p>
        <strong>Reason:</strong> {String(doc.reason)}
      </p>
      {doc.customerComplaint ? <p>Complaint: {String(doc.customerComplaint)}</p> : null}
      <div className="warehouse-print-grid">
        <div>
          <p>Verification call: {doc.verificationCallDone ? 'Done' : 'Pending'}</p>
          <p>Verified by: {String(doc.verifiedBy ?? '—')}</p>
          <p>Received: {String(doc.receivedAt ?? '—')}</p>
        </div>
        <div>
          <p>Condition: {String(doc.productCondition ?? '—')}</p>
          <p>Refund: {String(doc.refundType ?? '—')}</p>
          {doc.refundAmount != null ? <p>Amount: {formatInr(doc.refundAmount)}</p> : null}
          <p>Stock action: {String(doc.stockAction ?? '—')}</p>
        </div>
      </div>
      {doc.inspectionNotes ? <p>Notes: {String(doc.inspectionNotes)}</p> : null}
      <table className="warehouse-print-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Batch</th>
            <th>Qty</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td>{String(l.productTitle)}</td>
              <td>{String(l.sku ?? '—')}</td>
              <td>{String(l.batchCode ?? '—')}</td>
              <td>{String(l.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
