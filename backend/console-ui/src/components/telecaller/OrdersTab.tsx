import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type { OrderListRow } from './OrderDetailModal';

const base = '/morbeez-staff/api/v1/os/telecaller';

type OrderRow = OrderListRow & {
  createdAt?: string;
  orderRef?: string | null;
  productImageUrl?: string | null;
  lineItems?: Array<{ title: string; quantity: number }>;
  status?: string;
  statusTone?: string;
  paymentLabel?: string;
  paymentSubtext?: string;
  paymentTone?: string;
  deliveryDateLabel?: string;
  deliveryBy?: string;
  blockName?: string | null;
  blockId?: string | null;
};

type BlockOption = { id: string; name: string };

type Filters = {
  status: string;
  paymentTone: string;
  blockId: string;
  dateFrom: string;
  dateTo: string;
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const EMPTY_FILTERS: Filters = {
  status: '',
  paymentTone: '',
  blockId: '',
  dateFrom: '',
  dateTo: '',
};

function statusClass(tone: string | undefined): string {
  return `tc-ord-status tc-ord-status--${tone ?? 'warning'}`;
}

type Props = {
  leadId: string;
  canWrite: boolean;
  blocks: BlockOption[];
  refreshKey: number;
  onNewOrder: () => void;
  onOpenDetail: (row: OrderListRow) => void;
};

export function OrdersTab({
  leadId,
  canWrite,
  blocks,
  refreshKey,
  onNewOrder,
  onOpenDetail,
}: Props) {
  const [allItems, setAllItems] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ ok: boolean; orders: OrderRow[] }>(
        `${base}/leads/${leadId}/orders`
      );
      setAllItems(data.orders ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const filtered = useMemo(() => {
    return allItems.filter((o) => {
      if (filters.status && o.status !== filters.status) return false;
      if (filters.paymentTone && o.paymentTone !== filters.paymentTone) return false;
      if (filters.blockId && o.blockId !== filters.blockId) return false;
      if (filters.dateFrom && o.createdAt && new Date(o.createdAt) < new Date(filters.dateFrom)) {
        return false;
      }
      if (filters.dateTo && o.createdAt) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(o.createdAt) > end) return false;
      }
      return true;
    });
  }, [allItems, filters]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / rowsPerPage));
  const safePage = Math.min(page, pages);
  const pageItems = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  function exportCsv() {
    const headers = [
      'Order ID',
      'Date',
      'Product',
      'Qty',
      'Amount',
      'Status',
      'Payment',
      'Delivery',
      'Block',
    ];
    const rows = filtered.map((o) => [
      o.orderId,
      o.dateLabel,
      o.productTitle,
      o.qty,
      o.amount,
      o.statusLabel,
      `${o.paymentLabel} ${o.paymentSubtext ?? ''}`.trim(),
      o.deliveryDateLabel,
      o.blockName ?? '',
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${leadId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="tc-orders">
      <div className="tc-ord-header">
        <div>
          <h2 className="tc-ord-title">Orders</h2>
          <p className="tc-ord-subtitle">Purchase history and order tracking for this farmer</p>
        </div>
        <div className="tc-ord-header-actions">
          <button
            type="button"
            className="tc-ord-btn-secondary"
            onClick={() => setShowFilters((v) => !v)}
          >
            Filter
          </button>
          <button type="button" className="tc-ord-btn-secondary" onClick={exportCsv} disabled={!filtered.length}>
            Export
          </button>
          {canWrite ? (
            <button type="button" className="tc-ord-btn-primary" onClick={onNewOrder}>
              + New Order
            </button>
          ) : null}
        </div>
      </div>

      {showFilters ? (
        <div className="tc-ord-filters">
          <label className="tc-ord-filter-field">
            <span>Status</span>
            <select
              value={filters.status}
              onChange={(e) => {
                setFilters((f) => ({ ...f, status: e.target.value }));
                setPage(1);
              }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="tc-ord-filter-field">
            <span>Payment</span>
            <select
              value={filters.paymentTone}
              onChange={(e) => {
                setFilters((f) => ({ ...f, paymentTone: e.target.value }));
                setPage(1);
              }}
            >
              <option value="">All</option>
              <option value="success">Paid</option>
              <option value="warning">Pending</option>
              <option value="purple">Refunded</option>
            </select>
          </label>
          <label className="tc-ord-filter-field">
            <span>Date from</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => {
                setFilters((f) => ({ ...f, dateFrom: e.target.value }));
                setPage(1);
              }}
            />
          </label>
          <label className="tc-ord-filter-field">
            <span>Date to</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => {
                setFilters((f) => ({ ...f, dateTo: e.target.value }));
                setPage(1);
              }}
            />
          </label>
          <label className="tc-ord-filter-field">
            <span>Block</span>
            <select
              value={filters.blockId}
              onChange={(e) => {
                setFilters((f) => ({ ...f, blockId: e.target.value }));
                setPage(1);
              }}
            >
              <option value="">All blocks</option>
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="tc-ord-btn-reset"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setPage(1);
            }}
          >
            Reset
          </button>
        </div>
      ) : null}

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <div className="tc-ord-table-wrap">
        {loading ? (
          <p className="tc-ord-empty">Loading orders…</p>
        ) : (
          <table className="tc-ord-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Order date</th>
                <th>Products</th>
                <th>Qty</th>
                <th>Amount (₹)</th>
                <th>Status</th>
                <th>Payment status</th>
                <th>Delivery date</th>
                <th>Delivery by</th>
                <th>Block</th>
                <th className="tc-ord-th-actions" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((o) => (
                <tr
                  key={o.id}
                  className="tc-ord-row"
                  onClick={() =>
                    onOpenDetail({
                      id: o.id,
                      orderId: o.orderId,
                      dateLabel: o.dateLabel,
                      productTitle: o.productTitle,
                      qty: o.qty,
                      amount: o.amount,
                      statusLabel: o.statusLabel,
                    })
                  }
                >
                  <td>
                    <button
                      type="button"
                      className="tc-ord-order-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetail({ id: o.id, orderId: o.orderId });
                      }}
                    >
                      {o.orderId}
                    </button>
                  </td>
                  <td className="tc-ord-date">{o.dateLabel}</td>
                  <td>
                    <div className="tc-ord-product-cell">
                      <div className="tc-ord-product-thumb">
                        {o.productImageUrl ? (
                          <img src={o.productImageUrl} alt="" />
                        ) : (
                          <span>📦</span>
                        )}
                      </div>
                      <span className="tc-ord-product-name">{o.productTitle}</span>
                    </div>
                  </td>
                  <td>{o.qty}</td>
                  <td className="tc-ord-amount">₹{Number(o.amount ?? 0).toLocaleString('en-IN')}</td>
                  <td>
                    <span className={statusClass(o.statusTone)}>{o.statusLabel}</span>
                  </td>
                  <td>
                    <span className={statusClass(o.paymentTone)}>
                      {o.paymentLabel}
                    </span>
                    {o.paymentSubtext ? (
                      <span className="tc-ord-payment-sub">{o.paymentSubtext}</span>
                    ) : null}
                  </td>
                  <td className="tc-ord-date">{o.deliveryDateLabel}</td>
                  <td>{o.deliveryBy}</td>
                  <td className="tc-ord-block">{o.blockName ?? '—'}</td>
                  <td className="tc-ord-actions" onClick={(e) => e.stopPropagation()}>
                    <div className="tc-ord-action-btns">
                      <button
                        type="button"
                        className="tc-ord-icon-btn"
                        title="View details"
                        onClick={() => onOpenDetail({ id: o.id, orderId: o.orderId })}
                      >
                        👁
                      </button>
                      <div className="tc-ord-menu-wrap">
                        <button
                          type="button"
                          className="tc-ord-icon-btn"
                          aria-label="More"
                          onClick={() => setOpenMenuId(openMenuId === o.id ? null : o.id)}
                        >
                          ⋮
                        </button>
                        {openMenuId === o.id ? (
                          <div className="tc-ord-menu">
                            <button type="button" onClick={() => onOpenDetail({ id: o.id })}>
                              View details
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && pageItems.length === 0 ? (
          <p className="tc-ord-empty">No orders for this farmer yet.</p>
        ) : null}
      </div>

      {!loading && total > 0 ? (
        <div className="tc-ord-footer">
          <p className="tc-ord-footer-meta">
            Showing {(safePage - 1) * rowsPerPage + 1} to {Math.min(safePage * rowsPerPage, total)} of{' '}
            {total} orders
          </p>
          <div className="tc-ord-pagination">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </button>
            {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
              let p = i + 1;
              if (pages > 5 && safePage > 3) {
                p = safePage - 2 + i;
                if (p > pages) p = pages - (4 - i);
              }
              return (
                <button
                  key={p}
                  type="button"
                  className={p === safePage ? 'active' : ''}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              );
            })}
            <button
              type="button"
              disabled={safePage >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              ›
            </button>
          </div>
          <label className="tc-ord-rows">
            Rows per page
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </div>
  );
}
