import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { buildTaxInvoiceHtml } from '@morbeez/shared/print/tax-invoice-html';
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
          <div
            className="inv-doc-root"
            dangerouslySetInnerHTML={{
              __html: buildTaxInvoiceHtml(doc, company, {
                assetBaseUrl: typeof window !== 'undefined' ? window.location.origin : '',
              }),
            }}
          />
        ) : (
          <>
            <header className="warehouse-print-header">
              {company.quotationLogoUrl ? (
                <img src={company.quotationLogoUrl} alt="" className="warehouse-print-logo" />
              ) : null}
              <div>
                <h1>{String(doc.title ?? type)}</h1>
                <p className="text-sm text-ink-muted">{company.companyName}</p>
                <p className="text-sm text-ink-muted">{company.formattedAddress}</p>
                {company.gstin ? <p className="text-sm text-ink-muted">GSTIN: {company.gstin}</p> : null}
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
      <p className="text-sm text-ink-muted">{String(doc.trackingLabel ?? 'AWB')}</p>
      <p className="warehouse-print-awb mono">{String(doc.awbCode ?? 'Tracking pending')}</p>
      <p>
        <strong>{String(doc.courierName)}</strong>
        {doc.shippingMethod === 'manual' ? (
          <span className="text-sm text-ink-muted"> &nbsp;|&nbsp; Manual logistics</span>
        ) : null}
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
          <p className="text-sm text-ink-muted">Scan this QR during pack to verify correct label.</p>
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
