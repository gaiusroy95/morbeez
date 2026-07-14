import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { buildWarehouseOrderUrl } from '../../lib/warehouse-links';
import { Modal } from '../Modal';
import { Alert, Btn, Loading } from '../ui';

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
  commerceOrderId?: string | null;
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
  const [pushing, setPushing] = useState(false);
  const [pushMsg, setPushMsg] = useState('');

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

  async function pushToWarehouse() {
    setPushing(true);
    setPushMsg('');
    setError('');
    try {
      const r = await api<{ ok: boolean; commerceOrderId: string }>(
        `${base}/leads/${leadId}/orders/${encodeURIComponent(row.id)}/push-to-oms`,
        { method: 'POST' }
      );
      setPushMsg('Sent to warehouse — pick list created.');
      setDetail((d) => (d ? { ...d, commerceOrderId: r.commerceOrderId } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not push to warehouse');
    } finally {
      setPushing(false);
    }
  }

  return (
    <Modal title={detail?.orderId ?? row.orderId ?? 'Order details'} onClose={onClose} wide>
      {loading ? <Loading label="Loading order…" /> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {detail && !loading ? (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <span className={statusClass(detail.statusTone)}>{detail.statusLabel}</span>
            <span className={`tc-ord-status tc-ord-status--${detail.paymentTone}`}>
              {detail.paymentLabel}
              {detail.paymentSubtext ? ` · ${detail.paymentSubtext}` : ''}
            </span>
            <span className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs text-ink-secondary">
              {detail.dateLabel}
            </span>
          </div>

          <dl className="grid gap-3 rounded-xl border border-border bg-surface-subtle/80 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Delivery date</dt>
              <dd className="font-medium">{detail.deliveryDateLabel}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Delivery by</dt>
              <dd className="font-medium">{detail.deliveryBy}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Block</dt>
              <dd className="font-medium">{detail.blockName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Source</dt>
              <dd className="font-medium capitalize">{detail.source.replace('_', ' ')}</dd>
            </div>
            {detail.createdBy ? (
              <div>
                <dt className="text-ink-muted">Created by</dt>
                <dd className="font-medium">{detail.createdBy}</dd>
              </div>
            ) : null}
          </dl>

          {detail.source === 'crm_manual' ? (
            <section className="rounded-xl border border-border bg-surface-elevated p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Warehouse fulfillment
              </h3>
              {detail.commerceOrderId ? (
                <Link
                  to={buildWarehouseOrderUrl(detail.commerceOrderId)}
                  className="order-tracking-link text-sm font-semibold"
                >
                  Open in Warehouse Hub ↗
                </Link>
              ) : (
                <Btn variant="primary" disabled={pushing} onClick={() => void pushToWarehouse()}>
                  {pushing ? 'Sending…' : 'Push to warehouse'}
                </Btn>
              )}
              {pushMsg ? <p className="mt-2 text-sm text-emerald-700">{pushMsg}</p> : null}
            </section>
          ) : null}

          {detail.commerceOrderId && detail.source === 'commerce' ? (
            <section className="rounded-xl border border-border bg-surface-elevated p-4">
              <Link
                to={buildWarehouseOrderUrl(detail.commerceOrderId)}
                className="order-tracking-link text-sm font-semibold"
              >
                Open in Warehouse Hub ↗
              </Link>
            </section>
          ) : null}

          {detail.trackingAwb || detail.trackingUrl ? (
            <section className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                Dispatch & tracking
              </h3>
              {detail.trackingAwb ? (
                <p className="text-sm text-ink-secondary">
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
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Products
            </h3>
            <ul className="space-y-2">
              {detail.lineItems.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface-elevated p-3"
                >
                  <div className="tc-ord-product-thumb">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span aria-hidden>📦</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{item.title}</p>
                    <p className="text-xs text-ink-muted">
                      Qty {item.quantity}
                      {item.price != null ? ` · ₹${item.price}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex justify-between border-t border-border pt-3 text-sm">
            <span className="font-medium text-ink-secondary">Order total</span>
            <span className="text-lg font-bold text-ink">
              ₹{detail.amount.toLocaleString('en-IN')}
            </span>
          </div>

          {detail.deliveryAddress ? (
            <section>
              <h3 className="text-xs font-semibold uppercase text-ink-muted">Delivery address</h3>
              <p className="mt-1 text-sm text-ink-secondary">{detail.deliveryAddress}</p>
            </section>
          ) : null}
          {detail.notes ? (
            <section>
              <h3 className="text-xs font-semibold uppercase text-ink-muted">Notes</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-secondary">{detail.notes}</p>
            </section>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
