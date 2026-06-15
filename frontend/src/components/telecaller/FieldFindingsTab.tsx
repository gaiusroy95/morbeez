import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { buildVisitWizardUrl } from '../../lib/visitNavigation';
import { StaticSelect } from '../ui';
import type { FieldFindingListRow } from './FieldFindingDetailModal';
import {
  FINDING_TYPE_LABELS,
  REVIEW_SEVERITY_LABELS,
  type FindingType,
  type ReviewSeverity,
} from '../../lib/ai-training-enums';

const base = '/morbeez-staff/api/v1/os/telecaller';

type FindingRow = FieldFindingListRow & {
  visitedAt?: string | null;
  blockId?: string | null;
  agronomistName?: string;
  agronomistRole?: string;
  agronomistInitials?: string;
  observations?: string;
  parameters?: Array<{ label: string; value: string }>;
  diseasePest?: string;
  diseaseTone?: string;
  actionTaken?: string;
  followUpLabel?: string;
  photoUrls?: string[];
  photoCount?: number;
  extraPhotoCount?: number;
  findingType?: string | null;
  severity?: string | null;
  finalConfirmedIssue?: string | null;
  affectedAreaPct?: number | null;
};

type BlockOption = { id: string; name: string; cropName?: string };

type Filters = {
  blockId: string;
  diseaseTone: string;
  agronomist: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_FILTERS: Filters = {
  blockId: '',
  diseaseTone: '',
  agronomist: '',
  dateFrom: '',
  dateTo: '',
};

function diseaseClass(tone: string | undefined): string {
  return `tc-ff-disease tc-ff-disease--${tone ?? 'warning'}`;
}

type VisitContext = {
  farmerId: string;
  farmerName: string;
};

type Props = {
  leadId: string;
  canWrite: boolean;
  blocks: BlockOption[];
  refreshKey: number;
  visitContext?: VisitContext;
  onAddFinding: () => void;
  onOpenDetail: (row: FieldFindingListRow) => void;
  onArchive: (id: string) => void;
};

export function FieldFindingsTab({
  leadId,
  canWrite,
  blocks,
  refreshKey,
  visitContext,
  onAddFinding,
  onOpenDetail,
  onArchive,
}: Props) {
  const navigate = useNavigate();
  const [allItems, setAllItems] = useState<FindingRow[]>([]);
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
      const data = await api<{ ok: boolean; findings: FindingRow[] }>(
        `${base}/leads/${leadId}/field-findings?limit=100`
      );
      setAllItems(data.findings ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load field findings');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const agronomists = useMemo(() => {
    const set = new Set<string>();
    for (const f of allItems) {
      if (f.agronomistName) set.add(String(f.agronomistName));
    }
    return Array.from(set).sort();
  }, [allItems]);

  const filtered = useMemo(() => {
    return allItems.filter((f) => {
      if (filters.blockId && f.blockId !== filters.blockId) return false;
      if (filters.diseaseTone && f.diseaseTone !== filters.diseaseTone) return false;
      if (filters.agronomist && f.agronomistName !== filters.agronomist) return false;
      if (filters.dateFrom && f.visitedAt && new Date(f.visitedAt) < new Date(filters.dateFrom)) {
        return false;
      }
      if (filters.dateTo && f.visitedAt) {
        const end = new Date(filters.dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(f.visitedAt) > end) return false;
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
      'Date',
      'Block',
      'Crop',
      'Type',
      'Severity',
      'Issue',
      'Agronomist',
      'Observations',
      'Action',
      'Follow-up',
    ];
    const rows = filtered.map((f) => [
      f.visitedLabel,
      f.blockName,
      f.cropType,
      f.findingType
        ? FINDING_TYPE_LABELS[f.findingType as FindingType] ?? f.findingType
        : '',
      f.severity
        ? REVIEW_SEVERITY_LABELS[f.severity as ReviewSeverity] ?? f.severity
        : '',
      f.finalConfirmedIssue ?? f.diseasePest,
      f.agronomistName,
      f.observations,
      f.actionTaken,
      f.followUpLabel,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `field-findings-${leadId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="tc-field-findings">
      <div className="tc-ff-header">
        <div>
          <h2 className="tc-ff-title">Field Findings</h2>
          <p className="tc-ff-subtitle">
            All field observations and visit findings recorded by agronomists
          </p>
        </div>
        <div className="tc-ff-header-actions">
          {visitContext && canWrite && blocks[0] ? (
            <button
              type="button"
              className="tc-ff-btn-primary"
              onClick={() => {
                const block = blocks.find((b) => b.id === filters.blockId) ?? blocks[0];
                navigate(
                  buildVisitWizardUrl({
                    farmerId: visitContext.farmerId,
                    blockId: block.id,
                    blockName: block.name,
                    cropType: block.cropName || '_default',
                    farmerName: visitContext.farmerName,
                  })
                );
              }}
            >
              Start Visit AI
            </button>
          ) : null}
          <button type="button" className="tc-ff-btn-secondary" onClick={() => setShowFilters((v) => !v)}>
            Filter
          </button>
          <button type="button" className="tc-ff-btn-secondary" onClick={exportCsv} disabled={!filtered.length}>
            Export
          </button>
          {canWrite ? (
            <button type="button" className="tc-ff-btn-primary" onClick={onAddFinding}>
              + Add Field Finding
            </button>
          ) : null}
        </div>
      </div>

      {showFilters ? (
        <div className="tc-ff-filters">
          <StaticSelect
            label="Block"
            className="tc-ff-filter-field"
            value={filters.blockId}
            onChange={(value) => {
              setFilters((f) => ({ ...f, blockId: value }));
              setPage(1);
            }}
            options={[
              { value: '', label: 'All blocks' },
              ...blocks.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
          <StaticSelect
            label="Severity"
            className="tc-ff-filter-field"
            value={filters.diseaseTone}
            onChange={(value) => {
              setFilters((f) => ({ ...f, diseaseTone: value }));
              setPage(1);
            }}
            options={[
              { value: '', label: 'All' },
              { value: 'healthy', label: 'Healthy' },
              { value: 'warning', label: 'Deficiency / warning' },
              { value: 'danger', label: 'Disease / pest' },
            ]}
          />
          <StaticSelect
            label="Agronomist"
            className="tc-ff-filter-field"
            value={filters.agronomist}
            onChange={(value) => {
              setFilters((f) => ({ ...f, agronomist: value }));
              setPage(1);
            }}
            options={[
              { value: '', label: 'All' },
              ...agronomists.map((a) => ({ value: a, label: a })),
            ]}
          />
          <label className="tc-ff-filter-field">
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
          <label className="tc-ff-filter-field">
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
            className="tc-ff-btn-reset"
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

      <div className="tc-ff-table-wrap">
        {loading ? (
          <p className="tc-ff-empty">Loading field findings…</p>
        ) : (
          <table className="tc-ff-table">
            <thead>
              <tr>
                <th>Date &amp; time</th>
                <th>Block / crop</th>
                <th>Type</th>
                <th>Issue</th>
                <th>Agronomist</th>
                <th>Observations</th>
                <th>Parameters</th>
                <th>Action taken</th>
                <th>Next follow-up</th>
                <th>Photos</th>
                <th className="tc-ff-th-actions" />
              </tr>
            </thead>
            <tbody>
              {pageItems.map((f) => {
                const photos = f.photoUrls ?? [];
                const visible = photos.slice(0, 2);
                const extra = f.extraPhotoCount ?? Math.max(0, photos.length - 2);
                return (
                  <tr
                    key={f.id}
                    className="tc-ff-row"
                    onClick={() =>
                      onOpenDetail({
                        id: f.id,
                        visitedLabel: f.visitedLabel,
                        blockName: f.blockName,
                        cropType: f.cropType,
                      })
                    }
                  >
                    <td className="tc-ff-date">{f.visitedLabel}</td>
                    <td>
                      <strong className="block text-slate-900">{f.blockName}</strong>
                      <span className="text-xs text-slate-500">{f.cropType}</span>
                    </td>
                    <td className="tc-ff-type">
                      {f.findingType ? (
                        <>
                          <span className="tc-ff-type-chip">
                            {FINDING_TYPE_LABELS[f.findingType as FindingType] ?? f.findingType}
                          </span>
                          {f.severity ? (
                            <span className="tc-ff-sev-chip">
                              {REVIEW_SEVERITY_LABELS[f.severity as ReviewSeverity] ?? f.severity}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="tc-ff-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={diseaseClass(f.diseaseTone)}>
                        {f.finalConfirmedIssue ?? f.diseasePest}
                      </span>
                      {f.affectedAreaPct != null ? (
                        <span className="block text-xs text-slate-500">{f.affectedAreaPct}% affected</span>
                      ) : null}
                    </td>
                    <td>
                      <div className="tc-ff-agronomist">
                        <span className="tc-ff-avatar tc-ff-avatar--sm">
                          {f.agronomistInitials}
                        </span>
                        <div>
                          <strong>{f.agronomistName}</strong>
                          <span>{f.agronomistRole}</span>
                        </div>
                      </div>
                    </td>
                    <td className="tc-ff-obs">{String(f.observations ?? '—').slice(0, 120)}</td>
                    <td className="tc-ff-params">
                      {(f.parameters ?? []).length === 0 ? (
                        <span className="tc-ff-muted">—</span>
                      ) : (
                        <ul>
                          {(f.parameters ?? []).slice(0, 4).map((p, i) => (
                            <li key={i}>
                              {p.label}: {p.value}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="tc-ff-action">{String(f.actionTaken ?? '—').slice(0, 80)}</td>
                    <td className="tc-ff-date">{f.followUpLabel}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {photos.length === 0 ? (
                        <span className="tc-ff-muted">—</span>
                      ) : (
                        <div className="tc-ff-photo-row">
                          {visible.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="tc-ff-photo-thumb"
                            >
                              <img src={url} alt="" />
                            </a>
                          ))}
                          {extra > 0 ? (
                            <span className="tc-ff-photo-more">+{extra}</span>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="tc-ff-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="tc-ff-action-btns">
                        <button
                          type="button"
                          className="tc-ff-icon-btn"
                          title="View"
                          onClick={() =>
                            onOpenDetail({
                              id: f.id,
                              visitedLabel: f.visitedLabel,
                              blockName: f.blockName,
                            })
                          }
                        >
                          👁
                        </button>
                        <div className="tc-ff-menu-wrap">
                          <button
                            type="button"
                            className="tc-ff-icon-btn"
                            onClick={() => setOpenMenuId(openMenuId === f.id ? null : f.id)}
                          >
                            ⋮
                          </button>
                          {openMenuId === f.id ? (
                            <div className="tc-ff-menu">
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenDetail({ id: f.id, visitedLabel: f.visitedLabel })
                                }
                              >
                                View details
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenDetail({ id: f.id, visitedLabel: f.visitedLabel })
                                }
                              >
                                Edit
                              </button>
                              {canWrite ? (
                                <button
                                  type="button"
                                  className="tc-ff-menu-danger"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    onArchive(f.id);
                                  }}
                                >
                                  Archive
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && pageItems.length === 0 ? (
          <p className="tc-ff-empty">No field findings recorded yet.</p>
        ) : null}
      </div>

      {!loading && total > 0 ? (
        <div className="tc-ff-footer">
          <p className="tc-ff-footer-meta">
            Showing {(safePage - 1) * rowsPerPage + 1} to {Math.min(safePage * rowsPerPage, total)} of{' '}
            {total} field findings
          </p>
          <div className="tc-ff-pagination">
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
            className="tc-ff-rows"
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
