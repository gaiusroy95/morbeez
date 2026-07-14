import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { paths, toPath } from '../../lib/routes';
import { openQuoteSendLinks, sendQuoteToFarmer } from '../../lib/quoteSend';
import { Alert, Loading } from '../ui';
import {
  BulkMarginReviewBadge,
  bulkReviewHint,
  canSendQuoteWithBulkReview,
  type BulkMarginReviewStatus,
} from './BulkMarginReviewBadge';

const base = '/morbeez-staff/api/v1/os/telecaller';

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
  addressLine: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
  gstin: string;
  customerCareNumber: string;
  whatsappNumber: string;
  formattedAddress: string;
  termsAndConditions?: string;
  quotationLogoUrl?: string;
};

type EstimateDetail = {
  quote: {
    id: string;
    quoteNumber: string;
    status: string;
    customerName: string;
    customerPhone: string | null;
    customerEmail: string | null;
    lineItems: QuoteLine[];
    total: number;
    prepaidAmount: number;
    codAmount: number;
    paymentType: string;
    createdAt: string;
    expiresAt: string;
    bulkMarginReviewStatus?: BulkMarginReviewStatus;
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

type Props = {
  leadId: string;
  estimateId: string;
  canWrite?: boolean;
  onBack: () => void;
  onEdit?: (id: string) => void;
};

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function EstimateDetailView({ leadId, estimateId, canWrite, onBack, onEdit }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<EstimateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api<EstimateDetail & { ok: boolean }>(
      `${base}/leads/${leadId}/estimates/${estimateId}`
    )
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load quote'))
      .finally(() => setLoading(false));
  }, [leadId, estimateId]);

  if (loading) return <Loading label="Loading quotation…" />;
  if (error || !data) {
    return (
      <div>
        <button type="button" className="est-detail-back" onClick={onBack}>
          ← Back to orders
        </button>
        <Alert tone="error">{error || 'Quote not found'}</Alert>
      </div>
    );
  }

  const { quote, company, document: doc } = data;
  const canCheckout = quote.status === 'pending' || quote.status === 'checkout';
  const canEdit = canWrite && quote.status === 'pending' && quote.bulkMarginReviewStatus !== 'pending';
  const canSend = canWrite && canSendQuoteWithBulkReview(quote.bulkMarginReviewStatus);
  const reviewHint = bulkReviewHint(quote.bulkMarginReviewStatus);

  async function handleSend(channels: Array<'whatsapp' | 'email'>) {
    if (!canSend) {
      setError(reviewHint ?? 'Cannot send this quote yet');
      return;
    }
    setSending(true);
    setError('');
    try {
      const result = await sendQuoteToFarmer(leadId, estimateId, channels);
      openQuoteSendLinks(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send quote');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <button type="button" className="est-detail-back" onClick={onBack}>
        ← Back to orders
      </button>

      {error ? <Alert tone="error" className="mb-3">{error}</Alert> : null}

      {quote.bulkMarginReviewStatus ? (
        <div className="est-bulk-review-banner">
          <BulkMarginReviewBadge status={quote.bulkMarginReviewStatus} />
          {reviewHint ? <p className="est-bulk-review-hint">{reviewHint}</p> : null}
        </div>
      ) : null}

      {canWrite ? (
        <div className="est-detail-actions">
          {canEdit && onEdit ? (
            <button type="button" className="est-action-btn" onClick={() => onEdit(estimateId)}>
              Edit quote
            </button>
          ) : null}
          <button
            type="button"
            className="est-action-btn est-action-btn--wa"
            disabled={sending || !canSend}
            title={!canSend ? reviewHint ?? undefined : undefined}
            onClick={() => void handleSend(['whatsapp'])}
          >
            WhatsApp
          </button>
          <button
            type="button"
            className="est-action-btn est-action-btn--mail"
            disabled={sending || !canSend}
            title={!canSend ? reviewHint ?? undefined : undefined}
            onClick={() => void handleSend(['email'])}
          >
            Mail
          </button>
          <button
            type="button"
            className="est-action-btn est-action-btn--resend"
            disabled={sending || !canSend}
            title={!canSend ? reviewHint ?? undefined : undefined}
            onClick={() => void handleSend(['whatsapp', 'email'])}
          >
            {quote.bulkMarginReviewStatus === 'approved' && !quote.sentAt ? 'Send quote' : 'Resend'}
          </button>
        </div>
      ) : null}

      <article className="est-doc">
        <header className="est-doc-header">
          <div className="est-doc-brand">
            {company.quotationLogoUrl ? (
              <img
                src={company.quotationLogoUrl}
                alt={company.companyName}
                className="est-doc-logo"
              />
            ) : (
              company.companyName
            )}
          </div>
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
          <div>
            <label>PREPARED BY</label>
            {doc.preparedByName ?? '—'}
          </div>
          <div style={{ textAlign: 'right' }}>
            <label>VALID UNTIL</label>
            {doc.validUntilLabel}
          </div>
        </div>

        <div className="est-doc-company-bar">
          {company.formattedAddress ? (
            <span>📍 {company.formattedAddress}</span>
          ) : null}
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

        {company.termsAndConditions ? (
          <div className="est-doc-terms">
            <h4>Terms &amp; Conditions</h4>
            <div dangerouslySetInnerHTML={{ __html: company.termsAndConditions }} />
          </div>
        ) : null}

        {canCheckout ? (
          <button
            type="button"
            className="est-doc-checkout"
            onClick={() =>
              navigate(toPath(paths.commerceQuoteView.replace(':quoteId', quote.id)))
            }
          >
            View quotation →
          </button>
        ) : quote.status === 'paid' ? (
          <p className="px-6 pb-6 text-center text-sm font-semibold text-emerald-700">
            Payment received — converted to order.
          </p>
        ) : null}
      </article>
    </div>
  );
}
