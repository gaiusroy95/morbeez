import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { paths, toPath } from '../lib/routes';
import { Alert, Btn, Loading, Panel } from '../components/ui';

type QuoteLine = {
  title: string;
  sku?: string;
  hsnCode?: string;
  qty: number;
  unitPrice: number;
  gstPercent: number;
  amountInclGst: number;
};

type Quote = {
  id: string;
  quoteNumber: string;
  status: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  lineItems: QuoteLine[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  paymentType: string;
  prepaidAmount: number;
  codAmount: number;
  hoursLeft?: number;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Razorpay'));
    document.body.appendChild(script);
  });
}

export function QuoteCheckoutPage() {
  const { quoteId = '' } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentType, setPaymentType] = useState<'full' | 'partial'>('full');
  const [prepaidAmount, setPrepaidAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    api<{ ok: boolean; quote: Quote }>(`/morbeez-staff/api/v1/quotes/${quoteId}`)
      .then((d) => setQuote(d.quote))
      .catch((e) => setError(e instanceof Error ? e.message : 'Quote not found'))
      .finally(() => setLoading(false));
  }, [quoteId]);

  const prepaid = paymentType === 'full' ? quote?.total ?? 0 : Number(prepaidAmount) || 0;
  const payNowAmount =
    paymentType === 'full' ? quote?.total ?? 0 : prepaid;
  const gstTotal = (quote?.cgst ?? 0) + (quote?.sgst ?? 0) + (quote?.igst ?? 0);

  async function processCheckout() {
    if (!quote) return;
    setProcessing(true);
    setError('');
    try {
      const d = await api<{ ok: boolean; quote: Quote }>(
        `/morbeez-staff/api/v1/quotes/${quote.id}/checkout`,
        {
          method: 'POST',
          body: JSON.stringify({
            paymentType,
            prepaidAmount: paymentType === 'partial' ? Number(prepaidAmount) : undefined,
          }),
        }
      );
      setQuote(d.quote);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setProcessing(false);
    }
  }

  async function payNow() {
    if (!quote) return;
    setPaying(true);
    setError('');
    try {
      let activeQuote = quote;
      if (activeQuote.status === 'pending') {
        const d = await api<{ ok: boolean; quote: Quote }>(
          `/morbeez-staff/api/v1/quotes/${activeQuote.id}/checkout`,
          {
            method: 'POST',
            body: JSON.stringify({
              paymentType,
              prepaidAmount: paymentType === 'partial' ? Number(prepaidAmount) : undefined,
            }),
          }
        );
        activeQuote = d.quote;
        setQuote(d.quote);
      }
      const pay = await api<{
        ok: boolean;
        razorpayOrderId: string;
        keyId: string;
        amount: number;
        prefill: { name: string; email: string; contact: string };
      }>(`/morbeez-staff/api/v1/quotes/${activeQuote.id}/pay`, { method: 'POST' });

      await loadRazorpayScript();
      if (!window.Razorpay) throw new Error('Razorpay unavailable');

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay!({
          key: pay.keyId,
          amount: pay.amount,
          currency: 'INR',
          name: 'Morbeez',
          description: `Quote ${activeQuote.quoteNumber}`,
          order_id: pay.razorpayOrderId,
          prefill: pay.prefill,
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const result = await api<{
                ok: boolean;
                orderName?: string;
                commerceOrderId?: string;
              }>(`/morbeez-staff/api/v1/quotes/${activeQuote.id}/verify`, {
                method: 'POST',
                body: JSON.stringify({
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                }),
              });
              navigate(toPath(paths.commerce), {
                state: { quotePaid: result.orderName ?? activeQuote.quoteNumber },
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
          },
        });
        rzp.open();
      });
    } catch (e) {
      if (e instanceof Error && e.message !== 'Payment cancelled') {
        setError(e.message);
      }
    } finally {
      setPaying(false);
    }
  }

  if (loading) return <Loading label="Loading quote checkout…" />;
  if (!quote) return <Alert tone="error">{error || 'Quote not found'}</Alert>;

  const inCheckout = quote.status === 'checkout' || quote.status === 'paid';

  return (
    <div className="max-w-5xl mx-auto p-4">
      <Link to={toPath(paths.commerce)} className="text-sm text-emerald-700 hover:underline">
        ← Back to orders
      </Link>
      <h1 className="mt-3 text-xl font-bold text-slate-900">Checkout — {quote.quoteNumber}</h1>
      <p className="text-sm text-slate-600">
        {quote.customerName}
        {quote.hoursLeft != null ? ` · Expires in ${quote.hoursLeft}h` : null}
      </p>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="quote-checkout-layout mt-6">
        <div className="space-y-4">
          <Panel title="Items">
            <table className="quote-items-table">
              <thead>
                <tr>
                  <th>Description / SKU</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>GST%</th>
                  <th>Amount (incl. GST)</th>
                </tr>
              </thead>
              <tbody>
                {quote.lineItems.map((li, i) => (
                  <tr key={i}>
                    <td>
                      <div>{li.title}</div>
                      {li.sku ? <div className="sku">{li.sku}</div> : null}
                      <div className="hsn">HSN: {li.hsnCode ?? '382499'}</div>
                    </td>
                    <td>{li.qty}</td>
                    <td>{formatInr(li.unitPrice)}</td>
                    <td>{li.gstPercent}%</td>
                    <td>{formatInr(li.amountInclGst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="quote-summary">
              <div className="quote-summary-row">
                <span>Subtotal</span>
                <span>{formatInr(quote.subtotal)}</span>
              </div>
              <div className="quote-summary-row quote-summary-total">
                <span>Total Amount (incl. GST)</span>
                <span>{formatInr(quote.total)}</span>
              </div>
              {quote.codAmount > 0 ? (
                <>
                  <div className="quote-summary-row">
                    <span>Payment type</span>
                    <span>Advance</span>
                  </div>
                  <div className="quote-summary-row">
                    <span>Prepaid amount</span>
                    <span>{formatInr(quote.prepaidAmount)}</span>
                  </div>
                  <div className="quote-summary-row">
                    <span>COD amount</span>
                    <span>{formatInr(quote.codAmount)}</span>
                  </div>
                </>
              ) : null}
            </div>
          </Panel>

          {!inCheckout ? (
            <Panel title="Payment options">
              <label
                className={`quote-pay-option mb-3 block ${paymentType === 'full' ? 'quote-pay-option--active' : ''}`}
              >
                <input
                  type="radio"
                  name="payType"
                  className="mr-2"
                  checked={paymentType === 'full'}
                  onChange={() => setPaymentType('full')}
                />
                <strong>Full payment</strong>
                <p className="text-sm text-slate-600">Pay the full amount at once.</p>
                {paymentType === 'full' ? (
                  <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                    Payment amount: {formatInr(quote.total)}
                  </p>
                ) : null}
              </label>
              <label
                className={`quote-pay-option block ${paymentType === 'partial' ? 'quote-pay-option--active' : ''}`}
              >
                <input
                  type="radio"
                  name="payType"
                  className="mr-2"
                  checked={paymentType === 'partial'}
                  onChange={() => setPaymentType('partial')}
                />
                <strong>Partial payment</strong>
                <p className="text-sm text-slate-600">Pay some amount now and remaining on delivery.</p>
                {paymentType === 'partial' ? (
                  <div className="mt-2">
                    <label className="text-sm font-medium">Prepaid amount (₹)</label>
                    <input
                      type="number"
                      min={1}
                      max={quote.total - 1}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      value={prepaidAmount}
                      onChange={(e) => setPrepaidAmount(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      COD balance: {formatInr(Math.max(0, quote.total - (Number(prepaidAmount) || 0)))}
                    </p>
                  </div>
                ) : null}
              </label>
              <Btn className="mt-4" onClick={() => void processCheckout()} disabled={processing}>
                {processing ? 'Processing…' : 'Process to Checkout'}
              </Btn>
            </Panel>
          ) : null}

          <Panel title="Wallet">
            <p className="text-sm text-slate-600">No wallet balance available.</p>
          </Panel>
        </div>

        <div>
          <Panel title="Payment summary">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Amount before tax</span>
                <span>{formatInr(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">GST</span>
                <span>{formatInr(gstTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold">
                <span>Total amount</span>
                <span>{formatInr(quote.total)}</span>
              </div>
            </div>
            {quote.status === 'paid' ? (
              <p className="mt-4 text-sm font-semibold text-emerald-700">Payment completed — order created.</p>
            ) : (
              <button
                type="button"
                className="quote-pay-now mt-4"
                disabled={paying || (paymentType === 'partial' && !inCheckout && !prepaidAmount)}
                onClick={() => void payNow()}
              >
                <span>{paying ? 'Processing…' : 'Pay Now'}</span>
                <span>{formatInr(inCheckout ? quote.prepaidAmount || quote.total : payNowAmount)}</span>
              </button>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
