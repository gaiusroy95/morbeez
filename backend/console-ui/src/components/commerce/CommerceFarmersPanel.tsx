import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../Modal';
import '../../styles/commerce-farmers.css';

type FarmerRow = {
  id: string;
  displayName: string;
  initials: string;
  avatarHue: number;
  phone: string | null;
  state: string | null;
  district: string | null;
  cropsLabel: string;
  lastOrderAt: string | null;
  orderCount: number;
  status: 'active' | 'inactive';
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

type StatusFilter = 'all' | 'active' | 'inactive';

const PAGE_SIZE = 10;

function formatLastOrder(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatPhone(phone: string | null): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length > 10) return digits.slice(-10);
  return phone;
}

function locationLabel(row: FarmerRow): string {
  const state = row.state?.trim();
  if (state) return state;
  return row.district?.trim() || '—';
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

export function CommerceFarmersPanel() {
  const [farmers, setFarmers] = useState<FarmerRow[]>([]);
  const [states, setStates] = useState<string[]>([]);
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
  const [stateFilter, setStateFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FarmerRow | null>(null);

  useEffect(() => {
    void api<{ ok: boolean; states: string[] }>('/morbeez-staff/api/v1/farmers/states')
      .then((r) => setStates(r.states ?? []))
      .catch(() => setStates([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    if (appliedSearch.trim()) params.set('search', appliedSearch.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (stateFilter.trim()) params.set('state', stateFilter.trim());

    try {
      const d = await api<{
        ok: boolean;
        farmers: FarmerRow[];
        pagination: Pagination;
      }>(`/morbeez-staff/api/v1/farmers?${params}`);
      setFarmers(d.farmers ?? []);
      setPagination(d.pagination ?? { page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load farmers');
    } finally {
      setLoading(false);
    }
  }, [page, appliedSearch, statusFilter, stateFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  function applySearch() {
    setAppliedSearch(draftSearch);
    setPage(1);
  }

  function resetFilters() {
    setDraftSearch('');
    setAppliedSearch('');
    setStatusFilter('all');
    setStateFilter('');
    setPage(1);
  }

  const pages = useMemo(
    () => pageNumbers(pagination.page, pagination.pages),
    [pagination.page, pagination.pages]
  );

  const rangeStart = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const rangeEnd = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="commerce-farmers">
      {error ? (
        <div className="commerce-farmers__error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="commerce-farmers__toolbar">
        <div className="commerce-farmers__search-wrap">
          <span className="commerce-farmers__search-icon" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            className="commerce-farmers__search"
            placeholder="Search farmers..."
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applySearch()}
          />
        </div>
        <button
          type="button"
          className="commerce-farmers__filter-btn"
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
        >
          <span aria-hidden>▾</span> Filters
        </button>
      </div>

      {filtersOpen ? (
        <div className="commerce-farmers__filter-panel">
          <label>
            State
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <button type="button" className="commerce-farmers__filter-btn" onClick={resetFilters}>
            Reset
          </button>
          <button
            type="button"
            className="commerce-farmers__apply-btn"
            onClick={() => {
              applySearch();
              setPage(1);
            }}
          >
            Apply
          </button>
        </div>
      ) : null}

      <div className="commerce-farmers__table-card">
        {loading ? (
          <p className="commerce-farmers__loading">Loading farmers…</p>
        ) : (
          <>
            <div className="commerce-farmers__table-wrap">
              <table className="commerce-farmers__table">
                <thead>
                  <tr>
                    <th>Farmer Name</th>
                    <th>Mobile Number</th>
                    <th>Location</th>
                    <th>Crops</th>
                    <th>Last Order</th>
                    <th>Total Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {farmers.length ? (
                    farmers.map((f) => (
                      <tr key={f.id} onClick={() => setSelected(f)}>
                        <td>
                          <div className="commerce-farmers__name-cell">
                            <span
                              className="commerce-farmers__avatar"
                              style={{
                                background: `linear-gradient(135deg, hsl(${f.avatarHue} 42% 45%), hsl(${f.avatarHue} 48% 32%))`,
                              }}
                              aria-hidden
                            >
                              {f.initials}
                            </span>
                            <span className="commerce-farmers__name">{f.displayName}</span>
                          </div>
                        </td>
                        <td className="commerce-farmers__phone">{formatPhone(f.phone)}</td>
                        <td>{locationLabel(f)}</td>
                        <td className="commerce-farmers__crops">{f.cropsLabel}</td>
                        <td>{formatLastOrder(f.lastOrderAt)}</td>
                        <td className="commerce-farmers__orders-count">
                          {f.orderCount}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <p className="commerce-farmers__empty">No farmers match your search.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {pagination.total > 0 ? (
              <footer className="commerce-farmers__footer">
                <span>
                  Showing {rangeStart} to {rangeEnd} of {pagination.total} farmers
                </span>
                {pagination.pages > 1 ? (
                  <nav className="commerce-farmers__pagination" aria-label="Pagination">
                    <button
                      type="button"
                      className="commerce-farmers__page-btn"
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
                          className={`commerce-farmers__page-btn ${pagination.page === p ? 'commerce-farmers__page-btn--active' : ''}`}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      className="commerce-farmers__page-btn"
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

      {selected ? (
        <Modal
          title={selected.displayName}
          onClose={() => setSelected(null)}
          onSave={() => setSelected(null)}
          saveLabel="Close"
        >
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              <strong>Mobile:</strong> {formatPhone(selected.phone)}
            </p>
            <p>
              <strong>Location:</strong> {locationLabel(selected)}
              {selected.district && selected.state
                ? ` (${selected.district})`
                : ''}
            </p>
            <p>
              <strong>Crops:</strong> {selected.cropsLabel}
            </p>
            <p>
              <strong>Last order:</strong> {formatLastOrder(selected.lastOrderAt)}
            </p>
            <p>
              <strong>Total orders:</strong> {selected.orderCount}
            </p>
            <p>
              <strong>Status:</strong>{' '}
              {selected.status === 'active' ? 'Active' : 'Inactive'}
            </p>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
