import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { openQuoteSendLinks, sendQuoteToFarmer } from '../../lib/quoteSend';
import { SearchSelect } from '../ui';
import {
  BulkMarginReviewBadge,
  type BulkMarginReviewStatus,
} from './BulkMarginReviewBadge';
import { QuoteActionsDropdown } from './QuoteActionsDropdown';
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

type EstimateRow = {
  id: string;
  quotationId: string;
  status: string;
  amount: number;
  prepaidAmount: number;
  codAmount: number;
  paymentType: string;
  preparedByName: string | null;
  sentAt: string | null;
  whatsappSentAt: string | null;
  emailSentAt: string | null;
  createdAt: string;
  expiresAt: string;
  hoursLeft?: number;
  bulkMarginReviewStatus?: BulkMarginReviewStatus;
};

type UnifiedRow =
  | {
      kind: 'estimate';
      id: string;
      displayId: string;
      createdAt: string;
      expiresAt: string;
      hoursLeft?: number;
      amount: number;
      paymentLabel: string;
      status: string;
      preparedByName: string | null;
      sentAt: string | null;
      whatsappSentAt: string | null;
      emailSentAt: string | null;
      bulkMarginReviewStatus?: BulkMarginReviewStatus;
      codAmount?: number;
    }
  | {
      kind: 'order';
      id: string;
      displayId: string;
      createdAt: string;
      amount: number;
      paymentLabel: string;
      status: string;
      order: OrderRow;
    };

type BlockOption = { id: string; name: string };

type Filters = {
  status: string;
  type: '' | 'estimate' | 'order';
  dateFrom: string;
  dateTo: string;
};

const EMPTY_FILTERS: Filters = {
  status: '',
  type: '',
  dateFrom: '',
  dateTo: '',
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function estimateStatusClass(status: string) {
  if (status === 'paid') return 'est-status est-status--paid';
  if (status === 'checkout') return 'est-status est-status--checkout';
  return 'est-status est-status--pending';
}

type Props = {
  leadId: string;
  canWrite: boolean;
  blocks: BlockOption[];
  refreshKey: number;
  onCreateEstimate: () => void;
  onEditEstimate: (id: string) => void;
  onOpenEstimate: (id: string) => void;
  onOpenDetail: (row: OrderListRow) => void;
};

export function OrdersTab({
  leadId,
  canWrite,
  refreshKey,
  onCreateEstimate,
  onEditEstimate,
  onOpenEstimate,
  onOpenDetail,
}: Props) {
  const [estimates, setEstimates] = useState<EstimateRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [estData, ordData] = await Promise.all([
        api<{ ok: boolean; estimates: EstimateRow[] }>(`${base}/leads/${leadId}/estimates`),
        api<{ ok: boolean; orders: OrderRow[] }>(`${base}/leads/${leadId}/orders`),
      ]);
      setEstimates(estData.estimates ?? []);
      setOrders(ordData.orders ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function handleSend(estimateId: string, channels: Array<'whatsapp' | 'email'>) {
    setSendingId(estimateId);
    setError('');
    try {
      const result = await sendQuoteToFarmer(leadId, estimateId, channels);
      openQuoteSendLinks(result);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send quote');
    } finally {
      setSendingId(null);
    }
  }

  async function handleConfirmCod(estimateId: string) {
    if (!window.confirm('Place this quote as a COD order and send to warehouse?')) return;
    setSendingId(estimateId);
    setError('');
    try {
      await api(`${base}/leads/${leadId}/estimates/${estimateId}/confirm-cod`, { method: 'POST' });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm COD order');
    } finally {
      setSendingId(null);
    }
  }

  async function handleDelete(estimateId: string, displayId: string) {
    if (!window.confirm(`Delete quotation ${displayId}? This cannot be undone.`)) return;
    setSendingId(estimateId);
    setError('');
    try {
      await api(`${base}/leads/${leadId}/estimates/${estimateId}`, { method: 'DELETE' });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete quote');
    } finally {
      setSendingId(null);
    }
  }

  const unified = useMemo((): UnifiedRow[] => {
    const estRows: UnifiedRow[] = estimates.map((e) => ({
      kind: 'estimate',
      id: e.id,
      displayId: e.quotationId,
      createdAt: e.createdAt,
      expiresAt: e.expiresAt,
      hoursLeft: e.hoursLeft,
      amount: e.amount,
      paymentLabel:
        e.prepaidAmount > 0
          ? `Advance ₹${e.prepaidAmount.toLocaleString('en-IN')}${e.codAmount > 0 ? ` + COD ₹${e.codAmount.toLocaleString('en-IN')}` : ''}`
          : '—',
      status: e.status,
      preparedByName: e.preparedByName,
      sentAt: e.sentAt,
      whatsappSentAt: e.whatsappSentAt,
      emailSentAt: e.emailSentAt,
      bulkMarginReviewStatus: e.bulkMarginReviewStatus ?? null,
      codAmount: e.codAmount,
    }));
    const ordRows: UnifiedRow[] = orders.map((o) => ({
      kind: 'order',
      id: o.id,
      displayId: o.orderId,
      createdAt: o.createdAt ?? '',
      amount: Number(o.amount ?? 0),
      paymentLabel: [o.paymentLabel, o.paymentSubtext].filter(Boolean).join(' · '),
      status: o.statusLabel ?? o.status ?? '—',
      order: o,
    }));
    return [...estRows, ...ordRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [estimates, orders]);

  const filtered = useMemo(() => {
    return unified.filter((row) => {
      if (filters.type && row.kind !== filters.type) return false;
      if (filters.status) {
        const st = row.kind === 'estimate' ? row.status : row.order.status ?? '';
        if (st !== filters.status && row.status !== filters.status) return false;
      }
      if (filters.dateFrom && row.createdAt && new Date(row.createdAt) < new Date(filters.dateFrom)) {
        return false;
      }
      if (filters.dateTo && row.createdAt) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(row.createdAt) > end) return false;
      }
      return true;
    });
  }, [unified, filters]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / rowsPerPage));
  const safePage = Math.min(page, pages);
  const pageItems = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  function handleRowClick(row: UnifiedRow) {
    if (row.kind === 'estimate') {
      onOpenEstimate(row.id);
      return;
    }
    onOpenDetail({
      id: row.order.id,
      orderId: row.order.orderId,
      dateLabel: row.order.dateLabel,
      productTitle: row.order.productTitle,
      qty: row.order.qty,
      amount: row.order.amount,
      statusLabel: row.order.statusLabel,
    });
  }

  return (
    <div className="tc-orders">
      <div className="tc-ord-header">
        <div>
          <h2 className="tc-ord-title">Orders</h2>
          <p className="tc-ord-subtitle">
            Create quotes for this farmer — click a row for quotation details or order history.
            Quotations expire in 48 hours if unpaid.
          </p>
        </div>
        <div className="tc-ord-header-actions">
          <button
            type="button"
            className="tc-ord-btn-secondary"
            onClick={() => setShowFilters((v) => !v)}
          >
            Filter
          </button>
          {canWrite ? (
            <button type="button" className="tc-ord-btn-primary" onClick={onCreateEstimate}>
              + Create quote
            </button>
          ) : null}
        </div>
      </div>

      {showFilters ? (
        <div className="tc-ord-filters">
          <SearchSelect
            label="Type"
            value={filters.type}
            onChange={(value) => {
              setFilters((f) => ({ ...f, type: value as Filters['type'] }));
              setPage(1);
            }}
            options={[
              { value: '', label: 'All' },
              { value: 'estimate', label: 'Quotation' },
              { value: 'order', label: 'Order' },
            ]}
          />
          <SearchSelect
            label="Status"
            value={filters.status}
            onChange={(value) => {
              setFilters((f) => ({ ...f, status: value }));
              setPage(1);
            }}
            options={[
              { value: '', label: 'All statuses' },
              { value: 'pending', label: 'Pending' },
              { value: 'checkout', label: 'Checkout' },
              { value: 'paid', label: 'Paid' },
              { value: 'processing', label: 'Processing' },
              { value: 'shipped', label: 'Shipped' },
              { value: 'delivered', label: 'Delivered' },
            ]}
          />
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
        ) : pageItems.length === 0 ? (
          <p className="tc-ord-empty">
            No orders yet. Create a quote to send a quotation to this farmer.
          </p>
        ) : (
          <div className="est-table-wrap">
            <table className="est-list-table est-list-table--actions">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>ID</th>
                  <th>Created</th>
                  <th>Valid until</th>
                  <th>Prepared by</th>
                  <th>Amount (₹)</th>
                  <th>Payment</th>
                  <th>Status</th>
                  {canWrite ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} onClick={() => handleRowClick(row)}>
                    <td>{row.kind === 'estimate' ? 'Quotation' : 'Order'}</td>
                    <td>
                      <span className={row.kind === 'estimate' ? 'est-list-id' : 'tc-ord-order-link'}>
                        {row.displayId}
                      </span>
                    </td>
                    <td>{row.createdAt ? formatDate(row.createdAt) : '—'}</td>
                    <td>
                      {row.kind === 'estimate' ? (
                        <>
                          {formatDate(row.expiresAt)}
                          {row.hoursLeft != null && row.status !== 'paid' ? (
                            <small className="block text-slate-500">{row.hoursLeft}h left</small>
                          ) : null}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {row.kind === 'estimate' ? row.preparedByName ?? '—' : '—'}
                      {row.kind === 'estimate' && row.sentAt ? (
                        <small className="block text-slate-500">Sent</small>
                      ) : null}
                    </td>
                    <td>₹{Number(row.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>{row.paymentLabel}</td>
                    <td>
                      {row.kind === 'estimate' ? (
                        <div className="est-status-stack">
                          <span className={estimateStatusClass(row.status)}>{row.status}</span>
                          {row.bulkMarginReviewStatus ? (
                            <BulkMarginReviewBadge status={row.bulkMarginReviewStatus} />
                          ) : null}
                        </div>
                      ) : (
                        <span className="tc-ord-status tc-ord-status--success">{row.status}</span>
                      )}
                    </td>
                    {canWrite && row.kind === 'estimate' ? (
                      <td className="est-list-actions" onClick={(e) => e.stopPropagation()}>
                        <QuoteActionsDropdown
                          status={row.status}
                          codAmount={row.codAmount}
                          bulkMarginReviewStatus={row.bulkMarginReviewStatus}
                          busy={sendingId === row.id}
                          onView={() => onOpenEstimate(row.id)}
                          onEdit={() => onEditEstimate(row.id)}
                          onSendWhatsApp={() => void handleSend(row.id, ['whatsapp'])}
                          onSendMail={() => void handleSend(row.id, ['email'])}
                          onConfirmCod={() => void handleConfirmCod(row.id)}
                          onDelete={() => void handleDelete(row.id, row.displayId)}
                        />
                      </td>
                    ) : canWrite ? (
                      <td>—</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && total > rowsPerPage ? (
        <div className="tc-ord-pagination">
          <button
            type="button"
            className="tc-ord-page-btn"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            Page {safePage} of {pages} · {total} rows
          </span>
          <button
            type="button"
            className="tc-ord-page-btn"
            disabled={safePage >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
          <SearchSelect
            label="Rows"
            className="tc-ord-rows-select"
            value={String(rowsPerPage)}
            onChange={(value) => {
              setRowsPerPage(Number(value));
              setPage(1);
            }}
            options={[10, 20, 50].map((n) => ({ value: String(n), label: String(n) }))}
            compact
          />
        </div>
      ) : null}
    </div>
  );
}
