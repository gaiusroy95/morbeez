import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../lib/api';
import { Btn, Loading } from '../../ui';
import { Field, Modal, inputClass } from '../../Modal';
import { LeadQueueColumnManager } from './LeadQueueColumnManager';
import {
  DEFAULT_COLUMN_ORDER,
  DEFAULT_FILTER_STATE,
  DEFAULT_VISIBLE_COLUMNS,
  LEAD_QUEUE_COLUMNS,
  LEAD_QUEUE_TABLE,
  PRIORITY_COLOR_CLASS,
  SMART_FILTERS,
  VIEW_PRESETS,
  type LeadQueueColumnId,
  type ViewPresetId,
} from './lead-queue-config';
import type { OperationalLead, PriorityMeta, QueueSummary } from './lead-queue-types';
import {
  buildLeadQueueSearchParams,
  downloadLeadQueueCsv,
  type LeadQueueFilterParams,
} from './lead-queue-utils';

const STAGE_CLASS: Record<string, string> = {
  new_lead: 'stage-new',
  interested: 'stage-interested',
  follow_up: 'stage-follow',
  recommendation: 'stage-rec',
  order_placed: 'stage-order',
  repeat_customer: 'stage-repeat',
};

type TeamMember = { email: string; fullName: string; role: string };

type Props = {
  canWrite: boolean;
  scope: 'mine' | 'all';
  counts: { mine: number; all: number };
  onScopeChange: (scope: 'mine' | 'all') => void;
  selectedLeadId: string | null;
  onOpenLead: (leadId: string, lead: OperationalLead) => void;
  onEditLead?: (leadId: string) => void;
  onDeleteLead?: (lead: OperationalLead) => void;
  refreshToken?: number;
};

const BASE = '/morbeez-staff/api/v1/os/telecaller';

function phoneDigits(phone: string | null) {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : d;
}

function applyFilterState(
  fs: Record<string, unknown>,
  setters: {
    setPendingTasks: (v: boolean) => void;
    setSmartFilter: (v: string) => void;
    setSort: (v: string) => void;
    setSearch: (v: string) => void;
    setStage: (v: string) => void;
    setDistrict: (v: string) => void;
    setPincode: (v: string) => void;
    setLanguage: (v: string) => void;
    setCrop: (v: string) => void;
    setOwner: (v: string) => void;
    setOpportunityLevel: (v: '' | 'high' | 'medium' | 'low') => void;
    setEscalationsOnly: (v: boolean) => void;
  }
) {
  if (typeof fs.pendingTasks === 'boolean') setters.setPendingTasks(fs.pendingTasks);
  if (typeof fs.smartFilter === 'string') setters.setSmartFilter(fs.smartFilter);
  if (typeof fs.sort === 'string') setters.setSort(fs.sort);
  if (typeof fs.search === 'string') setters.setSearch(fs.search);
  if (typeof fs.stage === 'string') setters.setStage(fs.stage);
  if (typeof fs.district === 'string') setters.setDistrict(fs.district);
  if (typeof fs.pincode === 'string') setters.setPincode(fs.pincode);
  if (typeof fs.language === 'string') setters.setLanguage(fs.language);
  if (typeof fs.crop === 'string') setters.setCrop(fs.crop);
  if (typeof fs.owner === 'string') setters.setOwner(fs.owner);
  if (fs.opportunityLevel === 'high' || fs.opportunityLevel === 'medium' || fs.opportunityLevel === 'low') {
    setters.setOpportunityLevel(fs.opportunityLevel);
  } else if (fs.opportunityLevel === '') {
    setters.setOpportunityLevel('');
  }
  if (typeof fs.escalationsOnly === 'boolean') setters.setEscalationsOnly(fs.escalationsOnly);
}

export function LeadOperationsTable({
  canWrite,
  scope,
  counts,
  onScopeChange,
  selectedLeadId,
  onOpenLead,
  onEditLead,
  onDeleteLead,
  refreshToken = 0,
}: Props) {
  const [leads, setLeads] = useState<OperationalLead[]>([]);
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [priorityMeta, setPriorityMeta] = useState<PriorityMeta>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState(DEFAULT_FILTER_STATE.search);
  const [stage, setStage] = useState(DEFAULT_FILTER_STATE.stage);
  const [district, setDistrict] = useState(DEFAULT_FILTER_STATE.district);
  const [pincode, setPincode] = useState(DEFAULT_FILTER_STATE.pincode);
  const [language, setLanguage] = useState(DEFAULT_FILTER_STATE.language);
  const [crop, setCrop] = useState(DEFAULT_FILTER_STATE.crop);
  const [owner, setOwner] = useState(DEFAULT_FILTER_STATE.owner);
  const [opportunityLevel, setOpportunityLevel] = useState<'' | 'high' | 'medium' | 'low'>(
    DEFAULT_FILTER_STATE.opportunityLevel
  );
  const [escalationsOnly, setEscalationsOnly] = useState(DEFAULT_FILTER_STATE.escalationsOnly);
  const [pendingTasks, setPendingTasks] = useState(DEFAULT_FILTER_STATE.pendingTasks);
  const [smartFilter, setSmartFilter] = useState<string>(DEFAULT_FILTER_STATE.smartFilter);
  const [sort, setSort] = useState<string>(DEFAULT_FILTER_STATE.sort);

  const [visibleColumns, setVisibleColumns] = useState<LeadQueueColumnId[]>(
    DEFAULT_VISIBLE_COLUMNS as LeadQueueColumnId[]
  );
  const [columnOrder, setColumnOrder] = useState<LeadQueueColumnId[]>(
    DEFAULT_COLUMN_ORDER as LeadQueueColumnId[]
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [showColumns, setShowColumns] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [showSaveView, setShowSaveView] = useState(false);
  const [savedViews, setSavedViews] = useState<{ viewName: string; updatedAt: string }[]>([]);
  const [activeViewName, setActiveViewName] = useState('active');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showBulkStage, setShowBulkStage] = useState(false);
  const [showBulkOwner, setShowBulkOwner] = useState(false);
  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [showBulkTag, setShowBulkTag] = useState(false);
  const [bulkStage, setBulkStage] = useState('follow_up');
  const [bulkOwner, setBulkOwner] = useState('');
  const [bulkTag, setBulkTag] = useState('');
  const [team, setTeam] = useState<TeamMember[]>([]);

  const prefsLoaded = useRef(false);
  const resizeRef = useRef<{ colId: LeadQueueColumnId; startX: number; startW: number } | null>(null);

  const filterParams = useMemo<LeadQueueFilterParams>(
    () => ({
      scope,
      sort,
      search,
      stage,
      district,
      pincode,
      language,
      crop,
      owner,
      opportunityLevel,
      pendingTasks,
      escalationsOnly,
      smartFilter,
    }),
    [
      scope,
      sort,
      search,
      stage,
      district,
      pincode,
      language,
      crop,
      owner,
      opportunityLevel,
      pendingTasks,
      escalationsOnly,
      smartFilter,
    ]
  );

  const filterSetters = useMemo(
    () => ({
      setPendingTasks,
      setSmartFilter,
      setSort,
      setSearch,
      setStage,
      setDistrict,
      setPincode,
      setLanguage,
      setCrop,
      setOwner,
      setOpportunityLevel,
      setEscalationsOnly,
    }),
    []
  );

  const orderedVisibleColumns = useMemo(() => {
    const visible = new Set(visibleColumns);
    return columnOrder.filter((id) => visible.has(id));
  }, [columnOrder, visibleColumns]);

  const stickyOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let left = canWrite ? 40 : 0;
    for (const id of orderedVisibleColumns) {
      const col = LEAD_QUEUE_COLUMNS.find((c) => c.id === id);
      if (col?.sticky && id !== 'actions') {
        offsets[id] = left;
        left += columnWidths[id] ?? col.defaultWidth;
      }
    }
    return offsets;
  }, [orderedVisibleColumns, columnWidths, canWrite]);

  const applyPrefs = useCallback(
    (prefs: {
      visibleColumns?: string[];
      columnOrder?: string[];
      columnWidths?: Record<string, number>;
      filterState?: Record<string, unknown>;
    }) => {
      if (prefs.visibleColumns?.length) {
        setVisibleColumns(prefs.visibleColumns as LeadQueueColumnId[]);
      }
      if (prefs.columnOrder?.length) {
        setColumnOrder(prefs.columnOrder as LeadQueueColumnId[]);
      }
      if (prefs.columnWidths) setColumnWidths(prefs.columnWidths);
      if (prefs.filterState) applyFilterState(prefs.filterState, filterSetters);
    },
    [filterSetters]
  );

  const loadPreferences = useCallback(
    async (viewName = 'active') => {
      try {
        const res = await api<{
          ok: boolean;
          preferences: {
            visibleColumns: string[];
            columnOrder: string[];
            columnWidths: Record<string, number>;
            filterState: Record<string, unknown>;
          } | null;
          views: { viewName: string; updatedAt: string }[];
        }>(`${BASE}/table-preferences?table=${LEAD_QUEUE_TABLE}&view=${encodeURIComponent(viewName)}`);
        setSavedViews(res.views ?? []);
        if (res.preferences) applyPrefs(res.preferences);
        setActiveViewName(viewName);
      } catch {
        /* use defaults */
      } finally {
        prefsLoaded.current = true;
      }
    },
    [applyPrefs]
  );

  const savePreferences = useCallback(
    async (viewName = 'active') => {
      if (!prefsLoaded.current) return;
      try {
        await api(`${BASE}/table-preferences`, {
          method: 'PUT',
          body: JSON.stringify({
            tableName: LEAD_QUEUE_TABLE,
            viewName,
            visibleColumns,
            columnOrder,
            columnWidths,
            filterState: {
              pendingTasks,
              smartFilter,
              sort,
              search,
              stage,
              district,
              pincode,
              language,
              crop,
              owner,
              opportunityLevel,
              escalationsOnly,
            },
          }),
        });
        const res = await api<{ ok: boolean; views: { viewName: string; updatedAt: string }[] }>(
          `${BASE}/table-preferences?table=${LEAD_QUEUE_TABLE}&view=active`
        );
        setSavedViews(res.views ?? []);
        if (viewName !== 'active') setActiveViewName(viewName);
      } catch {
        /* ignore */
      }
    },
    [
      visibleColumns,
      columnOrder,
      columnWidths,
      pendingTasks,
      smartFilter,
      sort,
      search,
      stage,
      district,
      pincode,
      language,
      crop,
      owner,
      opportunityLevel,
      escalationsOnly,
    ]
  );

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = buildLeadQueueSearchParams(filterParams);
      const [leadRes, sumRes] = await Promise.all([
        api<{ ok: boolean; leads: OperationalLead[]; priorityMeta: PriorityMeta }>(
          `${BASE}/leads/operational?${params}`
        ),
        api<{ ok: boolean; summary: QueueSummary }>(`${BASE}/leads/queue-summary?scope=${scope}`),
      ]);
      setLeads(leadRes.leads ?? []);
      setPriorityMeta(leadRes.priorityMeta ?? {});
      setSummary(sumRes.summary ?? null);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load lead queue');
    } finally {
      setLoading(false);
    }
  }, [filterParams, scope]);

  const loadTeam = useCallback(async () => {
    try {
      const res = await api<{ ok: boolean; team: TeamMember[] }>(`${BASE}/team`);
      setTeam(res.team ?? []);
    } catch {
      setTeam([]);
    }
  }, []);

  useEffect(() => {
    void loadPreferences('active');
    void loadTeam();
  }, [loadPreferences, loadTeam]);

  useEffect(() => {
    if (!prefsLoaded.current) return;
    const t = window.setTimeout(() => void savePreferences('active'), 600);
    return () => window.clearTimeout(t);
  }, [savePreferences]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads, refreshToken]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const r = resizeRef.current;
      if (!r) return;
      const w = Math.max(56, r.startW + e.clientX - r.startX);
      setColumnWidths((prev) => ({ ...prev, [r.colId]: w }));
    }
    function onMouseUp() {
      resizeRef.current = null;
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  function resetLayout() {
    setVisibleColumns([...DEFAULT_VISIBLE_COLUMNS] as LeadQueueColumnId[]);
    setColumnOrder([...DEFAULT_COLUMN_ORDER] as LeadQueueColumnId[]);
    setColumnWidths({});
    setPendingTasks(DEFAULT_FILTER_STATE.pendingTasks);
    setSmartFilter(DEFAULT_FILTER_STATE.smartFilter);
    setSort(DEFAULT_FILTER_STATE.sort);
    setSearch(DEFAULT_FILTER_STATE.search);
    setStage(DEFAULT_FILTER_STATE.stage);
    setDistrict(DEFAULT_FILTER_STATE.district);
    setPincode(DEFAULT_FILTER_STATE.pincode);
    setLanguage(DEFAULT_FILTER_STATE.language);
    setCrop(DEFAULT_FILTER_STATE.crop);
    setOwner(DEFAULT_FILTER_STATE.owner);
    setOpportunityLevel(DEFAULT_FILTER_STATE.opportunityLevel);
    setEscalationsOnly(DEFAULT_FILTER_STATE.escalationsOnly);
    setActiveViewName('active');
    void savePreferences('active');
  }

  function applyPreset(preset: ViewPresetId) {
    const p = VIEW_PRESETS[preset];
    setVisibleColumns([...p.visibleColumns]);
    setColumnOrder([...p.columnOrder]);
    setActiveViewName(preset);
  }

  function reorderColumns(fromId: LeadQueueColumnId, toId: LeadQueueColumnId) {
    setColumnOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(fromId);
      const toIdx = next.indexOf(toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromId);
      return next;
    });
  }

  function toggleColumn(id: LeadQueueColumnId) {
    setVisibleColumns((prev) => {
      if (prev.includes(id)) {
        if (id === 'priority' || id === 'farmerName' || id === 'actions') return prev;
        return prev.filter((c) => c !== id);
      }
      return [...prev, id];
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      if (prev.size === leads.length) return new Set();
      return new Set(leads.map((l) => l.id));
    });
  }

  async function runBulk(
    action: 'change_stage' | 'change_owner' | 'assign_employee' | 'add_broadcast_tag' | 'delete',
    payload?: { owner?: string; stage?: string; broadcastTag?: string }
  ) {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      await api(`${BASE}/leads/bulk`, {
        method: 'POST',
        body: JSON.stringify({
          leadIds: ids,
          action,
          ...(payload?.stage ? { stage: payload.stage } : {}),
          ...(payload?.owner ? { owner: payload.owner } : {}),
          ...(payload?.broadcastTag ? { broadcastTag: payload.broadcastTag } : {}),
        }),
      });
      setSelected(new Set());
      setShowBulkStage(false);
      setShowBulkOwner(false);
      setShowBulkAssign(false);
      setShowBulkTag(false);
      setBulkOwner('');
      setBulkTag('');
      await loadLeads();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk action failed');
    } finally {
      setBulkBusy(false);
    }
  }

  async function exportLeads(leadIds?: string[]) {
    try {
      const params = buildLeadQueueSearchParams(filterParams, {
        leadIds,
        limit: 200,
      });
      await downloadLeadQueueCsv(`${BASE}/leads/export?${params}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    }
  }

  function startColumnResize(e: React.MouseEvent, colId: LeadQueueColumnId) {
    e.preventDefault();
    e.stopPropagation();
    const col = LEAD_QUEUE_COLUMNS.find((c) => c.id === colId)!;
    resizeRef.current = {
      colId,
      startX: e.clientX,
      startW: columnWidths[colId] ?? col.defaultWidth,
    };
  }

  function renderCell(col: LeadQueueColumnId, lead: OperationalLead) {
    const meta = priorityMeta[lead.priorityBand];
    const colorClass = meta ? PRIORITY_COLOR_CLASS[meta.color] : 'tc-priority--gray';

    switch (col) {
      case 'priority':
        return (
          <span className={`tc-priority-pill ${colorClass}`} title={lead.priorityLabel}>
            {lead.priorityLabel}
          </span>
        );
      case 'farmerName':
        return (
          <div className="tc-lq-farmer">
            <span className="tc-avatar-sm">{lead.farmerInitials}</span>
            <strong>{lead.farmerName}</strong>
          </div>
        );
      case 'cropAcreage':
        return (
          <span>
            {lead.cropSummary ?? '—'}
            {lead.acreage != null ? ` · ${lead.acreage} ac` : ''}
          </span>
        );
      case 'pendingTasks':
        return (
          <span className={lead.pendingTasksCount > 0 ? 'tc-lq-badge tc-lq-badge--warn' : 'muted'}>
            {lead.pendingTasksCount}
          </span>
        );
      case 'escalations':
        return (
          <span className={lead.escalationCount > 0 ? 'tc-lq-badge tc-lq-badge--danger' : 'muted'}>
            {lead.escalationCount}
          </span>
        );
      case 'lastInteraction':
        return <span className="muted">{lead.lastInteractionLabel ?? '—'}</span>;
      case 'owner':
        return <span className="tc-lq-owner">{lead.owner ?? '—'}</span>;
      case 'stage':
        return (
          <span className={`tc-stage ${STAGE_CLASS[lead.stage] ?? 'stage-new'}`}>{lead.stageLabel}</span>
        );
      case 'phone':
        return <span>{lead.phone ?? '—'}</span>;
      case 'district':
        return <span>{lead.district ?? '—'}</span>;
      case 'pincode':
        return <span>{lead.pincode ?? '—'}</span>;
      case 'language':
        return <span>{lead.language ?? '—'}</span>;
      case 'relationshipScore':
        return <span>{lead.relationshipScore ?? '—'}</span>;
      case 'opportunityScore':
        return <span>{lead.opportunityScore ?? '—'}</span>;
      case 'dap':
        return <span>{lead.dap != null ? `${lead.dap}d` : '—'}</span>;
      case 'roiPotential':
        return <span>{lead.opportunityScore != null ? `★ ${lead.opportunityScore}` : '—'}</span>;
      case 'healthStatus':
        return <span>{lead.healthStatus ?? '—'}</span>;
      case 'followUpDue':
        return <span>{lead.followUpLabel ?? '—'}</span>;
      case 'createdDate':
        return <span className="muted">{lead.createdAtLabel}</span>;
      case 'actions': {
        const digits = phoneDigits(lead.phone);
        return (
          <div className="tc-lq-actions">
            <button type="button" className="tc-lq-action" onClick={() => onOpenLead(lead.id, lead)}>
              View
            </button>
            {canWrite && onEditLead ? (
              <button type="button" className="tc-lq-action" onClick={() => onEditLead(lead.id)}>
                Edit
              </button>
            ) : null}
            {digits ? (
              <>
                <a className="tc-lq-action" href={`tel:+91${digits}`}>
                  Call
                </a>
                <a
                  className="tc-lq-action"
                  href={`https://wa.me/91${digits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              </>
            ) : null}
            {canWrite && onDeleteLead ? (
              <button type="button" className="tc-lq-action tc-lq-action--danger" onClick={() => onDeleteLead(lead)}>
                Delete
              </button>
            ) : null}
          </div>
        );
      }
      default:
        return '—';
    }
  }

  const colDef = (id: LeadQueueColumnId) => LEAD_QUEUE_COLUMNS.find((c) => c.id === id)!;

  return (
    <div className="tc-lq-root">
      {summary ? (
        <div className="tc-lq-summary-grid">
          <div className="tc-lq-summary-card">
            <span>Pending Tasks</span>
            <strong>{summary.pendingTasks}</strong>
          </div>
          <div className="tc-lq-summary-card">
            <span>Escalations</span>
            <strong>{summary.escalations}</strong>
          </div>
          <div className="tc-lq-summary-card">
            <span>Due Today</span>
            <strong>{summary.dueToday}</strong>
          </div>
          <div className="tc-lq-summary-card">
            <span>Hot Leads</span>
            <strong>{summary.hotLeads}</strong>
          </div>
          <div className="tc-lq-summary-card">
            <span>High Opportunity</span>
            <strong>{summary.highOpportunity}</strong>
          </div>
          <div className="tc-lq-summary-card">
            <span>At Risk</span>
            <strong>{summary.atRisk}</strong>
          </div>
        </div>
      ) : null}

      <div className="tc-leads-toolbar">
        <div className="tc-toolbar-row tc-toolbar-row--primary">
          <div className="tc-scope-tabs">
            <button
              type="button"
              className={`tc-scope-tab ${scope === 'mine' ? 'active' : ''}`}
              onClick={() => onScopeChange('mine')}
            >
              My Leads ({counts.mine})
            </button>
            <button
              type="button"
              className={`tc-scope-tab ${scope === 'all' ? 'active' : ''}`}
              onClick={() => onScopeChange('all')}
            >
              All Leads ({counts.all})
            </button>
          </div>
          <input
            className="tc-lq-search"
            placeholder="Search name, phone, crop, district, pincode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="tc-lq-toolbar-actions">
            <button type="button" className="tc-lq-columns-btn" onClick={() => setShowColumns((v) => !v)}>
              Columns ▾
            </button>
            <Btn size="sm" variant="secondary" onClick={() => void exportLeads()}>
              Export all
            </Btn>
            <Btn size="sm" variant="secondary" onClick={() => void loadLeads()}>
              Refresh
            </Btn>
          </div>
        </div>

        <div className="tc-toolbar-row tc-toolbar-row--filters tc-lq-filters-grid">
          <label className="tc-lq-check">
            <input type="checkbox" checked={pendingTasks} onChange={(e) => setPendingTasks(e.target.checked)} />
            Pending tasks only
          </label>
          <label className="tc-lq-check">
            <input
              type="checkbox"
              checked={escalationsOnly}
              onChange={(e) => setEscalationsOnly(e.target.checked)}
            />
            Escalations only
          </label>
          <select className="tc-filter-select" value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">All stages</option>
            <option value="new_lead">New Lead</option>
            <option value="interested">Interested</option>
            <option value="follow_up">Follow-up</option>
            <option value="recommendation">Recommendation</option>
            <option value="order_placed">Order Placed</option>
          </select>
          <input
            className="tc-lq-filter-input"
            placeholder="District"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          />
          <input
            className="tc-lq-filter-input"
            placeholder="Pincode"
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
          />
          <input
            className="tc-lq-filter-input"
            placeholder="Language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          />
          <input
            className="tc-lq-filter-input"
            placeholder="Crop"
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
          />
          <input
            className="tc-lq-filter-input"
            placeholder="Lead owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          />
          <select
            className="tc-filter-select"
            value={opportunityLevel}
            onChange={(e) => setOpportunityLevel(e.target.value as '' | 'high' | 'medium' | 'low')}
          >
            <option value="">Opportunity level</option>
            <option value="high">High (70+)</option>
            <option value="medium">Medium (40–69)</option>
            <option value="low">Low (&lt;40)</option>
          </select>
          <select className="tc-filter-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="priority">Sort: Priority</option>
            <option value="pending_tasks">Pending Tasks</option>
            <option value="escalations">Escalations</option>
            <option value="opportunity_score">Opportunity Score</option>
            <option value="relationship_score">Relationship Score</option>
            <option value="acreage">Acreage</option>
            <option value="follow_up_due">Follow-up Due</option>
            <option value="recent_interaction">Recent Interaction</option>
            <option value="recently_added">Recently Added</option>
          </select>
        </div>

        <div className="tc-lq-smart-filters">
          {SMART_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`tc-lq-chip ${smartFilter === f.id ? 'active' : ''}`}
              onClick={() => {
                setSmartFilter(f.id);
                if (f.id === 'pending') setPendingTasks(true);
                if (f.id === 'escalated') setEscalationsOnly(true);
                if (f.id === 'all') {
                  setPendingTasks(false);
                  setEscalationsOnly(false);
                }
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {showColumns ? (
        <LeadQueueColumnManager
          columnOrder={columnOrder}
          visibleColumns={visibleColumns}
          savedViews={savedViews}
          activeViewName={activeViewName}
          onToggleColumn={toggleColumn}
          onReorder={reorderColumns}
          onApplyPreset={applyPreset}
          onLoadView={(name) => void loadPreferences(name)}
          onSaveView={() => setShowSaveView(true)}
          onReset={resetLayout}
        />
      ) : null}

      {selected.size > 0 ? (
        <div className="tc-lq-bulk-bar">
          <span>☑ {selected.size} lead(s) selected</span>
          {canWrite ? (
            <>
              <button type="button" disabled={bulkBusy} onClick={() => setShowBulkOwner(true)}>
                Change Owner
              </button>
              <button type="button" disabled={bulkBusy} onClick={() => setShowBulkAssign(true)}>
                Assign Employee
              </button>
              <button type="button" disabled={bulkBusy} onClick={() => setShowBulkStage(true)}>
                Change Stage
              </button>
              <button type="button" disabled={bulkBusy} onClick={() => setShowBulkTag(true)}>
                Add Broadcast Tag
              </button>
              <button type="button" disabled={bulkBusy} onClick={() => void exportLeads([...selected])}>
                Export
              </button>
              <button type="button" disabled={bulkBusy} className="danger" onClick={() => void runBulk('delete')}>
                Delete
              </button>
            </>
          ) : (
            <button type="button" disabled={bulkBusy} onClick={() => void exportLeads([...selected])}>
              Export
            </button>
          )}
        </div>
      ) : null}

      {error ? <p className="tc-lq-error">{error}</p> : null}

      {loading ? (
        <Loading label="Loading lead queue…" />
      ) : (
        <>
          <div className="tc-lq-table-wrap">
            <table className="tc-lq-table">
              <thead>
                <tr>
                  {canWrite ? (
                    <th className="tc-lq-th tc-lq-th--check">
                      <input
                        type="checkbox"
                        checked={selected.size === leads.length && leads.length > 0}
                        onChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </th>
                  ) : null}
                  {orderedVisibleColumns.map((id) => {
                    const col = colDef(id);
                    const w = columnWidths[id] ?? col.defaultWidth;
                    const stickyStyle =
                      col.sticky && id !== 'actions'
                        ? { width: w, minWidth: w, left: stickyOffsets[id] }
                        : col.sticky && id === 'actions'
                          ? { width: w, minWidth: w }
                          : { width: w, minWidth: w };
                    return (
                      <th
                        key={id}
                        className={
                          col.sticky
                            ? `tc-lq-th tc-lq-th--sticky${id === 'actions' ? ' tc-lq-th--sticky-right' : ''}`
                            : 'tc-lq-th'
                        }
                        style={stickyStyle}
                      >
                        <span className="tc-lq-th-inner">
                          {col.label}
                          <span
                            className="tc-lq-col-resize"
                            onMouseDown={(e) => startColumnResize(e, id)}
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={`Resize ${col.label}`}
                          />
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={orderedVisibleColumns.length + (canWrite ? 1 : 0)} className="tc-lq-empty">
                      No leads match this queue
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className={`tc-lq-row ${selectedLeadId === lead.id ? 'selected' : ''} ${
                        lead.isOverdue ? 'tc-lq-row--overdue' : ''
                      }`}
                    >
                      {canWrite ? (
                        <td className="tc-lq-td tc-lq-td--check">
                          <input
                            type="checkbox"
                            checked={selected.has(lead.id)}
                            onChange={() =>
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(lead.id)) next.delete(lead.id);
                                else next.add(lead.id);
                                return next;
                              })
                            }
                            aria-label={`Select ${lead.farmerName}`}
                          />
                        </td>
                      ) : null}
                      {orderedVisibleColumns.map((id) => {
                        const col = colDef(id);
                        const w = columnWidths[id] ?? col.defaultWidth;
                        const stickyStyle =
                          col.sticky && id !== 'actions'
                            ? { width: w, minWidth: w, left: stickyOffsets[id] }
                            : col.sticky && id === 'actions'
                              ? { width: w, minWidth: w }
                              : { width: w, minWidth: w };
                        return (
                          <td
                            key={id}
                            className={
                              col.sticky
                                ? `tc-lq-td tc-lq-td--sticky${id === 'actions' ? ' tc-lq-td--sticky-right' : ''}`
                                : 'tc-lq-td'
                            }
                            style={stickyStyle}
                            onClick={id !== 'actions' ? () => onOpenLead(lead.id, lead) : undefined}
                          >
                            {renderCell(id, lead)}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="tc-lq-mobile-list">
            {leads.map((lead) => (
              <article
                key={lead.id}
                className={`tc-lq-mobile-card ${selectedLeadId === lead.id ? 'selected' : ''}`}
              >
                <div className="tc-lq-mobile-head">
                  <span
                    className={`tc-priority-pill ${PRIORITY_COLOR_CLASS[priorityMeta[lead.priorityBand]?.color ?? 'gray']}`}
                  >
                    {lead.priorityLabel}
                  </span>
                  <strong>{lead.farmerName}</strong>
                  <span className="tc-lq-badge tc-lq-badge--warn">{lead.pendingTasksCount} tasks</span>
                </div>
                <p className="tc-lq-mobile-meta">
                  {lead.cropSummary ?? '—'} · Esc {lead.escalationCount}
                </p>
                <div className="tc-lq-actions">
                  <button type="button" className="tc-lq-action" onClick={() => onOpenLead(lead.id, lead)}>
                    View
                  </button>
                  {phoneDigits(lead.phone) ? (
                    <a className="tc-lq-action" href={`tel:+91${phoneDigits(lead.phone)}`}>
                      Call
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {showSaveView ? (
        <Modal
          title="Save table view"
          onClose={() => setShowSaveView(false)}
          onSave={async () => {
            const name = saveViewName.trim();
            if (!name) return;
            await savePreferences(name);
            setShowSaveView(false);
            setSaveViewName('');
            setActiveViewName(name);
          }}
          saveLabel="Save"
        >
          <Field label="View name">
            <input
              className={inputClass}
              value={saveViewName}
              onChange={(e) => setSaveViewName(e.target.value)}
              placeholder="e.g. Telecaller Workflow"
            />
          </Field>
        </Modal>
      ) : null}

      {showBulkStage ? (
        <Modal
          title="Change stage (bulk)"
          onClose={() => setShowBulkStage(false)}
          onSave={() => void runBulk('change_stage', { stage: bulkStage })}
          saving={bulkBusy}
        >
          <Field label="Stage">
            <select className={inputClass} value={bulkStage} onChange={(e) => setBulkStage(e.target.value)}>
              <option value="new_lead">New Lead</option>
              <option value="interested">Interested</option>
              <option value="follow_up">Follow-up</option>
              <option value="recommendation">Recommendation</option>
              <option value="order_placed">Order Placed</option>
            </select>
          </Field>
        </Modal>
      ) : null}

      {showBulkOwner ? (
        <Modal
          title="Change owner (bulk)"
          onClose={() => setShowBulkOwner(false)}
          onSave={() => void runBulk('change_owner', { owner: bulkOwner })}
          saving={bulkBusy}
        >
          <Field label="Owner email">
            <select className={inputClass} value={bulkOwner} onChange={(e) => setBulkOwner(e.target.value)}>
              <option value="">Select…</option>
              {team.map((m) => (
                <option key={m.email} value={m.email}>
                  {m.fullName} ({m.email})
                </option>
              ))}
            </select>
          </Field>
        </Modal>
      ) : null}

      {showBulkAssign ? (
        <Modal
          title="Assign employee (bulk)"
          onClose={() => setShowBulkAssign(false)}
          onSave={() => void runBulk('assign_employee', { owner: bulkOwner })}
          saving={bulkBusy}
        >
          <Field label="Employee">
            <select className={inputClass} value={bulkOwner} onChange={(e) => setBulkOwner(e.target.value)}>
              <option value="">Select…</option>
              {team.map((m) => (
                <option key={m.email} value={m.email}>
                  {m.fullName} — {m.role}
                </option>
              ))}
            </select>
          </Field>
        </Modal>
      ) : null}

      {showBulkTag ? (
        <Modal
          title="Add broadcast tag"
          onClose={() => setShowBulkTag(false)}
          onSave={() => void runBulk('add_broadcast_tag', { broadcastTag: bulkTag })}
          saving={bulkBusy}
        >
          <Field label="Tag name">
            <input
              className={inputClass}
              value={bulkTag}
              onChange={(e) => setBulkTag(e.target.value)}
              placeholder="e.g. monsoon_campaign"
            />
          </Field>
          <p className="muted text-sm" style={{ marginTop: 8 }}>
            Stored on farmer profile metadata for future broadcast targeting.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
