import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
import {
  CropBlockFields,
  blockFromApi,
  emptyCropBlock,
  toApiCropBlock,
  type CropBlockFormValue,
} from './CropBlockFields';
import { SoilTestForm } from './SoilTestForm';
import { emptySoilForm, formToMetricsPayload, type SoilLabMetrics } from './soilLabMetrics';
import { SOIL_MACRO_FIELDS } from './soilLabMetrics';
import type { FieldFindingListRow } from './FieldFindingDetailModal';

const base = '/morbeez-staff/api/v1/os/telecaller';

export type FarmBlockCard = {
  id: string;
  name: string;
  cropName?: string;
  varietyName?: string;
  area?: string;
  soilHealth?: string;
  soilTone?: string;
  lastVisit?: string;
  growthPercent?: number;
  plantingDate?: string | null;
};

type SubTab = 'overview' | 'soil' | 'visits' | 'recommendations' | 'followups' | 'timeline';

type WorkspaceData = {
  blockInfo?: {
    blockName?: string;
    area?: string;
    crop?: string;
    variety?: string;
    plantingDate?: string | null;
    daysAfterPlanting?: number | null;
    irrigationType?: string;
    spacing?: string;
    growthStage?: string;
    growthPercent?: number;
    nextStage?: string;
  };
  soilReport?: { metrics?: SoilLabMetrics; pdfUrl?: string | null; reportedLabel?: string | null };
  soilReports?: Array<{ id: string; reportedLabel?: string; metrics?: SoilLabMetrics; pdfUrl?: string | null }>;
  latestVisit?: {
    id?: string;
    agronomistName?: string;
    diseasePest?: string;
    observations?: string;
    visitedLabel?: string;
    spad?: string;
    shootCount?: string;
    leafCount?: string;
    moisture?: string;
    pestPressure?: string;
    photoUrls?: string[];
  } | null;
  blockRecommendations?: Array<{
    id: string;
    recType?: string;
    recommendation?: string;
    problem?: string;
    recommendedBy?: string;
    followUpLabel?: string;
    status?: string;
  }>;
  followUps?: Array<{ id: string; title?: string; dueLabel?: string; notes?: string }>;
  visits?: Array<{
    id: string;
    visitedLabel?: string;
    agronomistName?: string;
    diseasePest?: string;
    observations?: string;
  }>;
  nextFollowUp?: { title?: string; dueLabel?: string; notes?: string } | null;
  timeline?: Array<{ title: string; atLabel: string; kind?: string; detail?: string }>;
};

type Props = {
  leadId: string;
  canWrite: boolean;
  refreshKey: number;
  onAddBlock: () => void;
  onOpenFinding: (row: FieldFindingListRow) => void;
  onScheduleVisit: () => void;
  onAddRecommendation: () => void;
  onAddFieldFinding: () => void;
};

function soilHealthLabel(health?: string): string {
  if (health === 'good') return 'Good';
  if (health === 'medium') return 'Medium';
  if (health === 'critical' || health === 'poor') return 'Critical';
  return health ? health.charAt(0).toUpperCase() + health.slice(1) : 'Good';
}

function soilDotClass(tone?: string): string {
  return `tc-bl-soil-dot tc-bl-soil-dot--${tone ?? 'success'}`;
}

function metricStatusLabel(key: string, value: string): { label: string; tone: string } {
  if (!value?.trim()) return { label: '—', tone: 'muted' };
  const n = parseFloat(value);
  if (key === 'ph' && !Number.isNaN(n)) {
    if (n >= 6 && n <= 7) return { label: 'Good', tone: 'success' };
    if (n < 6) return { label: 'Low', tone: 'warning' };
    return { label: 'High', tone: 'warning' };
  }
  if (['nitrogen', 'phosphorus', 'potassium'].includes(key) && !Number.isNaN(n)) {
    if (n < 50) return { label: 'Low', tone: 'danger' };
    if (n > 300) return { label: 'High', tone: 'warning' };
    return { label: 'Normal', tone: 'success' };
  }
  return { label: 'Normal', tone: 'success' };
}

function recTypeLabel(recType?: string): string {
  if (recType === 'ai') return 'AI recommendation';
  if (recType === 'drench') return 'Drench recommendation';
  if (recType === 'spray') return 'Spray recommendation';
  return 'Agronomist recommendation';
}

function recTypeClass(recType?: string): string {
  if (recType === 'ai') return 'tc-bl-rec tc-bl-rec--ai';
  if (recType === 'drench' || recType === 'spray') return 'tc-bl-rec tc-bl-rec--drench';
  return 'tc-bl-rec tc-bl-rec--ag';
}

const SUB_TABS: Array<{ id: SubTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'soil', label: 'Soil reports' },
  { id: 'visits', label: 'Visit findings' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'followups', label: 'Follow-ups' },
  { id: 'timeline', label: 'Timeline' },
];

export function BlocksTab({
  leadId,
  canWrite,
  refreshKey,
  onAddBlock,
  onOpenFinding,
  onScheduleVisit,
  onAddRecommendation,
  onAddFieldFinding,
}: Props) {
  const [blocks, setBlocks] = useState<FarmBlockCard[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [loadingWs, setLoadingWs] = useState(false);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [soilOpen, setSoilOpen] = useState(false);
  const [editBlock, setEditBlock] = useState<CropBlockFormValue>(emptyCropBlock());
  const [saving, setSaving] = useState(false);
  const [soilMacro, setSoilMacro] = useState(emptySoilForm().macro);
  const [soilMicro, setSoilMicro] = useState(emptySoilForm().micro);
  const [soilType, setSoilType] = useState('');

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  const loadBlocks = useCallback(async () => {
    setLoadingBlocks(true);
    setError('');
    try {
      const data = await api<{ ok: boolean; blocks: FarmBlockCard[] }>(
        `${base}/leads/${leadId}/blocks`
      );
      const list = data.blocks ?? [];
      setBlocks(list);
      setSelectedId((prev) => {
        if (prev && list.some((b) => b.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load blocks');
    } finally {
      setLoadingBlocks(false);
    }
  }, [leadId]);

  const loadWorkspace = useCallback(async (blockId: string) => {
    setLoadingWs(true);
    try {
      const ws = await api<{ ok: boolean } & WorkspaceData>(
        `${base}/leads/${leadId}/blocks/${blockId}/workspace`
      );
      setWorkspace(ws);
    } catch (e) {
      setWorkspace(null);
      setError(e instanceof Error ? e.message : 'Failed to load block details');
    } finally {
      setLoadingWs(false);
    }
  }, [leadId]);

  useEffect(() => {
    void loadBlocks();
  }, [loadBlocks, refreshKey]);

  useEffect(() => {
    if (selectedId) void loadWorkspace(selectedId);
    else setWorkspace(null);
  }, [selectedId, loadWorkspace, refreshKey]);

  function openEdit() {
    if (!selected || !workspace?.blockInfo) return;
    const info = workspace.blockInfo;
    setEditBlock(
      blockFromApi({
        id: selected.id,
        blockName: info.blockName ?? selected.name,
        cropName: info.crop ?? selected.cropName ?? '',
        acreage: info.area ?? selected.area,
        plantingDate: info.plantingDate ?? selected.plantingDate,
      })
    );
    setEditOpen(true);
  }

  async function saveBlock() {
    if (!selectedId) return;
    const payload = toApiCropBlock(editBlock);
    if (!payload) {
      setError('Select a crop for this block');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api(`${base}/leads/${leadId}/blocks/${selectedId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: payload.blockName,
          cropName: payload.cropName,
          area: payload.acreage != null ? String(payload.acreage) : undefined,
          plantingDate: payload.plantingDate,
        }),
      });
      setEditOpen(false);
      await loadBlocks();
      await loadWorkspace(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save block');
    } finally {
      setSaving(false);
    }
  }

  async function saveSoilTest(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    if (!soilType.trim()) {
      setError('Select soil type');
      return;
    }
    const metrics = formToMetricsPayload(soilMacro, soilMicro, soilType);
    const hasValue =
      Object.values(metrics.macro).some((m) => m.value) ||
      Object.values(metrics.micro).some((m) => m.value);
    if (!hasValue) {
      setError('Enter at least one nutrient value');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api(`${base}/leads/${leadId}/soil-reports`, {
        method: 'POST',
        body: JSON.stringify({ blockId: selectedId, metrics }),
      });
      setSoilOpen(false);
      const empty = emptySoilForm();
      setSoilMacro(empty.macro);
      setSoilMicro(empty.micro);
      setSoilType('');
      await loadWorkspace(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save soil test');
    } finally {
      setSaving(false);
    }
  }

  function openLatestVisit() {
    const v = workspace?.latestVisit;
    if (!v?.id) return;
    onOpenFinding({ id: v.id } as FieldFindingListRow);
  }

  const info = workspace?.blockInfo;
  const growthPct = info?.growthPercent ?? selected?.growthPercent ?? 0;
  const growthStage = info?.growthStage ?? 'Vegetative';
  const nextStage = info?.nextStage ?? 'Flowering';
  const metrics = workspace?.soilReport?.metrics;
  const activeRecs = workspace?.blockRecommendations?.filter((r) => r.status !== 'archived') ?? [];

  if (loadingBlocks) {
    return <p className="tc-bl-empty">Loading farm blocks…</p>;
  }

  return (
    <div className="tc-blocks-tab">
      {error ? <p className="tc-bl-error">{error}</p> : null}

      <div className="tc-bl-farm-header">
        <h2 className="tc-bl-farm-title">Farm blocks</h2>
        {canWrite ? (
          <button type="button" className="tc-bl-btn-primary" onClick={onAddBlock}>
            + Add block
          </button>
        ) : null}
      </div>

      <div className="tc-bl-cards-scroll">
        {blocks.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`tc-bl-card ${selectedId === b.id ? 'tc-bl-card--active' : ''}`}
            onClick={() => setSelectedId(b.id)}
          >
            <div className="tc-bl-card-top">
              <span className="tc-bl-card-name">{b.name}</span>
              <span className="tc-bl-crop-badge">{b.cropName ?? 'Crop'}</span>
            </div>
            <p className="tc-bl-card-acre">{b.area ? `${b.area} acre` : '—'}</p>
            {b.varietyName ? <p className="tc-bl-card-variety">{b.varietyName}</p> : null}
            <div className="tc-bl-card-soil">
              <span className={soilDotClass(b.soilTone)} aria-hidden />
              <span>Soil: {soilHealthLabel(b.soilHealth)}</span>
            </div>
            <p className="tc-bl-card-visit">Last visit: {b.lastVisit ?? '—'}</p>
          </button>
        ))}
        {canWrite ? (
          <button type="button" className="tc-bl-card tc-bl-card--add" onClick={onAddBlock}>
            <span className="tc-bl-add-icon">+</span>
            <span>Add block</span>
          </button>
        ) : null}
        {blocks.length === 0 && !canWrite ? (
          <p className="tc-bl-empty">No farm blocks yet.</p>
        ) : null}
      </div>

      {selected ? (
        <section className="tc-bl-detail">
          <div className="tc-bl-detail-head">
            <div>
              <h3 className="tc-bl-detail-title">
                {selected.name} ({info?.crop ?? selected.cropName ?? '—'}) — {info?.area ?? selected.area ?? '—'}{' '}
                acre
              </h3>
            </div>
            <label className="tc-bl-change-block">
              <span className="sr-only">Change block</span>
              <select
                value={selectedId ?? ''}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <nav className="tc-bl-subtabs" aria-label="Block sections">
            {SUB_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tc-bl-subtab ${subTab === t.id ? 'tc-bl-subtab--active' : ''}`}
                onClick={() => setSubTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {loadingWs ? (
            <p className="tc-bl-empty">Loading block data…</p>
          ) : subTab === 'overview' ? (
            <div className="tc-bl-overview-grid">
              <article className="tc-bl-panel">
                <div className="tc-bl-panel-head">
                  <h4>Block information</h4>
                  {canWrite ? (
                    <button type="button" className="tc-bl-link-btn" onClick={openEdit}>
                      Edit
                    </button>
                  ) : null}
                </div>
                <dl className="tc-bl-info-list">
                  <div><dt>Name</dt><dd>{info?.blockName ?? selected.name}</dd></div>
                  <div><dt>Area</dt><dd>{info?.area ?? selected.area ?? '—'}</dd></div>
                  <div><dt>Crop</dt><dd>{info?.crop ?? selected.cropName ?? '—'}</dd></div>
                  <div><dt>Variety</dt><dd>{info?.variety ?? selected.varietyName ?? '—'}</dd></div>
                  <div>
                    <dt>Planting date</dt>
                    <dd>
                      {info?.plantingDate
                        ? String(info.plantingDate).slice(0, 10)
                        : selected.plantingDate
                          ? String(selected.plantingDate).slice(0, 10)
                          : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Days after planting</dt>
                    <dd>{info?.daysAfterPlanting != null ? `${info.daysAfterPlanting} days` : '—'}</dd>
                  </div>
                  <div><dt>Irrigation</dt><dd>{info?.irrigationType ?? '—'}</dd></div>
                  <div><dt>Spacing</dt><dd>{info?.spacing ?? '—'}</dd></div>
                </dl>
                <div className="tc-bl-progress-wrap">
                  <div className="tc-bl-panel-head">
                    <h4>Block progress</h4>
                  </div>
                  <p className="tc-bl-growth-label">
                    Growth stage: <strong>{growthStage}</strong>
                    <span className="tc-bl-growth-arrow"> → {nextStage}</span>
                  </p>
                  <div className="tc-bl-progress-bar" role="progressbar" aria-valuenow={growthPct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="tc-bl-progress-fill" style={{ width: `${Math.min(100, growthPct)}%` }} />
                  </div>
                  <p className="tc-bl-progress-pct">{growthPct}%</p>
                </div>
              </article>

              <article className="tc-bl-panel">
                <div className="tc-bl-panel-head">
                  <h4>Soil reports</h4>
                  {canWrite ? (
                    <button type="button" className="tc-bl-link-btn" onClick={() => setSoilOpen(true)}>
                      Add test
                    </button>
                  ) : null}
                </div>
                <table className="tc-bl-soil-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Value</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SOIL_MACRO_FIELDS.map((f) => {
                      const m = metrics?.macro?.[f.key];
                      if (!m?.value) return null;
                      const st = metricStatusLabel(f.key, m.value);
                      return (
                        <tr key={f.key}>
                          <td>{f.label}</td>
                          <td>
                            {m.value}
                            {m.unit ? ` ${m.unit}` : ''}
                          </td>
                          <td>
                            <span className={`tc-bl-status tc-bl-status--${st.tone}`}>{st.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {!metrics?.macro || !Object.values(metrics.macro).some((m) => m?.value) ? (
                      <tr>
                        <td colSpan={3} className="tc-bl-muted">
                          No soil test on file — add a soil report.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                {workspace?.soilReport?.pdfUrl ? (
                  <a
                    className="tc-bl-pdf-link"
                    href={workspace.soilReport.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    📄 {selected.name.replace(/\s+/g, '_')}_Soil_Report.pdf
                  </a>
                ) : workspace?.soilReport?.reportedLabel ? (
                  <p className="tc-bl-muted tc-bl-report-date">
                    Last report: {workspace.soilReport.reportedLabel}
                  </p>
                ) : null}
              </article>

              <article className="tc-bl-panel">
                <div className="tc-bl-panel-head">
                  <h4>Latest visit {workspace?.latestVisit?.visitedLabel ? `(${workspace.latestVisit.visitedLabel})` : ''}</h4>
                  {workspace?.latestVisit?.id ? (
                    <button type="button" className="tc-bl-link-btn" onClick={openLatestVisit}>
                      View
                    </button>
                  ) : null}
                </div>
                {workspace?.latestVisit ? (
                  <>
                    <dl className="tc-bl-info-list tc-bl-info-list--compact">
                      <div><dt>Agronomist</dt><dd>{workspace.latestVisit.agronomistName ?? '—'}</dd></div>
                      <div><dt>Disease</dt><dd>{workspace.latestVisit.diseasePest ?? '—'}</dd></div>
                      <div><dt>SPAD</dt><dd>{workspace.latestVisit.spad ?? '—'}</dd></div>
                      <div><dt>Shoot / leaf</dt><dd>{[workspace.latestVisit.shootCount, workspace.latestVisit.leafCount].filter(Boolean).join(' / ') || '—'}</dd></div>
                      <div><dt>Moisture</dt><dd>{workspace.latestVisit.moisture ?? '—'}</dd></div>
                      <div><dt>Pest pressure</dt><dd>{workspace.latestVisit.pestPressure ?? '—'}</dd></div>
                    </dl>
                    {workspace.latestVisit.observations ? (
                      <p className="tc-bl-visit-notes">{workspace.latestVisit.observations}</p>
                    ) : null}
                    {(workspace.latestVisit.photoUrls?.length ?? 0) > 0 ? (
                      <div className="tc-bl-photos">
                        {workspace.latestVisit.photoUrls!.slice(0, 3).map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="tc-bl-photo">
                            <img src={url} alt="" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="tc-bl-muted">
                    No visits yet.{' '}
                    {canWrite ? (
                      <button type="button" className="tc-bl-link-btn" onClick={onAddFieldFinding}>
                        Add finding
                      </button>
                    ) : null}
                  </p>
                )}
              </article>

              <article className="tc-bl-panel">
                <div className="tc-bl-panel-head">
                  <h4>Current recommendation</h4>
                  {canWrite ? (
                    <button type="button" className="tc-bl-link-btn" onClick={onAddRecommendation}>
                      Add
                    </button>
                  ) : null}
                </div>
                {activeRecs.length === 0 ? (
                  <p className="tc-bl-muted">No active recommendations for this block.</p>
                ) : (
                  <ul className="tc-bl-rec-list">
                    {activeRecs.slice(0, 4).map((r) => (
                      <li key={r.id} className={recTypeClass(r.recType)}>
                        <span className="tc-bl-rec-type">{recTypeLabel(r.recType)}</span>
                        <p className="tc-bl-rec-text">{r.recommendation ?? r.problem ?? '—'}</p>
                        {r.followUpLabel ? (
                          <p className="tc-bl-rec-follow">Follow-up: {r.followUpLabel}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                {workspace?.nextFollowUp ? (
                  <div className="tc-bl-next-followup">
                    <span className="tc-bl-next-label">Next follow-up</span>
                    <strong>{workspace.nextFollowUp.dueLabel}</strong>
                    {workspace.nextFollowUp.title ? (
                      <span className="tc-bl-muted"> — {workspace.nextFollowUp.title}</span>
                    ) : null}
                  </div>
                ) : null}
              </article>

              <article className="tc-bl-panel tc-bl-panel--timeline">
                <h4>Timeline</h4>
                <ul className="tc-bl-timeline">
                  {(workspace?.timeline ?? []).slice(0, 6).map((ev, i) => (
                    <li key={`${ev.atLabel}-${i}`} className="tc-bl-timeline-item">
                      <span className="tc-bl-timeline-dot" aria-hidden />
                      <div>
                        <p className="tc-bl-timeline-title">{ev.title}</p>
                        <p className="tc-bl-timeline-when">{ev.atLabel}</p>
                        {ev.detail ? <p className="tc-bl-timeline-detail">{ev.detail}</p> : null}
                      </div>
                    </li>
                  ))}
                  {(workspace?.timeline?.length ?? 0) === 0 ? (
                    <li className="tc-bl-muted">No timeline events yet.</li>
                  ) : null}
                </ul>
              </article>
            </div>
          ) : subTab === 'soil' ? (
            <div className="tc-bl-panel">
              <div className="tc-bl-panel-head">
                <h4>All soil reports</h4>
                {canWrite ? (
                  <button type="button" className="tc-bl-link-btn" onClick={() => setSoilOpen(true)}>
                    + Add soil test
                  </button>
                ) : null}
              </div>
              <ul className="tc-bl-soil-list">
                {(workspace?.soilReports ?? []).map((s) => (
                  <li key={s.id} className="tc-bl-soil-list-item">
                    <span className="font-medium">{s.reportedLabel ?? 'Soil report'}</span>
                    {s.pdfUrl ? (
                      <a href={s.pdfUrl} target="_blank" rel="noreferrer" className="tc-bl-link-btn">
                        PDF
                      </a>
                    ) : null}
                  </li>
                ))}
                {(workspace?.soilReports?.length ?? 0) === 0 ? (
                  <li className="tc-bl-muted">No soil reports for this block.</li>
                ) : null}
              </ul>
            </div>
          ) : subTab === 'visits' ? (
            <div className="tc-bl-table-wrap">
              <div className="tc-bl-panel-head">
                <h4>Visit findings</h4>
                {canWrite ? (
                  <button type="button" className="tc-bl-link-btn" onClick={onAddFieldFinding}>
                    + Add finding
                  </button>
                ) : null}
              </div>
              <table className="tc-bl-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Agronomist</th>
                    <th>Disease / pest</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {(workspace?.visits ?? []).map((v) => (
                    <tr
                      key={v.id}
                      className="tc-bl-row-click"
                      onClick={() => onOpenFinding({ id: v.id } as FieldFindingListRow)}
                    >
                      <td>{v.visitedLabel ?? '—'}</td>
                      <td>{v.agronomistName ?? '—'}</td>
                      <td>{v.diseasePest ?? '—'}</td>
                      <td className="tc-bl-notes-cell">{v.observations ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(workspace?.visits?.length ?? 0) === 0 ? (
                <p className="tc-bl-empty">No visit findings for this block.</p>
              ) : null}
            </div>
          ) : subTab === 'recommendations' ? (
            <div className="tc-bl-panel">
              <div className="tc-bl-panel-head">
                <h4>Recommendations</h4>
                {canWrite ? (
                  <button type="button" className="tc-bl-btn-secondary" onClick={onAddRecommendation}>
                    + Recommendation
                  </button>
                ) : null}
              </div>
              <ul className="tc-bl-rec-list">
                {(workspace?.blockRecommendations ?? []).map((r) => (
                  <li key={r.id} className={recTypeClass(r.recType)}>
                    <span className="tc-bl-rec-type">{recTypeLabel(r.recType)}</span>
                    <p className="tc-bl-rec-text">{r.recommendation ?? '—'}</p>
                    <p className="tc-bl-muted">{r.recommendedBy ?? ''}</p>
                  </li>
                ))}
                {(workspace?.blockRecommendations?.length ?? 0) === 0 ? (
                  <li className="tc-bl-muted">No recommendations.</li>
                ) : null}
              </ul>
            </div>
          ) : subTab === 'followups' ? (
            <div className="tc-bl-panel">
              <div className="tc-bl-panel-head">
                <h4>Follow-ups</h4>
                {canWrite ? (
                  <button type="button" className="tc-bl-link-btn" onClick={onScheduleVisit}>
                    Schedule visit
                  </button>
                ) : null}
              </div>
              <ul className="tc-bl-follow-list">
                {(workspace?.followUps ?? []).map((f) => (
                  <li key={f.id}>
                    <strong>{f.title ?? 'Task'}</strong>
                    <span className="tc-bl-muted"> — due {f.dueLabel ?? '—'}</span>
                    {f.notes ? <p className="tc-bl-muted">{f.notes}</p> : null}
                  </li>
                ))}
                {(workspace?.followUps?.length ?? 0) === 0 ? (
                  <li className="tc-bl-muted">No pending follow-ups.</li>
                ) : null}
              </ul>
            </div>
          ) : (
            <div className="tc-bl-panel">
              <h4>Block timeline</h4>
              <ul className="tc-bl-timeline tc-bl-timeline--full">
                {(workspace?.timeline ?? []).map((ev, i) => (
                  <li key={`${ev.atLabel}-${i}`} className="tc-bl-timeline-item">
                    <span className="tc-bl-timeline-dot" aria-hidden />
                    <div>
                      <p className="tc-bl-timeline-title">{ev.title}</p>
                      <p className="tc-bl-timeline-when">{ev.atLabel}</p>
                      {ev.detail ? <p className="tc-bl-timeline-detail">{ev.detail}</p> : null}
                    </div>
                  </li>
                ))}
                {(workspace?.timeline?.length ?? 0) === 0 ? (
                  <li className="tc-bl-muted">No events on timeline.</li>
                ) : null}
              </ul>
            </div>
          )}

          {subTab === 'overview' ? (
            <button type="button" className="tc-bl-timeline-cta" onClick={() => setSubTab('timeline')}>
              View block timeline
            </button>
          ) : null}
        </section>
      ) : (
        <p className="tc-bl-empty">Add a farm block to get started.</p>
      )}

      {editOpen ? (
        <div className="tc-bl-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-block-title">
          <div className="tc-bl-modal">
            <div className="tc-bl-modal-head">
              <h3 id="edit-block-title">Edit block</h3>
              <button type="button" className="tc-bl-modal-close" onClick={() => setEditOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <CropBlockFields blocks={[editBlock]} onChange={(rows) => setEditBlock(rows[0] ?? emptyCropBlock())} />
            <div className="tc-bl-modal-actions">
              <button type="button" className="tc-bl-btn-secondary" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button type="button" className="tc-bl-btn-primary" disabled={saving} onClick={() => void saveBlock()}>
                {saving ? 'Saving…' : 'Save block'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {soilOpen ? (
        <div className="tc-bl-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="soil-test-title">
          <div className="tc-bl-modal tc-bl-modal--wide">
            <div className="tc-bl-modal-head">
              <h3 id="soil-test-title">New soil test — {selected?.name ?? 'Block'}</h3>
              <button type="button" className="tc-bl-modal-close" onClick={() => setSoilOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <form onSubmit={saveSoilTest}>
              <SoilTestForm
                macro={soilMacro}
                micro={soilMicro}
                soilType={soilType}
                onMacroChange={setSoilMacro}
                onMicroChange={setSoilMicro}
                onSoilTypeChange={setSoilType}
                disabled={saving}
              />
              <div className="tc-bl-modal-actions">
                <button type="button" className="tc-bl-btn-secondary" onClick={() => setSoilOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="tc-bl-btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save soil test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
