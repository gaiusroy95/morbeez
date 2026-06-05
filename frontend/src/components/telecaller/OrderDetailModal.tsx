import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../Modal';

export type OrderListRow = {
  id: string;
  orderId?: string;
  dateLabel?: string;
  productTitle?: string;
  qty?: number;
  amount?: number;
  statusLabel?: string;
  statusTone?: string;
};

type OrderDetail = {
  id: string;
  orderId: string;
  dateLabel: string;
  lineItems: Array<{ title: string; quantity: number; price?: number; imageUrl?: string | null }>;
  amount: number;
  statusLabel: string;
  statusTone: string;
  paymentLabel: string;
  paymentSubtext: string;
  paymentTone: string;
  deliveryDateLabel: string;
  deliveryBy: string;
  blockName: string | null;
  notes?: string | null;
  deliveryAddress?: string | null;
  createdBy?: string | null;
  source: string;
  trackingAwb?: string | null;
  trackingUrl?: string | null;
  courier?: string | null;
};

type Props = {
  leadId: string;
  row: OrderListRow;
  onClose: () => void;
};

function statusClass(tone: string): string {
  return `tc-ord-status tc-ord-status--${tone}`;
}

export function OrderDetailModal({ leadId, row, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<OrderDetail | null>(null);

  const base = '/morbeez-staff/api/v1/os/telecaller';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api<{ ok: boolean; order: OrderDetail }>(
      `${base}/leads/${leadId}/orders/${encodeURIComponent(row.id)}`
    )
      .then((d) => {
        if (!cancelled) setDetail(d.order);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load order');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, row.id]);

  return (
    <Modal title={detail?.orderId ?? row.orderId ?? 'Order details'} onClose={onClose} wide>
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {detail && !loading ? (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <span className={statusClass(detail.statusTone)}>{detail.statusLabel}</span>
            <span className={`tc-ord-status tc-ord-status--${detail.paymentTone}`}>
              {detail.paymentLabel}
              {detail.paymentSubtext ? ` · ${detail.paymentSubtext}` : ''}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
              {detail.dateLabel}
            </span>
          </div>

          <dl className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Delivery date</dt>
              <dd className="font-medium">{detail.deliveryDateLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Delivery by</dt>
              <dd className="font-medium">{detail.deliveryBy}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Block</dt>
              <dd className="font-medium">{detail.blockName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Source</dt>
              <dd className="font-medium capitalize">{detail.source.replace('_', ' ')}</dd>
            </div>
            {detail.createdBy ? (
              <div>
                <dt className="text-slate-500">Created by</dt>
                <dd className="font-medium">{detail.createdBy}</dd>
              </div>
            ) : null}
          </dl>

          {detail.trackingAwb || detail.trackingUrl ? (
            <section className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Dispatch & tracking
              </h3>
              {detail.trackingAwb ? (
                <p className="text-sm text-slate-700">
                  <strong>AWB:</strong> {detail.trackingAwb}
                  {detail.courier ? ` · ${detail.courier}` : ''}
                </p>
              ) : null}
              {detail.trackingUrl ? (
                <a
                  href={detail.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="order-tracking-link mt-2 inline-block text-sm font-semibold"
                >
                  Open tracking page ↗
                </a>
              ) : null}
            </section>
          ) : null}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Products
            </h3>
            <ul className="space-y-2">
              {detail.lineItems.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="tc-ord-product-thumb">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span aria-hidden>📦</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">
                      Qty {item.quantity}
                      {item.price != null ? ` · ₹${item.price}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex justify-between border-t border-slate-100 pt-3 text-sm">
            <span className="font-medium text-slate-700">Order total</span>
            <span className="text-lg font-bold text-slate-900">
              ₹{detail.amount.toLocaleString('en-IN')}
            </span>
          </div>

          {detail.deliveryAddress ? (
            <section>
              <h3 className="text-xs font-semibold uppercase text-slate-500">Delivery address</h3>
              <p className="mt-1 text-sm text-slate-700">{detail.deliveryAddress}</p>
            </section>
          ) : null}
          {detail.notes ? (
            <section>
              <h3 className="text-xs font-semibold uppercase text-slate-500">Notes</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{detail.notes}</p>
            </section>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
