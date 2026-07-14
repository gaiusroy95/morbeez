import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { paths, toPath } from '../../lib/routes';
import { Modal } from '../Modal';
import {
  Alert,
  Btn,
  Field,
  FilterBar,
  HubTabs,
  Input,
  Loading,
  Panel,
  StaticSelect,
} from '../ui';
import { FilterableStatCard } from '../employees/employee-ui';
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-xl font-bold text-ink">Inventory</h2>
        <div className="flex flex-wrap gap-2">
          {canWrite && view === 'catalog' ? (
            <Btn
              variant="primary"
              onClick={() => {
                setAddStockVariantId(null);
                setAddStockOpen(true);
              }}
            >
              + Add Stock
            </Btn>
          ) : null}
          {canWarehouseWrite && view === 'catalog' ? (
            <>
              <Btn variant="secondary" onClick={() => setPoOpen(true)}>
                Purchase Order
              </Btn>
              <Btn
                variant="secondary"
                onClick={() => {
                  setGrnPoId(undefined);
                  setGrnOpen(true);
                }}
              >
                Receive GRN
              </Btn>
            </>
          ) : null}
        </div>
      </div>

      <HubTabs
        tabs={[
          { id: 'catalog' as const, label: 'Catalog & batches' },
          { id: 'fulfillment' as const, label: 'Fulfillment stock' },
        ]}
        active={view}
        onChange={setView}
      />

      {view === 'catalog' && canWarehouseWrite ? (
        <p className="text-sm text-ink-secondary">
          <strong className="text-ink">Add Stock</strong> updates Shopify catalog stock and syncs batches to warehouse
          fulfillment. Switch to <strong className="text-ink">Fulfillment stock</strong> for available / reserved /
          rack-level view.{' '}
          <Link to={toPath(`${paths.warehouse}?tab=stock`)} className="font-semibold text-brand-700 hover:underline">
            Warehouse hub
          </Link>
        </p>
      ) : null}

      {view === 'fulfillment' ? (
        <p className="text-sm text-ink-secondary">
          Pickable quantities for orders — same catalog as above, with <strong className="text-ink">reserved</strong> and{' '}
          <strong className="text-ink">rack</strong> detail. Set <strong className="text-ink">packaging</strong> (dead weight, category, preferred box) per
          SKU for automatic courier dimensions. Use <strong className="text-ink">Catalog &amp; batches</strong> to add stock or receive
          GRN.
        </p>
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      {view === 'catalog' && stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FilterableStatCard
            label="Total Stock Value"
            value={formatInr(stats.totalStockValue)}
            active={statFilter === 'all'}
            onClick={() => applyStatFilter('all')}
          />
          <FilterableStatCard
            label="Total Stock"
            value={`${stats.totalStock.toLocaleString('en-IN')} Units`}
            valueClassName="text-brand-600"
            active={statFilter === 'in_stock'}
            onClick={() => applyStatFilter('in_stock')}
          />
          <FilterableStatCard
            label="Low Stock"
            value={`${stats.lowStockProducts} Products`}
            valueClassName="text-amber-600"
            active={statFilter === 'low_stock'}
            onClick={() => applyStatFilter('low_stock')}
          />
          <FilterableStatCard
            label="Out of Stock"
            value={`${stats.outOfStockProducts} Products`}
            valueClassName="text-red-600"
            active={statFilter === 'out_of_stock'}
            onClick={() => applyStatFilter('out_of_stock')}
          />
        </div>
      ) : null}

      <FilterBar>
        <div className="relative min-w-[240px] flex-1">
          <Input
            type="search"
            placeholder={view === 'fulfillment' ? 'Search SKU or product…' : 'Search products...'}
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            className="pl-9"
          />
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            aria-hidden
          >
            ⌕
          </span>
        </div>
        {view === 'catalog' ? (
          <Btn variant="secondary" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
            Filters
          </Btn>
        ) : null}
        <Btn variant="primary" onClick={applySearch}>
          Search
        </Btn>
      </FilterBar>

      {view === 'catalog' && filtersOpen ? (
        <Panel bodyClassName="flex flex-wrap items-end gap-3">
          <Field label="Stock status" className="min-w-[180px] flex-1">
            <StaticSelect
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
          </Field>
          <Btn
            variant="ghost"
            onClick={() => {
              setDraftSearch('');
              setAppliedSearch('');
              setStatusFilter('all');
              setStatFilter('all');
              setPage(1);
            }}
          >
            Reset
          </Btn>
          <Btn variant="secondary" onClick={applySearch}>
            Apply
          </Btn>
        </Panel>
      ) : null}

      {view === 'fulfillment' ? (
        <Panel bodyClassName="p-0 overflow-hidden">
          <InventoryFulfillmentView
            canWrite={canWrite || canWarehouseWrite}
            searchQuery={searchForFulfillment}
            hideSearch
          />
        </Panel>
      ) : null}

      {view === 'catalog' ? (
      <Panel bodyClassName="p-0">
        {loading ? (
          <Loading label="Loading inventory…" />
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
      </Panel>
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
          <div className="space-y-2 text-sm text-ink-secondary">
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
