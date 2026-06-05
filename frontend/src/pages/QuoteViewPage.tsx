import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { paths, toPath } from '../lib/routes';
import { Alert, Loading } from '../components/ui';

type QuoteLine = {
  title: string;
  sku?: string;
  hsnCode?: string;
  qty: number;
  unitPrice: number;
  gstPercent: number;
  amountInclGst: number;
};

type Company = {
  companyName: string;
  formattedAddress: string;
  customerCareNumber: string;
  whatsappNumber: string;
  gstin: string;
};

type QuoteDocument = {
  quote: {
    id: string;
    quoteNumber: string;
    status: string;
    customerName: string;
    lineItems: QuoteLine[];
    total: number;
    prepaidAmount: number;
    codAmount: number;
    acceptedAt: string | null;
    hoursLeft?: number;
  };
  company: Company;
  document: {
    quotationId: string;
    dateLabel: string;
    validUntilLabel: string;
    billTo: string[];
    shipTo: string[];
    paymentTypeLabel: string;
    preparedByName: string | null;
    subtotal: number;
    totalInclGst: number;
  };
};

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function QuoteViewPage() {
  const { quoteId = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<QuoteDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [sharing, setSharing] = useState(false);

  function load() {
    setLoading(true);
    api<QuoteDocument & { ok: boolean }>(`/morbeez-staff/api/v1/quotes/${quoteId}/document`)
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : 'Quote not found'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [quoteId]);

  async function acceptQuote() {
    if (!data) return;
    setAccepting(true);
    setError('');
    try {
      await api(`/morbeez-staff/api/v1/quotes/${data.quote.id}/accept`, { method: 'POST' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not accept quote');
    } finally {
      setAccepting(false);
    }
  }

  async function shareWhatsApp() {
    if (!data) return;
    setSharing(true);
    setError('');
    try {
      const res = await api<{ ok: boolean; whatsappUrl?: string | null; text?: string }>(
        `/morbeez-staff/api/v1/quotes/${data.quote.id}/share`
      );
      if (res.whatsappUrl) {
        window.open(res.whatsappUrl, '_blank', 'noopener');
      } else if (res.text) {
        window.open(`https://wa.me/?text=${encodeURIComponent(res.text)}`, '_blank', 'noopener');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open WhatsApp');
    } finally {
      setSharing(false);
    }
  }

  if (loading) return <Loading label="Loading quotation…" />;
  if (error && !data) return <Alert tone="error">{error || 'Quote not found'}</Alert>;
  if (!data) return <Alert tone="error">Quote not found</Alert>;

  const { quote, company, document: doc } = data;
  const isPaid = quote.status === 'paid';
  const isActive = quote.status === 'pending' || quote.status === 'checkout';
  const accepted = Boolean(quote.acceptedAt) || quote.status === 'checkout' || isPaid;
  const canAccept = isActive && !accepted && !isPaid;
  const canCheckout = accepted && isActive && !isPaid;

  return (
    <div className="max-w-4xl mx-auto p-4 pb-10">
      <div className="est-view-toolbar">
        <Link to={toPath(paths.commerce)} className="est-detail-back">
          ← Back to orders
        </Link>
        <div className="est-view-toolbar-actions">
          <button
            type="button"
            className="est-action-btn est-action-btn--wa"
            disabled={sharing}
            onClick={() => void shareWhatsApp()}
          >
            {sharing ? 'Opening…' : 'WhatsApp'}
          </button>
        </div>
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}

      <article className="est-doc">
        <header className="est-doc-header">
          <div className="est-doc-brand">{company.companyName}</div>
          <div className="est-doc-title-wrap">
            <h1>Quotation</h1>
            <p>{company.companyName}</p>
          </div>
        </header>

        <div className="est-doc-meta-row">
          <div>
            <label>DATE</label>
            {doc.dateLabel}
          </div>
          {doc.preparedByName ? (
            <div>
              <label>PREPARED BY</label>
              {doc.preparedByName}
            </div>
          ) : null}
          <div style={{ textAlign: 'right' }}>
            <label>VALID UNTIL</label>
            {doc.validUntilLabel}
          </div>
        </div>

        <div className="est-doc-company-bar">
          {company.formattedAddress ? <span>📍 {company.formattedAddress}</span> : null}
          {company.customerCareNumber ? <span>📞 {company.customerCareNumber}</span> : null}
          {company.whatsappNumber ? <span>💬 WhatsApp {company.whatsappNumber}</span> : null}
          {company.gstin ? <span>🧾 GSTIN: {company.gstin}</span> : null}
        </div>

        <p className="est-doc-id">Quotation ID: {doc.quotationId}</p>

        <div className="est-doc-addresses">
          <div className="est-doc-address-block">
            <h3>✉ Bill To:</h3>
            {doc.billTo.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
          <div className="est-doc-address-block">
            <h3>📍 Ship To:</h3>
            {doc.shipTo.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>

        <section className="est-doc-items">
          <h3>🛒 Items:</h3>
          <div className="est-table-wrap">
            <table className="est-doc-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>S.No</th>
                  <th>Description / SKU</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>GST%</th>
                  <th>Amount (incl. GST)</th>
                </tr>
              </thead>
              <tbody>
                {quote.lineItems.map((li, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      <div>{li.title}</div>
                      {(li.sku || li.hsnCode) && (
                        <div className="est-sku">
                          {[li.sku, li.hsnCode ? `HSN: ${li.hsnCode}` : null]
                            .filter(Boolean)
                            .join(' | ')}
                        </div>
                      )}
                    </td>
                    <td>{li.qty}</td>
                    <td>{formatInr(li.unitPrice)}</td>
                    <td>{li.gstPercent}%</td>
                    <td>{formatInr(li.amountInclGst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="est-doc-summary">
          <div className="est-doc-summary-row">
            <span>Subtotal</span>
            <span>{formatInr(doc.subtotal)}</span>
          </div>
          <div className="est-doc-summary-row est-doc-summary-total">
            <span>Total Amount (incl. GST)</span>
            <span>{formatInr(doc.totalInclGst)}</span>
          </div>
          <div className="est-doc-summary-row">
            <span>Payment Type</span>
            <span>{doc.paymentTypeLabel}</span>
          </div>
          {quote.prepaidAmount > 0 ? (
            <>
              <div className="est-doc-summary-row">
                <span>Prepaid Amount</span>
                <span>{formatInr(quote.prepaidAmount)}</span>
              </div>
              <div className="est-doc-summary-row">
                <span>COD Amount</span>
                <span>{formatInr(quote.codAmount)}</span>
              </div>
            </>
          ) : null}
        </div>

        {isPaid ? (
          <p className="px-6 pb-6 text-center text-sm font-semibold text-emerald-700">
            Payment received — converted to order.
          </p>
        ) : canAccept ? (
          <button
            type="button"
            className="est-doc-checkout est-doc-checkout--accept"
            disabled={accepting}
            onClick={() => void acceptQuote()}
          >
            {accepting ? 'Accepting…' : 'Accept quote'}
          </button>
        ) : canCheckout ? (
          <button
            type="button"
            className="est-doc-checkout"
            onClick={() =>
              navigate(toPath(paths.commerceQuoteCheckout.replace(':quoteId', quote.id)))
            }
          >
            Proceed to Checkout →
          </button>
        ) : (
          <p className="px-6 pb-6 text-center text-sm text-slate-500">
            This quotation is no longer available.
            {quote.hoursLeft != null ? ` (${quote.hoursLeft}h left)` : null}
          </p>
        )}
      </article>
    </div>
  );
}
