import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { StaticSelect } from '../ui';
import type { InteractionListRow } from './InteractionDetailModal';

const base = '/morbeez-staff/api/v1/os/telecaller';

export type InteractionRow = InteractionListRow & {
  at?: string;
  typeKey?: string;
  typeIcon?: string;
  typeCategory?: string;
  displayStatus?: string;
  statusTone?: string;
  nextActionLabel?: string | null;
  blockName?: string | null;
  blockId?: string | null;
  canArchive?: boolean;
  summary?: string;
  fieldFinding?: string | null;
  fieldActivity?: string | null;
  activityDateLabel?: string | null;
  recommendation?: string | null;
  outcome?: string | null;
  workflowStatus?: string | null;
  nextAction?: string | null;
};

type BlockOption = { id: string; name: string; cropName?: string };

type Filters = {
  typeKey: string;
  employee: string;
  workflowStatus: string;
  blockId: string;
  dateFrom: string;
  dateTo: string;
};

const TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'field_visit', label: 'Field visit' },
  { value: 'recommendation', label: 'Recommendation' },
  { value: 'roi', label: 'ROI' },
  { value: 'note', label: 'Other' },
];

const WORKFLOW_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Escalated', label: 'Escalated' },
];

const EMPTY_FILTERS: Filters = {
  typeKey: '',
  employee: '',
  workflowStatus: '',
  blockId: '',
  dateFrom: '',
  dateTo: '',
};

function ActionsMenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="8" cy="3" r="1.25" />
      <circle cx="8" cy="8" r="1.25" />
      <circle cx="8" cy="13" r="1.25" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0 0 14-2M19 5a9 9 0 0 0-14 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function statusClass(tone: string | undefined): string {
  switch (tone) {
    case 'warning':
      return 'tc-ix-status tc-ix-status--warning';
    case 'info':
      return 'tc-ix-status tc-ix-status--info';
    case 'review':
      return 'tc-ix-status tc-ix-status--review';
    case 'purple':
      return 'tc-ix-status tc-ix-status--purple';
    default:
      return 'tc-ix-status tc-ix-status--success';
  }
}

function dash(value: string | null | undefined): string {
  return value?.trim() ? value : '—';
}

function toListRow(r: InteractionRow): InteractionListRow {
  return {
    id: r.id,
    interactionType: r.interactionType ?? r.typeCategory,
    typeLabel: r.typeCategory,
    summary: r.summary,
    by: r.by,
    role: r.role,
    createdLabel: r.createdLabel,
    source: r.source,
    completionStatus: r.completionStatus ?? null,
    isDueToday: r.isDueToday,
    taskId: r.taskId ?? null,
    canEdit: r.canEdit,
  };
}

type Props = {
  leadId: string;
  canWrite: boolean;
  blocks: BlockOption[];
  refreshKey: number;
  onAddInteraction: () => void;
  onOpenDetail: (row: InteractionListRow) => void;
  onArchive: (interactionId: string) => void;
};

export function InteractionsTab({
  leadId,
  canWrite,
  blocks,
  refreshKey,
  onAddInteraction,
  onOpenDetail,
  onArchive,
}: Props) {
  const [allItems, setAllItems] = useState<InteractionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    function onDocClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest('.tc-ix-menu-wrap')) setOpenMenuId(null);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openMenuId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{
        ok: boolean;
        interactions: InteractionRow[];
        pagination: { total: number };
      }>(`${base}/leads/${leadId}/interactions?page=1&limit=200`);
      setAllItems(data.interactions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load interactions');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const employees = useMemo(() => {
    const set = new Set<string>();
    for (const r of allItems) {
      if (r.by) set.add(String(r.by));
    }
    return Array.from(set).sort();
  }, [allItems]);

  const filtered = useMemo(() => {
    return allItems.filter((r) => {
      if (filters.typeKey && r.typeKey !== filters.typeKey) return false;
      if (filters.employee && r.by !== filters.employee) return false;
      if (filters.workflowStatus && r.workflowStatus !== filters.workflowStatus) return false;
      if (filters.blockId && r.blockId !== filters.blockId) return false;
      if (filters.dateFrom && r.at) {
        if (new Date(r.at) < new Date(filters.dateFrom)) return false;
      }
      if (filters.dateTo && r.at) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(r.at) > end) return false;
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

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  return (
    <div className="tc-interactions">
      <div className="tc-ix-header">
        <div>
          <h2 className="tc-ix-title">Interactions</h2>
          <p className="tc-ix-subtitle">
            Operational crop story — meaningful workflow sessions, not system micro-events
          </p>
        </div>
        <div className="tc-ix-header-actions">
          {canWrite ? (
            <button type="button" className="tc-ix-btn-primary" onClick={onAddInteraction}>
              + Add Interaction
            </button>
          ) : null}
          <button
            type="button"
            className="tc-ix-btn-icon"
            title="Toggle filters"
            onClick={() => setShowFilters((v) => !v)}
            aria-pressed={showFilters}
          >
            <FilterIcon />
          </button>
        </div>
      </div>

      {showFilters ? (
        <div className="tc-ix-filters">
          <StaticSelect
            label="Interaction Type"
            className="tc-ix-filter-field"
            value={filters.typeKey}
            onChange={(value) => {
              setFilters((f) => ({ ...f, typeKey: value }));
              setPage(1);
            }}
            options={TYPE_OPTIONS}
          />
          <StaticSelect
            label="Employee"
            className="tc-ix-filter-field"
            value={filters.employee}
            onChange={(value) => {
              setFilters((f) => ({ ...f, employee: value }));
              setPage(1);
            }}
            options={[
              { value: '', label: 'All' },
              ...employees.map((emp) => ({ value: emp, label: emp })),
            ]}
          />
          <label className="tc-ix-filter-field tc-ix-filter-field--range">
            <span>Date Range</span>
            <div className="tc-ix-date-range">
              <input
                type="date"
                value={filters.dateFrom}
                aria-label="Date from"
                onChange={(e) => {
                  setFilters((f) => ({ ...f, dateFrom: e.target.value }));
                  setPage(1);
                }}
              />
              <span className="tc-ix-date-range-sep">–</span>
              <input
                type="date"
                value={filters.dateTo}
                aria-label="Date to"
                onChange={(e) => {
                  setFilters((f) => ({ ...f, dateTo: e.target.value }));
                  setPage(1);
                }}
              />
            </div>
          </label>
          <StaticSelect
            label="Workflow"
            className="tc-ix-filter-field"
            value={filters.workflowStatus}
            onChange={(value) => {
              setFilters((f) => ({ ...f, workflowStatus: value }));
              setPage(1);
            }}
            options={WORKFLOW_OPTIONS}
          />
          <StaticSelect
            label="Block"
            className="tc-ix-filter-field"
            value={filters.blockId}
            onChange={(value) => {
              setFilters((f) => ({ ...f, blockId: value }));
              setPage(1);
            }}
            options={[
              { value: '', label: 'All' },
              ...blocks.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
          <button type="button" className="tc-ix-btn-reset" onClick={resetFilters}>
            <ResetIcon />
            Reset
          </button>
        </div>
      ) : null}

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <div className="tc-ix-timeline-mobile">
        {loading ? (
          <p className="tc-ix-empty">Loading interactions…</p>
        ) : pageItems.length === 0 ? (
          <p className="tc-ix-empty">
            No operational sessions yet. Add an interaction to log communication, findings, and next steps in one
            session.
          </p>
        ) : (
          pageItems.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`tc-ix-timeline-card ${r.workflowStatus === 'Active' ? 'tc-ix-timeline-card--active' : ''}`}
              onClick={() => onOpenDetail(toListRow(r))}
            >
              <div className="tc-ix-timeline-date">{r.createdLabel ?? '—'}</div>
              <div className="tc-ix-timeline-head">
                <span className="tc-ix-timeline-icon" aria-hidden>
                  {r.typeIcon ?? '📝'}
                </span>
                <strong>{r.typeCategory ?? r.interactionType ?? 'Interaction'}</strong>
              </div>
              {r.summary ? <p className="tc-ix-timeline-summary">{String(r.summary).slice(0, 160)}</p> : null}
              {r.fieldFinding ? (
                <p className="tc-ix-timeline-meta">
                  <span>Finding:</span> {r.fieldFinding}
                </p>
              ) : null}
              {r.fieldActivity ? (
                <p className="tc-ix-timeline-meta">
                  <span>Activity:</span> {r.fieldActivity}
                  {r.activityDateLabel ? ` · ${r.activityDateLabel}` : ''}
                </p>
              ) : null}
              {r.outcome ? (
                <p className="tc-ix-timeline-meta">
                  <span>Outcome:</span> {r.outcome}
                </p>
              ) : null}
              {r.nextAction ? (
                <p className="tc-ix-timeline-meta">
                  <span>Next:</span> {r.nextAction}
                </p>
              ) : null}
              <span className={statusClass(r.statusTone)}>{r.displayStatus ?? r.workflowStatus ?? '—'}</span>
            </button>
          ))
        )}
      </div>

      <div className="tc-ix-table-wrap tc-ix-table-wrap--desktop">
        {loading ? (
          <p className="tc-ix-empty">Loading interactions…</p>
        ) : (
          <table className="tc-ix-table tc-ix-table--sessions">
            <thead>
              <tr>
                <th>Interaction date</th>
                <th>Type</th>
                <th>Summary</th>
                <th>Field finding</th>
                <th>Field activity</th>
                <th>Activity date</th>
                <th>Recommendation</th>
                <th>Outcome</th>
                <th>Next action</th>
                <th>Workflow</th>
                <th className="tc-ix-th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r) => {
                const rowClass = r.workflowStatus === 'Active' ? 'tc-ix-row--due' : '';
                return (
                  <tr
                    key={r.id}
                    className={`tc-ix-row ${rowClass}`}
                    onClick={() => onOpenDetail(toListRow(r))}
                  >
                    <td className="tc-ix-date">{r.createdLabel ?? '—'}</td>
                    <td>
                      <div className="tc-ix-type">
                        <span className="tc-ix-type-icon" aria-hidden>
                          {r.typeIcon ?? '📝'}
                        </span>
                        <span>{r.typeCategory ?? r.interactionType ?? '—'}</span>
                      </div>
                    </td>
                    <td className="tc-ix-summary">{String(r.summary ?? '—').slice(0, 120)}</td>
                    <td className="tc-ix-cell-compact">{dash(r.fieldFinding)}</td>
                    <td className="tc-ix-cell-compact">{dash(r.fieldActivity)}</td>
                    <td className="tc-ix-date">{dash(r.activityDateLabel)}</td>
                    <td className="tc-ix-cell-compact">{dash(r.recommendation)}</td>
                    <td className="tc-ix-cell-compact">{dash(r.outcome)}</td>
                    <td className="tc-ix-next">
                      {r.nextAction ? (
                        <span className="tc-ix-next-pill">{r.nextActionLabel ?? r.nextAction}</span>
                      ) : (
                        <span className="tc-ix-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={statusClass(r.statusTone)}>
                        {r.displayStatus ?? r.workflowStatus ?? '—'}
                      </span>
                    </td>
                    <td className="tc-ix-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="tc-ix-menu-wrap">
                        <button
                          type="button"
                          className="tc-ix-menu-btn"
                          aria-label="Row actions"
                          aria-expanded={openMenuId === r.id}
                          aria-haspopup="menu"
                          onClick={() => setOpenMenuId(openMenuId === r.id ? null : r.id)}
                        >
                          <ActionsMenuIcon />
                        </button>
                        {openMenuId === r.id ? (
                          <div className="tc-ix-menu" role="menu">
                            <button type="button" onClick={() => onOpenDetail(toListRow(r))}>
                              View details
                            </button>
                            {canWrite && r.canEdit ? (
                              <button type="button" onClick={() => onOpenDetail(toListRow(r))}>
                                Edit
                              </button>
                            ) : null}
                            {canWrite && r.canArchive !== false ? (
                              <button
                                type="button"
                                className="tc-ix-menu-danger"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onArchive(r.id);
                                }}
                              >
                                Archive
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && pageItems.length === 0 ? (
          <p className="tc-ix-empty">
            No operational sessions yet. Add an interaction to log communication, findings, and next steps in one
            session.
          </p>
        ) : null}
      </div>

      {!loading && total > 0 ? (
        <div className="tc-ix-footer">
          <p className="tc-ix-footer-meta">
            Showing {(safePage - 1) * rowsPerPage + 1} to {Math.min(safePage * rowsPerPage, total)} of {total}{' '}
            sessions
          </p>
          <div className="tc-ix-pagination">
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
          <StaticSelect
            label="Rows per page"
            className="tc-ix-rows"
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
