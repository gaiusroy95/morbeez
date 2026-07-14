import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../Modal';
import {
  Alert,
  Badge,
  Btn,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  Input,
  Loading,
  Panel,
  StaticSelect,
  TableWrap,
  TBody,
  Td,
  Th,
  THead,
} from '../ui';

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
  if (!digits) return '—';
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
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
    <div className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <FilterBar>
        <div className="relative min-w-[240px] flex-1">
          <Input
            type="search"
            placeholder="Search farmers…"
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
        <Btn variant="secondary" onClick={() => setFiltersOpen((o) => !o)} aria-expanded={filtersOpen}>
          Filters
        </Btn>
        <Btn variant="primary" onClick={applySearch}>
          Search
        </Btn>
      </FilterBar>

      {filtersOpen ? (
        <Panel bodyClassName="flex flex-wrap items-end gap-3">
          <Field label="State" className="min-w-[180px] flex-1">
            <StaticSelect
              value={stateFilter}
              onChange={setStateFilter}
              options={[
                { value: '', label: 'All states' },
                ...states.map((s) => ({ value: s, label: s })),
              ]}
            />
          </Field>
          <Field label="Status" className="min-w-[160px] flex-1">
            <StaticSelect
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              options={[
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </Field>
          <Btn variant="ghost" onClick={resetFilters}>
            Reset
          </Btn>
          <Btn
            variant="secondary"
            onClick={() => {
              applySearch();
              setPage(1);
            }}
          >
            Apply
          </Btn>
        </Panel>
      ) : null}

      <Panel title="Farmers" description="Commerce farmer registry and order history">
        {loading ? (
          <Loading label="Loading farmers…" />
        ) : (
          <>
            <TableWrap>
              <DataTable>
                <THead>
                  <tr>
                    <Th>Farmer Name</Th>
                    <Th>Mobile Number</Th>
                    <Th>Location</Th>
                    <Th>Crops</Th>
                    <Th>Last Order</Th>
                    <Th>Total Orders</Th>
                  </tr>
                </THead>
                <TBody>
                  {farmers.length ? (
                    farmers.map((f) => (
                      <tr
                        key={f.id}
                        className="cursor-pointer transition hover:bg-surface-subtle/60"
                        onClick={() => setSelected(f)}
                      >
                        <Td>
                          <div className="flex items-center gap-3">
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                              style={{
                                background: `linear-gradient(135deg, hsl(${f.avatarHue} 42% 45%), hsl(${f.avatarHue} 48% 32%))`,
                              }}
                              aria-hidden
                            >
                              {f.initials}
                            </span>
                            <span className="font-semibold text-ink">{f.displayName}</span>
                          </div>
                        </Td>
                        <Td className="text-ink-secondary">{formatPhone(f.phone)}</Td>
                        <Td>{locationLabel(f)}</Td>
                        <Td className="max-w-[200px] truncate text-ink-secondary">{f.cropsLabel}</Td>
                        <Td>{formatLastOrder(f.lastOrderAt)}</Td>
                        <Td className="font-semibold text-brand-700">{f.orderCount}</Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState>No farmers match your search.</EmptyState>
                      </td>
                    </tr>
                  )}
                </TBody>
              </DataTable>
            </TableWrap>

            {pagination.total > 0 ? (
              <footer className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-ink-muted">
                  Showing {rangeStart} to {rangeEnd} of {pagination.total} farmers
                </span>
                {pagination.pages > 1 ? (
                  <nav className="flex flex-wrap items-center gap-1" aria-label="Pagination">
                    <Btn
                      variant="secondary"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      ‹
                    </Btn>
                    {pages.map((p, i) =>
                      p === 'ellipsis' ? (
                        <span key={`e-${i}`} className="px-2 text-ink-muted">
                          …
                        </span>
                      ) : (
                        <Btn
                          key={p}
                          variant={pagination.page === p ? 'primary' : 'secondary'}
                          size="sm"
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </Btn>
                      )
                    )}
                    <Btn
                      variant="secondary"
                      size="sm"
                      disabled={pagination.page >= pagination.pages}
                      onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    >
                      ›
                    </Btn>
                  </nav>
                ) : null}
              </footer>
            ) : null}
          </>
        )}
      </Panel>

      {selected ? (
        <Modal
          title={selected.displayName}
          onClose={() => setSelected(null)}
          onSave={() => setSelected(null)}
          saveLabel="Close"
        >
          <div className="space-y-3 text-sm text-ink-secondary">
            <p>
              <strong className="text-ink">Mobile:</strong> {formatPhone(selected.phone)}
            </p>
            <p>
              <strong className="text-ink">Location:</strong> {locationLabel(selected)}
              {selected.district && selected.state ? ` (${selected.district})` : ''}
            </p>
            <p>
              <strong className="text-ink">Crops:</strong> {selected.cropsLabel}
            </p>
            <p>
              <strong className="text-ink">Last order:</strong> {formatLastOrder(selected.lastOrderAt)}
            </p>
            <p>
              <strong className="text-ink">Total orders:</strong> {selected.orderCount}
            </p>
            <p className="flex items-center gap-2">
              <strong className="text-ink">Status:</strong>
              <Badge tone={selected.status === 'active' ? 'active' : 'archived'}>
                {selected.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            </p>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
