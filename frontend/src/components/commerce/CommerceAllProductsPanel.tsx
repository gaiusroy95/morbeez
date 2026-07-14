import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { paths, toPath } from '../../lib/routes';
import { useSuperAdminConfirm } from '../../hooks/useSuperAdminConfirm';
import { Modal } from '../Modal';
import {
  Alert,
  Btn,
  Field,
  FilterBar,
  Input,
  Loading,
  Panel,
  StaticSelect,
} from '../ui';
import { FilterableStatCard } from '../employees/employee-ui';
import { ProductActionMenu } from './ProductActionMenu';
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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200] as const;
const DEFAULT_PAGE_SIZE = 20;

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

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function parseProductImportCsv(text: string): Array<{
  id?: string;
  title: string;
  category?: string;
  brand?: string;
  status?: string;
}> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (name: string) => headers.indexOf(name);

  const idIdx = idx('id');
  const titleIdx = idx('title');
  const categoryIdx = idx('category');
  const brandIdx = idx('brand');
  const statusIdx = idx('status');

  if (titleIdx < 0) return [];

  const rows: Array<{
    id?: string;
    title: string;
    category?: string;
    brand?: string;
    status?: string;
  }> = [];

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const title = cells[titleIdx]?.trim();
    if (!title) continue;
    rows.push({
      id: idIdx >= 0 ? cells[idIdx]?.trim() || undefined : undefined,
      title,
      category: categoryIdx >= 0 ? cells[categoryIdx]?.trim() || undefined : undefined,
      brand: brandIdx >= 0 ? cells[brandIdx]?.trim() || undefined : undefined,
      status: statusIdx >= 0 ? cells[statusIdx]?.trim() || undefined : undefined,
    });
  }

  return rows;
}

export function CommerceAllProductsPanel({ canWrite }: Props) {
  const navigate = useNavigate();
  const { canEditDelete, requestConfirm, confirmModal } = useSuperAdminConfirm();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(0);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
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
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [statFilter, setStatFilter] = useState<'all' | 'low' | 'out' | 'expiring'>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [viewProduct, setViewProduct] = useState<ProductRow | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [shopifyStatus, setShopifyStatus] = useState<{
    connected: boolean;
    storeDomain: string;
    storefrontUrl: string;
    productCount: number;
    storeMismatch: boolean;
    message: string;
  } | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishingAll, setPublishingAll] = useState(false);

  const closeMenu = useCallback(() => {
    setMenuId(null);
    setMenuAnchor(null);
  }, []);

  const menuProduct = useMemo(
    () => (menuId ? products.find((p) => p.id === menuId) ?? null : null),
    [menuId, products]
  );

  const loadShopifyStatus = useCallback(async () => {
    try {
      const d = await api<{
        ok: boolean;
        connected: boolean;
        storeDomain: string;
        storefrontUrl: string;
        productCount: number;
        storeMismatch: boolean;
        message: string;
      }>('/morbeez-staff/api/v1/products/shopify-connection');
      setShopifyStatus(d);
    } catch {
      setShopifyStatus(null);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(pageSize));
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
      setPagination(d.pagination ?? { page: 1, limit: pageSize, total: 0, pages: 1 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, appliedSearch, appliedCategory, appliedBrand, appliedStatus, appliedStock]);

  useEffect(() => {
    void load();
    void loadShopifyStatus();
  }, [load, loadShopifyStatus]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, pageSize, appliedSearch, appliedCategory, appliedBrand, appliedStatus, appliedStock]);

  async function publishToStorefront(product: ProductRow) {
    if (!canWrite) return;
    closeMenu();
    setPublishingId(product.id);
    setError('');
    try {
      await api(`/morbeez-staff/api/v1/products/${product.id}/publish-storefront`, {
        method: 'POST',
      });
      await load();
      await loadShopifyStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish product to storefront');
    } finally {
      setPublishingId(null);
    }
  }

  async function publishAllToStorefront() {
    if (!canWrite) return;
    setPublishingAll(true);
    setError('');
    try {
      const d = await api<{ ok: boolean; published: number; failed: string[] }>(
        '/morbeez-staff/api/v1/products/publish-all-storefront',
        { method: 'POST' }
      );
      if (d.failed?.length) {
        setError(
          `Published ${d.published} product${d.published === 1 ? '' : 's'}; ${d.failed.length} failed.`
        );
      }
      await load();
      await loadShopifyStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish products to storefront');
    } finally {
      setPublishingAll(false);
    }
  }

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
    setNotice('');
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

  async function handleImportFile(file: File) {
    if (!canWrite) return;
    setImporting(true);
    setError('');
    setNotice('');
    try {
      const text = await file.text();
      const rows = parseProductImportCsv(text);
      setImportPreview(rows.length);
      if (!rows.length) {
        setError('No valid product rows found. Use the Export CSV format (Title column required).');
        return;
      }
      const result = await api<{
        ok: boolean;
        created: number;
        updated: number;
        failed: Array<{ row: number; title: string; error: string }>;
      }>('/morbeez-staff/api/v1/products/import', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      });
      setImportOpen(false);
      setNotice(
        `Import complete: ${result.created} created, ${result.updated} updated${
          result.failed?.length ? `, ${result.failed.length} failed` : ''
        }.`
      );
      if (result.failed?.length) {
        setError(
          result.failed
            .slice(0, 3)
            .map((f) => `Row ${f.row} (${f.title}): ${f.error}`)
            .join(' · ')
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  function hideProduct(product: ProductRow) {
    if (!canEditDelete) return;
    closeMenu();
    requestConfirm('hide', product.title, async (confirmPassword) => {
      await api(`/morbeez-staff/api/v1/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'draft', confirmPassword }),
      });
      await load();
    });
  }

  function unhideProduct(product: ProductRow) {
    if (!canEditDelete) return;
    closeMenu();
    requestConfirm('unhide', product.title, async (confirmPassword) => {
      await api(`/morbeez-staff/api/v1/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'active', confirmPassword }),
      });
      await load();
    });
  }

  function archiveProduct(product: ProductRow) {
    if (!canEditDelete) return;
    closeMenu();
    requestConfirm('delete', product.title, async (confirmPassword) => {
      await api(`/morbeez-staff/api/v1/products/${product.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmPassword }),
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
      await load();
    });
  }

  async function batchArchiveSelected() {
    if (!canWrite || selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (
      !window.confirm(
        `Delete ${count} selected product${count === 1 ? '' : 's'}? They will be archived and hidden from this list.`
      )
    ) {
      return;
    }

    setBatchDeleting(true);
    setError('');
    try {
      const ids = [...selectedIds];
      const res = await api<{ ok: boolean; archived: string[]; failed: string[] }>(
        '/morbeez-staff/api/v1/products/batch-archive',
        { method: 'POST', body: JSON.stringify({ ids }) }
      );
      setSelectedIds(new Set());
      if (res.failed?.length) {
        setError(
          `Archived ${res.archived.length} product(s). ${res.failed.length} could not be archived.`
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not archive selected products');
    } finally {
      setBatchDeleting(false);
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const rangeStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const rangeEnd = Math.min(pagination.page * pagination.limit, pagination.total);

  const pages = useMemo(
    () => pageNumbers(pagination.page, pagination.pages),
    [pagination.page, pagination.pages]
  );

  const showShopifyWarning =
    shopifyStatus &&
    (!shopifyStatus.connected || shopifyStatus.storeMismatch);

  return (
    <div className="commerce-products space-y-4">
      {showShopifyWarning ? (
        <Alert tone="warn">
          <strong>Shopify storefront issue:</strong> {shopifyStatus.message}
          {shopifyStatus.storefrontUrl ? (
            <>
              {' '}
              <a
                href={`${shopifyStatus.storefrontUrl}/collections/all`}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-brand-700 hover:underline"
              >
                Open storefront
              </a>
            </>
          ) : null}
        </Alert>
      ) : shopifyStatus?.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border/80 bg-brand-50 px-4 py-3 text-sm text-ink-secondary">
          <span>
            Shopify: {shopifyStatus.storeDomain} · {shopifyStatus.productCount} product
            {shopifyStatus.productCount === 1 ? '' : 's'} synced
          </span>
          {canWrite && shopifyStatus.productCount > 0 ? (
            <Btn variant="secondary" disabled={publishingAll} onClick={() => void publishAllToStorefront()}>
              {publishingAll ? 'Publishing…' : 'Publish all to storefront'}
            </Btn>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">All Products</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Manage all your products, variants and inventory
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn
            variant="secondary"
            disabled={!canWrite}
            onClick={() => {
              setError('');
              setNotice('');
              setImportPreview(0);
              setImportOpen(true);
            }}
          >
            Import
          </Btn>
          <Btn variant="secondary" onClick={exportCsv} disabled={!products.length}>
            Export
          </Btn>
          {canWrite ? (
            <Btn variant="primary" onClick={() => navigate(toPath(paths.commerceProductNew))}>
              + Add New Product
            </Btn>
          ) : null}
        </div>
      </div>

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {stats ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FilterableStatCard
            label="Total Products"
            value={stats.total}
            sub={`Active: ${stats.active} · Inactive: ${stats.inactive}`}
            active={statFilter === 'all'}
            onClick={() => applyStatFilter('all')}
          />
          <FilterableStatCard
            label="Low Stock"
            value={stats.lowStock}
            sub="View low stock products"
            active={statFilter === 'low'}
            onClick={() => applyStatFilter('low')}
          />
          <FilterableStatCard
            label="Out of Stock"
            value={stats.outOfStock}
            sub="View out of stock products"
            active={statFilter === 'out'}
            onClick={() => applyStatFilter('out')}
          />
          <FilterableStatCard
            label="Expiring Soon"
            value={stats.expiringSoon}
            sub="Within 90 days"
            active={statFilter === 'expiring'}
            onClick={() => applyStatFilter('expiring')}
          />
        </div>
      ) : null}

      <FilterBar>
        <div className="relative min-w-[240px] flex-1">
          <Input
            type="search"
            placeholder="Search products..."
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            className="pl-9"
          />
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            aria-hidden
          >
            ⌕
          </span>
        </div>
        <Btn variant="secondary" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
          Filters
        </Btn>
        <Btn variant="primary" onClick={applyFilters}>
          Search
        </Btn>
      </FilterBar>

      {filtersOpen ? (
        <Panel bodyClassName="flex flex-wrap items-end gap-3">
          <Field label="Category" className="min-w-[160px] flex-1">
            <StaticSelect
              value={draftCategory}
              onChange={setDraftCategory}
              options={[
                { value: 'all', label: 'All Categories' },
                ...categories.map((c) => ({ value: c, label: c })),
              ]}
            />
          </Field>
          <Field label="Brand" className="min-w-[160px] flex-1">
            <StaticSelect
              value={draftBrand}
              onChange={setDraftBrand}
              options={[
                { value: 'all', label: 'All Brands' },
                ...brands.map((b) => ({ value: b, label: b })),
              ]}
            />
          </Field>
          <Field label="Status" className="min-w-[140px] flex-1">
            <StaticSelect
              value={draftStatus}
              onChange={setDraftStatus}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'draft', label: 'Draft' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </Field>
          <Btn variant="ghost" onClick={resetFilters}>
            Reset
          </Btn>
          <Btn variant="secondary" onClick={applyFilters}>
            Apply Filters
          </Btn>
        </Panel>
      ) : null}

      {selectedIds.size > 0 && canWrite ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border/80 bg-surface-elevated px-4 py-3 shadow-[var(--shadow-card)]"
          role="toolbar"
          aria-label="Batch actions"
        >
          <span className="text-sm font-semibold text-ink">{selectedIds.size} selected</span>
          <div className="flex flex-wrap gap-2">
            <Btn variant="secondary" onClick={clearSelection} disabled={batchDeleting}>
              Clear selection
            </Btn>
            <Btn variant="danger" onClick={() => void batchArchiveSelected()} disabled={batchDeleting}>
              {batchDeleting ? 'Deleting…' : 'Delete selected'}
            </Btn>
          </div>
        </div>
      ) : null}

      <Panel bodyClassName="p-0">
        {loading ? (
          <Loading label="Loading products…" />
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
                          <td className="commerce-products__actions-cell">
                            <div className="commerce-products__actions">
                              <button
                                type="button"
                                className={`commerce-products__action-btn commerce-products__action-btn--more${
                                  menuId === p.id ? ' is-open' : ''
                                }`}
                                title="Actions"
                                aria-expanded={menuId === p.id}
                                aria-haspopup="menu"
                                onClick={(e) => {
                                  if (menuId === p.id) {
                                    closeMenu();
                                  } else {
                                    setMenuId(p.id);
                                    setMenuAnchor(e.currentTarget);
                                  }
                                }}
                              >
                                ⋮
                              </button>
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
              <div className="commerce-products__footer-left">
                <p className="commerce-products__footer-meta">
                  Showing {rangeStart} to {rangeEnd} of {pagination.total} products
                </p>
                <StaticSelect
                  label="Rows per page"
                  className="commerce-products__page-size-select"
                  compact
                  value={String(pageSize)}
                  onChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                  options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
                />
              </div>
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
      </Panel>

      <ProductActionMenu open={!!menuProduct} anchor={menuAnchor} onClose={closeMenu}>
        {menuProduct ? (
          <>
            <button
              type="button"
              className="commerce-products__action-menu-item"
              role="menuitem"
              onClick={() => {
                closeMenu();
                setViewProduct(menuProduct);
              }}
            >
              View
            </button>
            {canWrite ? (
              <button
                type="button"
                className="commerce-products__action-menu-item"
                role="menuitem"
                onClick={() => {
                  closeMenu();
                  navigate(toPath(`${paths.commerce}/products/${menuProduct.id}/edit`));
                }}
              >
                Edit
              </button>
            ) : null}
            {canWrite ? (
              <button
                type="button"
                className="commerce-products__action-menu-item"
                role="menuitem"
                disabled={publishingId === menuProduct.id}
                onClick={() => void publishToStorefront(menuProduct)}
              >
                {publishingId === menuProduct.id ? 'Publishing…' : 'Publish to storefront'}
              </button>
            ) : null}
            {canEditDelete && menuProduct.status === 'active' ? (
              <button
                type="button"
                className="commerce-products__action-menu-item"
                role="menuitem"
                onClick={() => hideProduct(menuProduct)}
              >
                Hide (inactive)
              </button>
            ) : null}
            {canEditDelete && menuProduct.status !== 'active' ? (
              <button
                type="button"
                className="commerce-products__action-menu-item"
                role="menuitem"
                onClick={() => unhideProduct(menuProduct)}
              >
                Unhide (active)
              </button>
            ) : null}
            {canEditDelete ? (
              <>
                <div className="commerce-products__action-menu-divider" />
                <button
                  type="button"
                  className="commerce-products__action-menu-item commerce-products__action-menu-item--danger"
                  role="menuitem"
                  onClick={() => archiveProduct(menuProduct)}
                >
                  Delete
                </button>
              </>
            ) : null}
          </>
        ) : null}
      </ProductActionMenu>

      {confirmModal}

      {importOpen ? (
        <Modal
          title="Import products from CSV"
          onClose={() => !importing && setImportOpen(false)}
          onSave={() => setImportOpen(false)}
          saveLabel="Close"
          saving={importing}
        >
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              Upload a CSV exported from this page. Required column: <strong>Title</strong>.
              Optional: ID (updates existing Shopify product), Category, Brand, Status.
            </p>
            <p className="text-xs text-slate-500">
              New rows without an ID are created as draft products in Shopify. Download{' '}
              <a
                href="/product-import-template.csv"
                download="product-import-template.csv"
                className="font-semibold text-emerald-700 underline"
              >
                product-import-template.csv
              </a>{' '}
              for the correct column format.
            </p>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.target.value = '';
              }}
            />
            {importPreview > 0 && importing ? (
              <p className="text-slate-500">Importing {importPreview} products…</p>
            ) : null}
          </div>
        </Modal>
      ) : null}

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
