import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { paths, toPath } from '../../lib/routes';
import { Modal } from '../Modal';
import { StaticSelect } from '../ui';
import { InventoryFulfillmentView } from '../inventory/InventoryFulfillmentView';
import { AddStockModal } from './AddStockModal';
import { InventoryGrnModal } from './InventoryGrnModal';
import { InventoryPurchaseOrderModal } from './InventoryPurchaseOrderModal';
import '../../styles/commerce-inventory.css';

export type InventoryViewMode = 'catalog' | 'fulfillment';

type InventoryRow = {
  productId: string;
  variantId: string;
  title: string;
  imageUrl: string | null;
  variant: string;
  batchNo: string;
  expiryDate: string;
  stock: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  unitValueInr: number;
};

type InventoryStats = {
  totalStockValue: number;
  totalStock: number;
  lowStockProducts: number;
  outOfStockProducts: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

type StatusFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';

const PAGE_SIZE = 10;

function formatInr(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function statusLabel(status: InventoryRow['status']): string {
  if (status === 'out_of_stock') return 'Out of Stock';
  if (status === 'low_stock') return 'Low Stock';
  return 'In Stock';
}

function statusClass(status: InventoryRow['status']): string {
  if (status === 'out_of_stock') return 'commerce-inventory__status--out';
  if (status === 'low_stock') return 'commerce-inventory__status--low';
  return 'commerce-inventory__status--in';
}

function pageNumbers(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: Array<number | 'ellipsis'> = [1];
  if (current > 3) pages.push('ellipsis');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let p = start; p <= end; p++) pages.push(p);
  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);
  return pages;
}

type Props = {
  canWrite?: boolean;
  canWarehouseWrite?: boolean;
  view?: InventoryViewMode;
  onViewChange?: (view: InventoryViewMode) => void;
};

export function CommerceInventoryPanel({
  canWrite = false,
  canWarehouseWrite = false,
  view: viewProp,
  onViewChange,
}: Props) {
  const navigate = useNavigate();
  const [viewInternal, setViewInternal] = useState<InventoryViewMode>('catalog');
  const view = viewProp ?? viewInternal;

  const setView = useCallback(
    (next: InventoryViewMode) => {
      if (onViewChange) onViewChange(next);
      else setViewInternal(next);
    },
    [onViewChange]
  );
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [draftSearch, setDraftSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [statFilter, setStatFilter] = useState<StatusFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [viewRow, setViewRow] = useState<InventoryRow | null>(null);
  const [addStockVariantId, setAddStockVariantId] = useState<string | null>(null);
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [grnOpen, setGrnOpen] = useState(false);
  const [grnPoId, setGrnPoId] = useState<string | undefined>();

  const load = useCallback(async () => {
    if (view !== 'catalog') return;
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    if (appliedSearch.trim()) params.set('search', appliedSearch.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);

    try {
      const d = await api<{
        ok: boolean;
        rows: InventoryRow[];
        stats: InventoryStats;
        pagination: Pagination;
      }>(`/morbeez-staff/api/v1/inventory?${params}`);
      setRows(d.rows ?? []);
      setStats(d.stats ?? null);
      setPagination(d.pagination ?? { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [page, appliedSearch, statusFilter, view]);

  useEffect(() => {
    void load();
  }, [load]);

  function applySearch() {
    setAppliedSearch(draftSearch);
    setPage(1);
  }

  function applyStatFilter(kind: StatusFilter) {
    setStatFilter(kind);
    setStatusFilter(kind);
    setPage(1);
  }

  const pages = useMemo(
    () => pageNumbers(pagination.page, pagination.pages),
    [pagination.page, pagination.pages]
  );

  const rangeStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const rangeEnd = Math.min(pagination.page * pagination.limit, pagination.total);

  const searchForFulfillment = appliedSearch.trim() || draftSearch.trim();

  return (
    <div className="commerce-inventory">
      <div className="commerce-inventory__header">
        <h2 className="commerce-inventory__title">Inventory</h2>
        <div className="commerce-inventory__header-actions">
          {canWrite && view === 'catalog' ? (
            <button
              type="button"
              className="commerce-inventory__add-btn"
              onClick={() => {
                setAddStockVariantId(null);
                setAddStockOpen(true);
              }}
            >
              + Add Stock
            </button>
          ) : null}
          {canWarehouseWrite && view === 'catalog' ? (
            <>
              <button
                type="button"
                className="commerce-inventory__secondary-btn"
                onClick={() => setPoOpen(true)}
              >
                Purchase Order
              </button>
              <button
                type="button"
                className="commerce-inventory__secondary-btn"
                onClick={() => {
                  setGrnPoId(undefined);
                  setGrnOpen(true);
                }}
              >
                Receive GRN
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="commerce-inventory__view-tabs" role="tablist" aria-label="Inventory view">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'catalog'}
          className={`commerce-inventory__view-tab${view === 'catalog' ? ' commerce-inventory__view-tab--active' : ''}`}
          onClick={() => setView('catalog')}
        >
          Catalog &amp; batches
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'fulfillment'}
          className={`commerce-inventory__view-tab${view === 'fulfillment' ? ' commerce-inventory__view-tab--active' : ''}`}
          onClick={() => setView('fulfillment')}
        >
          Fulfillment stock
        </button>
      </div>

      {view === 'catalog' && canWarehouseWrite ? (
        <p className="commerce-inventory__intro muted">
          <strong>Add Stock</strong> updates Shopify catalog stock and syncs batches to warehouse
          fulfillment. Switch to <strong>Fulfillment stock</strong> for available / reserved /
          rack-level view.{' '}
          <Link to={toPath(`${paths.warehouse}?tab=stock`)} className="commerce-warehouse-link">
            Warehouse hub
          </Link>
        </p>
      ) : null}

      {view === 'fulfillment' ? (
        <p className="commerce-inventory__intro muted">
          Pickable quantities for orders — same catalog as above, with <strong>reserved</strong> and{' '}
          <strong>rack</strong> detail. Set <strong>packaging</strong> (dead weight, category, preferred box) per
          SKU for automatic courier dimensions. Use <strong>Catalog &amp; batches</strong> to add stock or receive
          GRN.
        </p>
      ) : null}

      {error ? (
        <div className="commerce-inventory__error" role="alert">
          {error}
        </div>
      ) : null}

      {view === 'catalog' && stats ? (
        <div className="commerce-inventory__stats">
          <button
            type="button"
            className={`commerce-inventory__stat-card ${statFilter === 'all' ? 'commerce-inventory__stat-card--active' : ''}`}
            onClick={() => applyStatFilter('all')}
          >
            <p className="commerce-inventory__stat-label">Total Stock Value</p>
            <p className="commerce-inventory__stat-value">
              {formatInr(stats.totalStockValue)}
            </p>
          </button>
          <button
            type="button"
            className={`commerce-inventory__stat-card ${statFilter === 'in_stock' ? 'commerce-inventory__stat-card--active' : ''}`}
            onClick={() => applyStatFilter('in_stock')}
          >
            <p className="commerce-inventory__stat-label">Total Stock</p>
            <p className="commerce-inventory__stat-value commerce-inventory__stat-value--green">
              {stats.totalStock.toLocaleString('en-IN')} Units
            </p>
          </button>
          <button
            type="button"
            className={`commerce-inventory__stat-card ${statFilter === 'low_stock' ? 'commerce-inventory__stat-card--active' : ''}`}
            onClick={() => applyStatFilter('low_stock')}
          >
            <p className="commerce-inventory__stat-label">Low Stock</p>
            <p className="commerce-inventory__stat-value commerce-inventory__stat-value--orange">
              {stats.lowStockProducts} Products
            </p>
          </button>
          <button
            type="button"
            className={`commerce-inventory__stat-card ${statFilter === 'out_of_stock' ? 'commerce-inventory__stat-card--active' : ''}`}
            onClick={() => applyStatFilter('out_of_stock')}
          >
            <p className="commerce-inventory__stat-label">Out of Stock</p>
            <p className="commerce-inventory__stat-value commerce-inventory__stat-value--red">
              {stats.outOfStockProducts} Products
            </p>
          </button>
        </div>
      ) : null}

      <div className="commerce-inventory__toolbar">
        <div className="commerce-inventory__search-wrap">
          <span className="commerce-inventory__search-icon" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            className="commerce-inventory__search"
            placeholder={view === 'fulfillment' ? 'Search SKU or product…' : 'Search products...'}
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
          />
        </div>
        {view === 'catalog' ? (
          <button
            type="button"
            className="commerce-inventory__filter-btn"
            onClick={() => setFiltersOpen((o) => !o)}
            aria-expanded={filtersOpen}
          >
            <span aria-hidden>▾</span> Filters
          </button>
        ) : null}
        <button
          type="button"
          className="commerce-inventory__filter-btn"
          style={{ background: '#1b5e20', color: '#fff', borderColor: '#1b5e20' }}
          onClick={applySearch}
        >
          Search
        </button>
      </div>

      {view === 'catalog' && filtersOpen ? (
        <div className="commerce-inventory__filter-panel">
          <StaticSelect
            label="Stock status"
            value={statusFilter}
            onChange={(value) => {
              const v = value as StatusFilter;
              setStatusFilter(v);
              setStatFilter(v);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'in_stock', label: 'In Stock' },
              { value: 'low_stock', label: 'Low Stock' },
              { value: 'out_of_stock', label: 'Out of Stock' },
            ]}
          />
          <button
            type="button"
            className="commerce-inventory__filter-btn"
            onClick={() => {
              setDraftSearch('');
              setAppliedSearch('');
              setStatusFilter('all');
              setStatFilter('all');
              setPage(1);
            }}
          >
            Reset
          </button>
          <button
            type="button"
            className="commerce-inventory__filter-btn"
            style={{ background: '#1b5e20', color: '#fff', borderColor: '#1b5e20' }}
            onClick={applySearch}
          >
            Apply
          </button>
        </div>
      ) : null}

      {view === 'fulfillment' ? (
        <div className="commerce-inventory__table-card commerce-inventory__fulfillment-wrap">
          <InventoryFulfillmentView
            canWrite={canWrite || canWarehouseWrite}
            searchQuery={searchForFulfillment}
            hideSearch
          />
        </div>
      ) : null}

      {view === 'catalog' ? (
      <div className="commerce-inventory__table-card">
        {loading ? (
          <p className="commerce-inventory__loading">Loading inventory…</p>
        ) : (
          <>
            <div className="commerce-inventory__table-wrap">
              <table className="commerce-inventory__table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Variant</th>
                    <th>Batch No.</th>
                    <th>Expiry Date</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th style={{ width: 90 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? (
                    rows.map((r) => (
                      <tr key={`${r.productId}-${r.variantId}`}>
                        <td>
                          <span className="commerce-inventory__product-name">{r.title}</span>
                        </td>
                        <td>{r.variant}</td>
                        <td>{r.batchNo}</td>
                        <td>{r.expiryDate}</td>
                        <td>{r.stock.toLocaleString('en-IN')}</td>
                        <td>
                          <span
                            className={`commerce-inventory__status ${statusClass(r.status)}`}
                          >
                            {statusLabel(r.status)}
                          </span>
                        </td>
                        <td>
                          <div className="commerce-inventory__actions">
                            <button
                              type="button"
                              className="commerce-inventory__action-btn"
                              title="View"
                              onClick={() => setViewRow(r)}
                            >
                              👁
                            </button>
                            {canWrite ? (
                              <button
                                type="button"
                                className="commerce-inventory__action-btn"
                                title="Add stock"
                                onClick={() => {
                                  setAddStockVariantId(r.variantId);
                                  setAddStockOpen(true);
                                }}
                              >
                                +
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="commerce-inventory__action-btn"
                              title="Edit product"
                              onClick={() =>
                                navigate(
                                  toPath(`${paths.commerce}/products/${r.productId}/edit`)
                                )
                              }
                            >
                              ✎
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        <p className="commerce-inventory__empty">
                          No inventory rows match your filters.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {pagination.total > 0 ? (
              <footer className="commerce-inventory__footer">
                <span>
                  Showing {rangeStart} to {rangeEnd} of {pagination.total} variants
                </span>
                {pagination.pages > 1 ? (
                  <nav className="commerce-inventory__pagination" aria-label="Pagination">
                    <button
                      type="button"
                      className="commerce-inventory__page-btn"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      ‹
                    </button>
                    {pages.map((p, i) =>
                      p === 'ellipsis' ? (
                        <span key={`e-${i}`}>…</span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          className={`commerce-inventory__page-btn ${pagination.page === p ? 'commerce-inventory__page-btn--active' : ''}`}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      className="commerce-inventory__page-btn"
                      disabled={pagination.page >= pagination.pages}
                      onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    >
                      ›
                    </button>
                  </nav>
                ) : null}
              </footer>
            ) : null}
          </>
        )}
      </div>
      ) : null}

      {addStockOpen && canWrite ? (
        <AddStockModal
          initialVariantId={addStockVariantId ?? undefined}
          onClose={() => {
            setAddStockOpen(false);
            setAddStockVariantId(null);
          }}
          onSaved={() => void load()}
        />
      ) : null}

      {poOpen && canWarehouseWrite ? (
        <InventoryPurchaseOrderModal
          canWrite={canWarehouseWrite}
          onClose={() => setPoOpen(false)}
          onReceivePo={(poId) => {
            setPoOpen(false);
            setGrnPoId(poId);
            setGrnOpen(true);
          }}
        />
      ) : null}

      {grnOpen && canWarehouseWrite ? (
        <InventoryGrnModal
          canWrite={canWarehouseWrite}
          purchaseOrderId={grnPoId}
          onClose={() => {
            setGrnOpen(false);
            setGrnPoId(undefined);
          }}
          onSaved={() => void load()}
        />
      ) : null}

      {viewRow ? (
        <Modal
          title={viewRow.title}
          onClose={() => setViewRow(null)}
          onSave={() => setViewRow(null)}
          saveLabel="Close"
        >
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              <strong>Variant:</strong> {viewRow.variant}
            </p>
            <p>
              <strong>Batch No.:</strong> {viewRow.batchNo}
            </p>
            <p>
              <strong>Expiry Date:</strong> {viewRow.expiryDate}
            </p>
            <p>
              <strong>Stock:</strong> {viewRow.stock} ({statusLabel(viewRow.status)})
            </p>
            <p>
              <strong>Line value:</strong> {formatInr(viewRow.unitValueInr)}
            </p>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
