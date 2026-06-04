import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { paths, toPath } from '../../lib/routes';
import { Modal } from '../Modal';
import '../../styles/commerce-products.css';

type ProductVariant = {
  id: string;
  price: string;
  inventory: number;
};

type ProductRow = {
  id: string;
  title: string;
  status: string;
  vendor: string;
  productType: string;
  category: string;
  bodyHtml: string;
  inventory: number;
  variantCount: number;
  imageUrl: string | null;
  variants: ProductVariant[];
};

type ProductStats = {
  total: number;
  active: number;
  inactive: number;
  lowStock: number;
  outOfStock: number;
  expiringSoon: number;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

type Props = {
  canWrite: boolean;
};

const PAGE_SIZE = 6;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function productSubtitle(p: ProductRow): string {
  const plain = stripHtml(p.bodyHtml);
  if (plain.length > 0) return plain.length > 72 ? `${plain.slice(0, 72)}…` : plain;
  return p.productType || '—';
}

function priceRangeLabel(variants: ProductVariant[]): string {
  const nums = variants
    .map((v) => parseFloat(v.price))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return '—';
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const fmt = (n: number) =>
    `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  if (min === max) return fmt(min);
  return `${fmt(min)} - ${fmt(max)}`;
}

function stockLevel(inventory: number): 'in' | 'low' | 'out' {
  if (inventory === 0) return 'out';
  if (inventory <= 10) return 'low';
  return 'in';
}

function stockPillLabel(level: 'in' | 'low' | 'out'): string {
  if (level === 'out') return 'Out of Stock';
  if (level === 'low') return 'Low Stock';
  return 'In Stock';
}

function categoryBadgeClass(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('insect')) return 'commerce-products__badge--insecticide';
  if (c.includes('fung')) return 'commerce-products__badge--fungicide';
  if (c.includes('fert') || c.includes('nutri')) return 'commerce-products__badge--fertilizer';
  if (c.includes('pgr') || c.includes('growth')) return 'commerce-products__badge--pgr';
  return 'commerce-products__badge--default';
}

function statusLabel(status: string): string {
  if (status === 'active') return 'Active';
  if (status === 'draft') return 'Draft';
  if (status === 'archived') return 'Archived';
  return status;
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

export function CommerceAllProductsPanel({ canWrite }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });

  const [draftSearch, setDraftSearch] = useState('');
  const [draftCategory, setDraftCategory] = useState('all');
  const [draftBrand, setDraftBrand] = useState('all');
  const [draftStatus, setDraftStatus] = useState('all');

  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedCategory, setAppliedCategory] = useState('all');
  const [appliedBrand, setAppliedBrand] = useState('all');
  const [appliedStatus, setAppliedStatus] = useState('all');
  const [appliedStock, setAppliedStock] = useState<'low' | 'out' | 'in' | ''>('');
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statFilter, setStatFilter] = useState<'all' | 'low' | 'out' | 'expiring'>('all');

  const [viewProduct, setViewProduct] = useState<ProductRow | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    if (appliedSearch.trim()) params.set('search', appliedSearch.trim());
    if (appliedCategory !== 'all') params.set('category', appliedCategory);
    if (appliedBrand !== 'all') params.set('brand', appliedBrand);
    if (appliedStatus !== 'all') params.set('status', appliedStatus);
    if (appliedStock) params.set('stock', appliedStock);

    try {
      const d = await api<{
        ok: boolean;
        products: ProductRow[];
        stats: ProductStats;
        categories: string[];
        brands: string[];
        pagination: Pagination;
      }>(`/morbeez-staff/api/v1/products?${params}`);
      setProducts(d.products ?? []);
      setStats(d.stats ?? null);
      setCategories(d.categories ?? []);
      setBrands(d.brands ?? []);
      setPagination(d.pagination ?? { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [page, appliedSearch, appliedCategory, appliedBrand, appliedStatus, appliedStock]);

  useEffect(() => {
    void load();
  }, [load]);

  const allSelected =
    products.length > 0 && products.every((p) => selectedIds.has(p.id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyFilters() {
    setAppliedSearch(draftSearch);
    setAppliedCategory(draftCategory);
    setAppliedBrand(draftBrand);
    setAppliedStatus(draftStatus);
    setPage(1);
  }

  function resetFilters() {
    setDraftSearch('');
    setDraftCategory('all');
    setDraftBrand('all');
    setDraftStatus('all');
    setAppliedSearch('');
    setAppliedCategory('all');
    setAppliedBrand('all');
    setAppliedStatus('all');
    setAppliedStock('');
    setStatFilter('all');
    setPage(1);
  }

  function applyStatFilter(kind: 'all' | 'low' | 'out' | 'expiring') {
    setStatFilter(kind);
    if (kind === 'all') {
      setAppliedStock('');
    } else if (kind === 'low') {
      setAppliedStock('low');
    } else if (kind === 'out') {
      setAppliedStock('out');
    } else {
      setAppliedStock('');
    }
    setPage(1);
  }

  function exportCsv() {
    const header = ['ID', 'Title', 'Category', 'Brand', 'Variants', 'Inventory', 'Status'];
    const rows = products.map((p) =>
      [
        p.id,
        `"${p.title.replace(/"/g, '""')}"`,
        p.category,
        p.vendor,
        String(p.variantCount),
        String(p.inventory),
        p.status,
      ].join(',')
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function archiveProduct(id: string) {
    if (!canWrite || !window.confirm('Archive this product?')) return;
    setMenuId(null);
    try {
      await api(`/morbeez-staff/api/v1/products/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not archive product');
    }
  }

  const rangeStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const rangeEnd = Math.min(pagination.page * pagination.limit, pagination.total);

  const pages = useMemo(
    () => pageNumbers(pagination.page, pagination.pages),
    [pagination.page, pagination.pages]
  );

  return (
    <div className="commerce-products">
      <header className="commerce-products__header">
        <div>
          <h2 className="commerce-products__title">All Products</h2>
          <p className="commerce-products__subtitle">
            Manage all your products, variants and inventory
          </p>
        </div>
        <div className="commerce-products__header-actions">
          <button
            type="button"
            className="commerce-products__btn commerce-products__btn--outline"
            onClick={() => setError('Import will be available in a future release.')}
          >
            <span aria-hidden>↓</span> Import
          </button>
          <button
            type="button"
            className="commerce-products__btn commerce-products__btn--outline"
            onClick={exportCsv}
            disabled={!products.length}
          >
            <span aria-hidden>↑</span> Export
          </button>
          {canWrite ? (
            <button
              type="button"
              className="commerce-products__btn commerce-products__btn--primary"
              onClick={() => navigate(toPath(paths.commerceProductNew))}
            >
              + Add New Product
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="commerce-products__error" role="alert">
          {error}
        </div>
      ) : null}

      {stats ? (
        <div className="commerce-products__stats">
          <button
            type="button"
            className={`commerce-products__stat-card ${statFilter === 'all' ? 'commerce-products__stat-card--active' : ''}`}
            onClick={() => applyStatFilter('all')}
          >
            <div>
              <p className="commerce-products__stat-label">Total Products</p>
              <p className="commerce-products__stat-value">{stats.total}</p>
              <p className="commerce-products__stat-hint">
                Active: {stats.active} · Inactive: {stats.inactive}
              </p>
            </div>
            <span className="commerce-products__stat-icon commerce-products__stat-icon--green" aria-hidden>
              📦
            </span>
          </button>
          <button
            type="button"
            className={`commerce-products__stat-card ${statFilter === 'low' ? 'commerce-products__stat-card--active' : ''}`}
            onClick={() => applyStatFilter('low')}
          >
            <div>
              <p className="commerce-products__stat-label">Low Stock</p>
              <p className="commerce-products__stat-value">{stats.lowStock}</p>
              <p className="commerce-products__stat-hint commerce-products__stat-hint--link">
                View low stock products
              </p>
            </div>
            <span className="commerce-products__stat-icon commerce-products__stat-icon--orange" aria-hidden>
              📂
            </span>
          </button>
          <button
            type="button"
            className={`commerce-products__stat-card ${statFilter === 'out' ? 'commerce-products__stat-card--active' : ''}`}
            onClick={() => applyStatFilter('out')}
          >
            <div>
              <p className="commerce-products__stat-label">Out of Stock</p>
              <p className="commerce-products__stat-value">{stats.outOfStock}</p>
              <p className="commerce-products__stat-hint commerce-products__stat-hint--link">
                View out of stock products
              </p>
            </div>
            <span className="commerce-products__stat-icon commerce-products__stat-icon--red" aria-hidden>
              ⊟
            </span>
          </button>
          <button
            type="button"
            className={`commerce-products__stat-card ${statFilter === 'expiring' ? 'commerce-products__stat-card--active' : ''}`}
            onClick={() => applyStatFilter('expiring')}
          >
            <div>
              <p className="commerce-products__stat-label">Expiring Soon</p>
              <p className="commerce-products__stat-value">{stats.expiringSoon}</p>
              <p className="commerce-products__stat-hint">Within 90 days</p>
            </div>
            <span className="commerce-products__stat-icon commerce-products__stat-icon--yellow" aria-hidden>
              📅
            </span>
          </button>
        </div>
      ) : null}

      <div className="commerce-products__filters">
        <div className="commerce-products__search-wrap">
          <span className="commerce-products__search-icon" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            className="commerce-products__search"
            placeholder="Search products..."
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          />
        </div>
        <select
          className="commerce-products__select"
          value={draftCategory}
          onChange={(e) => setDraftCategory(e.target.value)}
          aria-label="Category"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="commerce-products__select"
          value={draftBrand}
          onChange={(e) => setDraftBrand(e.target.value)}
          aria-label="Brand"
        >
          <option value="all">All Brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          className="commerce-products__select"
          value={draftStatus}
          onChange={(e) => setDraftStatus(e.target.value)}
          aria-label="Status"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <div className="commerce-products__filter-actions">
          <button
            type="button"
            className="commerce-products__btn commerce-products__btn--outline"
            onClick={resetFilters}
          >
            ↺ Reset
          </button>
          <button
            type="button"
            className="commerce-products__btn commerce-products__btn--primary"
            onClick={applyFilters}
          >
            Apply Filters
          </button>
        </div>
      </div>

      <div className="commerce-products__table-card">
        {loading ? (
          <p className="commerce-products__loading">Loading products…</p>
        ) : (
          <>
            <div className="commerce-products__table-wrap">
              <table className="commerce-products__table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        className="commerce-products__checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label="Select all on page"
                      />
                    </th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Brand</th>
                    <th>Variants</th>
                    <th>Price Range</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length ? (
                    products.map((p) => {
                      const level = stockLevel(p.inventory);
                      return (
                        <tr key={p.id}>
                          <td>
                            <input
                              type="checkbox"
                              className="commerce-products__checkbox"
                              checked={selectedIds.has(p.id)}
                              onChange={() => toggleOne(p.id)}
                              aria-label={`Select ${p.title}`}
                            />
                          </td>
                          <td>
                            <div className="commerce-products__product-cell">
                              {p.imageUrl ? (
                                <img
                                  src={p.imageUrl}
                                  alt=""
                                  className="commerce-products__thumb"
                                />
                              ) : (
                                <div
                                  className="commerce-products__thumb commerce-products__thumb--placeholder"
                                  aria-hidden
                                >
                                  📷
                                </div>
                              )}
                              <div>
                                <p className="commerce-products__product-name">{p.title}</p>
                                <p className="commerce-products__product-sub">
                                  {productSubtitle(p)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`commerce-products__badge ${categoryBadgeClass(p.category)}`}
                            >
                              {p.category}
                            </span>
                          </td>
                          <td>{p.vendor || '—'}</td>
                          <td>
                            <span className="commerce-products__variants">
                              {p.variantCount} Variant{p.variantCount === 1 ? '' : 's'}
                            </span>
                          </td>
                          <td>{priceRangeLabel(p.variants)}</td>
                          <td>
                            <div className="commerce-products__stock-cell">
                              <span className="commerce-products__stock-qty">
                                {p.inventory.toLocaleString('en-IN')}
                              </span>
                              <span
                                className={`commerce-products__stock-pill commerce-products__stock-pill--${level}`}
                              >
                                {stockPillLabel(level)}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span
                              className={
                                p.status === 'active'
                                  ? 'commerce-products__status-active'
                                  : p.status === 'archived'
                                    ? 'commerce-products__status-archived'
                                    : 'commerce-products__status-draft'
                              }
                            >
                              {statusLabel(p.status)}
                            </span>
                          </td>
                          <td style={{ position: 'relative' }}>
                            <div className="commerce-products__actions">
                              <button
                                type="button"
                                className="commerce-products__action-btn"
                                title="View"
                                onClick={() => setViewProduct(p)}
                              >
                                👁
                              </button>
                              <button
                                type="button"
                                className="commerce-products__action-btn"
                                title="Edit"
                                onClick={() =>
                                  navigate(toPath(`${paths.commerce}/products/${p.id}/edit`))
                                }
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                className="commerce-products__action-btn"
                                title="More"
                                onClick={() =>
                                  setMenuId((id) => (id === p.id ? null : p.id))
                                }
                              >
                                ⋮
                              </button>
                              {menuId === p.id && canWrite ? (
                                <div
                                  style={{
                                    position: 'absolute',
                                    marginTop: 4,
                                    background: '#fff',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 8,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                    zIndex: 2,
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="commerce-products__btn"
                                    style={{ display: 'block', width: '100%' }}
                                    onClick={() => void archiveProduct(p.id)}
                                  >
                                    Archive
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9}>
                        <p className="commerce-products__empty">No products match your filters.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <footer className="commerce-products__footer">
              <p className="commerce-products__footer-meta">
                Showing {rangeStart} to {rangeEnd} of {pagination.total} products
              </p>
              <nav className="commerce-products__pagination" aria-label="Pagination">
                <button
                  type="button"
                  className="commerce-products__page-btn"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ‹
                </button>
                {pages.map((p, i) =>
                  p === 'ellipsis' ? (
                    <span key={`e-${i}`} className="commerce-products__page-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`commerce-products__page-btn ${pagination.page === p ? 'commerce-products__page-btn--active' : ''}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="commerce-products__page-btn"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                >
                  ›
                </button>
              </nav>
            </footer>
          </>
        )}
      </div>

      {viewProduct ? (
        <Modal
          title={viewProduct.title}
          onClose={() => setViewProduct(null)}
          onSave={() => setViewProduct(null)}
          saveLabel="Close"
        >
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              <strong>Brand:</strong> {viewProduct.vendor || '—'}
            </p>
            <p>
              <strong>Category:</strong> {viewProduct.category}
            </p>
            <p>
              <strong>Variants:</strong> {viewProduct.variantCount}
            </p>
            <p>
              <strong>Price range:</strong> {priceRangeLabel(viewProduct.variants)}
            </p>
            <p>
              <strong>Stock:</strong> {viewProduct.inventory} ({stockPillLabel(stockLevel(viewProduct.inventory))})
            </p>
            <p>
              <strong>Status:</strong> {statusLabel(viewProduct.status)}
            </p>
            {stripHtml(viewProduct.bodyHtml) ? (
              <p>
                <strong>Description:</strong> {stripHtml(viewProduct.bodyHtml)}
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}

    </div>
  );
}
