import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { toPath } from '../../lib/routes';
import { Modal } from '../Modal';
import {
  Alert,
  Badge,
  Btn,
  DataTable,
  EmptyState,
  Loading,
  Panel,
  TableWrap,
  inputClass,
  StaticSelect,
} from '../ui';
import { WarehouseOrderLink } from '../warehouse/WarehouseOrderLink';
import { useAuth } from '../../context/AuthContext';

type OrderRow = {
  id: string;
  source?: string;
  displayOrderId: string;
  farmerName: string;
  phone: string | null;
  amount: number;
  status: string;
  paymentLabel: string;
  omsStatus?: string | null;
  createdAt: string;
  quoteHoursLeft?: number;
  isQuote?: boolean;
  quoteStatus?: string;
};

type OrderTab = 'all' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

type TimelineStep = {
  key: string;
  label: string;
  at: string | null;
  done: boolean;
  pending?: boolean;
};

type OrderDetail = {
  id: string;
  source?: string;
  displayOrderId: string;
  orderDate: string;
  status: string;
  statusLabel: string;
  paymentStatus: string;
  paymentLabel: string;
  farmerName: string;
  customer: {
    name: string;
    phone: string | null;
    email: string | null;
    addressShort: string;
  };
  shipping: {
    name: string;
    addressLines: string[];
    courier: string;
    trackingId: string;
    trackingUrl: string | null;
  };
  lineItems: Array<{
    product: string;
    variant: string;
    qty: number;
    price: number;
    total: number;
    hsnCode?: string;
    gstPercent?: number;
    sku?: string;
  }>;
  totals: {
    subtotal: number;
    shipping: number;
    discount: number;
    total: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    prepaidAmount?: number;
    codAmount?: number;
  };
  timeline: TimelineStep[];
  notes: string;
  omsStatus?: string | null;
  isQuote?: boolean;
  quoteStatus?: string;
  checkoutToken?: string;
};

const STATUS_TABS: Array<{ id: OrderTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'processing', label: 'Processing' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
];

function quoteStatusClass(status?: string) {
  if (status === 'checkout') return 'est-status est-status--checkout';
  if (status === 'paid') return 'est-status est-status--paid';
  if (status === 'pending') return 'est-status est-status--pending';
  return 'est-status est-status--pending';
}

function displayOrderStatus(o: OrderRow) {
  if (o.source === 'quote' && o.quoteStatus) {
    return o.quoteStatus;
  }
  return o.status;
}

const PAGE_SIZE = 10;

type Props = {
  canWrite: boolean;
  onArchive: (id: string, source?: string) => void;
  /** Increment after archive so the list refetches */
  reloadToken?: number;
};

export function CommerceOrdersPanel({ canWrite, onArchive, reloadToken = 0 }: Props) {
  const { can } = useAuth();
  const canWarehouse = can('warehouse', 'read');
  const [tab, setTab] = useState<OrderTab>('all');
  const [payment, setPayment] = useState<'' | 'cod' | 'paid'>('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [tabCounts, setTabCounts] = useState<Record<OrderTab, number>>({
    all: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
  });
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    if (tab !== 'all') params.set('status', tab);
    if (payment) params.set('payment', payment);
    if (appliedSearch.trim()) params.set('search', appliedSearch.trim());
    try {
      const d = await api<{
        ok: boolean;
        orders: OrderRow[];
        tabCounts: Record<OrderTab, number>;
        pagination: { pages: number };
      }>(`/morbeez-staff/api/v1/orders?${params}`);
      setOrders(
        (d.orders ?? []).map((o) => ({
          ...o,
          displayOrderId: String(o.displayOrderId ?? o.id),
          farmerName: String(o.farmerName ?? 'Guest'),
          amount: Number(o.amount ?? 0),
          quoteHoursLeft: (o as OrderRow & { quoteHoursLeft?: number }).quoteHoursLeft,
        }))
      );
      if (d.tabCounts) setTabCounts(d.tabCounts);
      setPages(d.pagination?.pages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [tab, payment, appliedSearch, page]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  async function openDetail(order: OrderRow) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await api<{ ok: boolean; order: OrderDetail }>(
        `/morbeez-staff/api/v1/orders/${order.id}`
      );
      setDetail(d.order);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load order');
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="commerce-orders-filters">
        <input
          type="search"
          className={`${inputClass} commerce-promo-search`}
          placeholder="Search order ID, farmer, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setAppliedSearch(search);
              setPage(1);
            }
          }}
        />
        <StaticSelect
          className={inputClass}
          value={payment}
          onChange={(value) => {
            setPayment(value as '' | 'cod' | 'paid');
            setPage(1);
          }}
          options={[
            { value: '', label: 'All payments' },
            { value: 'paid', label: 'Paid' },
            { value: 'cod', label: 'COD' },
          ]}
        />
        <Btn
          variant="secondary"
          onClick={() => {
            setAppliedSearch(search);
            setPage(1);
          }}
        >
          Search
        </Btn>
      </div>

      <div className="commerce-subtabs">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`commerce-subtab ${tab === t.id ? 'commerce-subtab--active' : ''}`}
            onClick={() => {
              setTab(t.id);
              setPage(1);
            }}
          >
            {t.label} ({tabCounts[t.id] ?? 0})
          </button>
        ))}
      </div>

      {loading ? <Loading /> : null}

      {!loading ? (
        <Panel
          title="Orders & dispatch"
          description="Click a row for shipping and timeline details. Create estimates from Telecaller CRM → lead → Estimates tab."
        >
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Farmer</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Date</th>
                  {canWarehouse ? <th>Warehouse</th> : null}
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.length ? (
                  orders.map((o) => (
                    <tr
                      key={o.id}
                      className="commerce-order-row"
                      onClick={() => void openDetail(o)}
                    >
                      <td>
                        {o.displayOrderId}
                        {o.source === 'quote' ? (
                          <>
                            <br />
                            <Badge tone="warn">Quote</Badge>
                          </>
                        ) : null}
                      </td>
                      <td>
                        {o.farmerName}
                        <br />
                        <small className="muted">{o.phone ?? ''}</small>
                      </td>
                      <td>₹{o.amount.toLocaleString('en-IN')}</td>
                      <td>
                        {o.source === 'quote' ? (
                          <span className={quoteStatusClass(o.quoteStatus)}>{displayOrderStatus(o)}</span>
                        ) : (
                          o.status
                        )}
                        {o.source === 'quote' && o.quoteHoursLeft != null && o.quoteStatus !== 'paid' ? (
                          <small className="muted block">{o.quoteHoursLeft}h left</small>
                        ) : null}
                      </td>
                      <td>{o.paymentLabel}</td>
                      <td>
                        <small className="muted">
                          {o.createdAt
                            ? new Date(o.createdAt).toLocaleDateString('en-IN')
                            : '—'}
                        </small>
                      </td>
                      {canWarehouse ? (
                        <td onClick={(e) => e.stopPropagation()}>
                          {o.source === 'shopify' ? (
                            <WarehouseOrderLink
                              orderId={o.id}
                              omsStatus={o.omsStatus}
                              compact
                            />
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      ) : null}
                      <td onClick={(e) => e.stopPropagation()}>
                        {canWrite && o.status !== 'cancelled' ? (
                          <button
                            type="button"
                            className="text-xs text-red-600 hover:underline"
                            onClick={() => onArchive(o.id, o.source)}
                          >
                            Archive
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={canWarehouse ? 8 : 7}>
                      <EmptyState>No orders found.</EmptyState>
                    </td>
                  </tr>
                )}
              </tbody>
            </DataTable>
          </TableWrap>
          {pages > 1 ? (
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 px-4 py-3">
              <Btn variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Btn>
              <span className="text-sm text-slate-600">
                Page {page} of {pages}
              </span>
              <Btn variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Btn>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {(detailLoading || detail) && (
        <Modal
          title={
            detail
              ? detail.isQuote
                ? `Quote ${detail.displayOrderId}`
                : `Order ${detail.displayOrderId}`
              : 'Order details'
          }
          onClose={() => {
            setDetail(null);
            setDetailLoading(false);
          }}
          wide
        >
          {detailLoading && !detail ? <Loading label="Loading order…" /> : null}
          {detail ? (
            <div className="order-detail-modal order-detail-grid">
              <div className="order-detail-section">
                <h4>Status</h4>
                <p>
                  <strong>{detail.statusLabel}</strong> · {detail.paymentStatus}
                </p>
                <p className="text-sm text-slate-600">{detail.orderDate}</p>
                <ul className="order-timeline mt-4">
                  {detail.timeline.map((step) => (
                    <li
                      key={step.key}
                      className={step.done ? 'done' : step.pending ? 'pending' : ''}
                    >
                      <span className="order-timeline-label">{step.label}</span>
                      <span className="order-timeline-at">{step.at ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {detail.source === 'shopify' && canWarehouse ? (
                <div className="order-detail-section">
                  <h4>Warehouse fulfillment</h4>
                  {detail.omsStatus ? (
                    <p>
                      OMS status: <Badge tone="role">{detail.omsStatus}</Badge>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-600">Not synced to warehouse yet.</p>
                  )}
                  <p className="mt-2">
                    <WarehouseOrderLink orderId={detail.id} omsStatus={detail.omsStatus} />
                  </p>
                </div>
              ) : null}
              <div className="order-detail-section">
                <h4>Dispatch & shipping</h4>
                <p>
                  <strong>Courier:</strong> {detail.shipping.courier}
                </p>
                <p>
                  <strong>Tracking:</strong>{' '}
                  {detail.shipping.trackingId !== '—' ? detail.shipping.trackingId : '—'}
                </p>
                {detail.shipping.trackingUrl ? (
                  <p className="mt-2">
                    <a
                      href={detail.shipping.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="order-tracking-link"
                    >
                      Open tracking page ↗
                    </a>
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-slate-700">
                  {detail.shipping.addressLines.map((line, i) => (
                    <span key={i}>
                      {line}
                      <br />
                    </span>
                  ))}
                </p>
              </div>
              {detail.isQuote && detail.quoteStatus !== 'paid' && canWrite ? (
                <div className="order-detail-section">
                  <h4>Checkout</h4>
                  <p className="text-sm text-slate-600">
                    Process to checkout, then pay via Razorpay. On success the quote becomes a real order.
                  </p>
                  <Link
                    to={toPath(`commerce/quotes/${detail.id}`)}
                    className="mt-2 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Process to Checkout
                  </Link>
                </div>
              ) : null}
              <div className="order-detail-section" style={{ gridColumn: '1 / -1' }}>
                <h4>{detail.isQuote ? 'Items' : 'Line items'}</h4>
                {detail.isQuote ? (
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
                      {detail.lineItems.map((li, i) => (
                        <tr key={i}>
                          <td>
                            <div>{li.product}</div>
                            {li.sku ? <div className="sku">{li.sku}</div> : null}
                            {li.hsnCode ? <div className="hsn">HSN: {li.hsnCode}</div> : null}
                          </td>
                          <td>{li.qty}</td>
                          <td>₹{li.price.toLocaleString('en-IN')}</td>
                          <td>{li.gstPercent ?? 18}%</td>
                          <td>₹{li.total.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <TableWrap>
                    <DataTable>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Variant</th>
                          <th>Qty</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.lineItems.map((li, i) => (
                          <tr key={i}>
                            <td>{li.product}</td>
                            <td>{li.variant}</td>
                            <td>{li.qty}</td>
                            <td>₹{li.total.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  </TableWrap>
                )}
                <div className="quote-summary">
                  <div className="quote-summary-row">
                    <span>Subtotal</span>
                    <span>₹{detail.totals.subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="quote-summary-row quote-summary-total">
                    <span>Total Amount (incl. GST)</span>
                    <span>₹{detail.totals.total.toLocaleString('en-IN')}</span>
                  </div>
                  {detail.isQuote && (detail.totals.prepaidAmount ?? 0) > 0 ? (
                    <>
                      <div className="quote-summary-row">
                        <span>Payment type</span>
                        <span>Advance</span>
                      </div>
                      <div className="quote-summary-row">
                        <span>Prepaid amount</span>
                        <span>₹{(detail.totals.prepaidAmount ?? 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="quote-summary-row">
                        <span>COD amount</span>
                        <span>₹{(detail.totals.codAmount ?? 0).toLocaleString('en-IN')}</span>
                      </div>
                    </>
                  ) : null}
                </div>
                {detail.notes ? (
                  <p className="mt-2 text-sm">
                    <strong>Notes:</strong> {detail.notes}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </Modal>
      )}
    </>
  );
}
