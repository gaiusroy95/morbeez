import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../../lib/api';
import { Btn, Loading, StaticSelect } from '../../ui';
import { Field, Modal, inputClass } from '../../Modal';
import { LeadQueueColumnManager } from './LeadQueueColumnManager';
import { LeadRowActions } from './LeadRowActions';
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

type LeadQueueCounts = {
  mine: number;
  all: number;
  visible?: number;
  inScope?: number;
  scopeTotal?: number;
};

type Props = {
  canWrite: boolean;
  scope: 'mine' | 'all';
  counts: LeadQueueCounts;
  onScopeChange: (scope: 'mine' | 'all') => void;
  selectedLeadId: string | null;
  onOpenLead: (leadId: string, lead: OperationalLead) => void;
  onEditLead?: (leadId: string) => void;
  onDeleteLead?: (lead: OperationalLead) => void;
  refreshToken?: number;
  queueHeaderExtra?: ReactNode;
  tasksPanel?: ReactNode;
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
  queueHeaderExtra,
  tasksPanel,
}: Props) {
  const [leads, setLeads] = useState<OperationalLead[]>([]);
  const [queueCounts, setQueueCounts] = useState<LeadQueueCounts>(counts);
  const [filtersActive, setFiltersActive] = useState(false);
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [actionMenu, setActionMenu] = useState<{
    lead: OperationalLead;
    anchor: HTMLButtonElement;
  } | null>(null);
  const [actionMenuPos, setActionMenuPos] = useState<{ top: number; left: number } | null>(null);

  const prefsLoaded = useRef(false);
  const resizeRef = useRef<{ colId: LeadQueueColumnId; startX: number; startW: number } | null>(null);
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const [tableScrolledX, setTableScrolledX] = useState(false);

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
        api<{
          ok: boolean;
          leads: OperationalLead[];
          priorityMeta: PriorityMeta;
          counts?: LeadQueueCounts;
          filtersActive?: boolean;
        }>(`${BASE}/leads/operational?${params}`),
        api<{ ok: boolean; summary: QueueSummary }>(`${BASE}/leads/queue-summary?scope=${scope}`),
      ]);
      setLeads(leadRes.leads ?? []);
      if (leadRes.counts) {
        setQueueCounts(leadRes.counts);
      } else {
        setQueueCounts(counts);
      }
      setFiltersActive(Boolean(leadRes.filtersActive));
      setPriorityMeta(leadRes.priorityMeta ?? {});
      setSummary(sumRes.summary ?? null);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load lead queue');
    } finally {
      setLoading(false);
    }
  }, [filterParams, scope, counts]);

  const scopeTabCount = useMemo(() => {
    if (filtersActive && queueCounts.visible != null) {
      return queueCounts.visible;
    }
    return scope === 'mine' ? queueCounts.mine : queueCounts.all;
  }, [filtersActive, queueCounts, scope]);

  const scopeTabHint = useMemo(() => {
    const total = scope === 'mine' ? queueCounts.mine : queueCounts.all;
    if (!filtersActive || queueCounts.visible == null) return null;
    if (queueCounts.visible === total) return null;
    return `${queueCounts.visible} of ${total}`;
  }, [filtersActive, queueCounts, scope]);

  const filterHint = useMemo(() => {
    if (!filtersActive || leads.length === 0) return null;
    const total = scope === 'mine' ? queueCounts.mine : queueCounts.all;
    if (leads.length >= total) return null;
    const parts: string[] = [];
    if (opportunityLevel === 'high') parts.push('High opportunity (70+)');
    else if (opportunityLevel === 'medium') parts.push('Medium opportunity (40–69)');
    else if (opportunityLevel === 'low') parts.push('Low opportunity');
    if (pendingTasks) parts.push('Pending tasks only');
    if (escalationsOnly) parts.push('Escalations only');
    if (smartFilter !== 'all') {
      const chip = SMART_FILTERS.find((f) => f.id === smartFilter);
      if (chip) parts.push(chip.label);
    }
    if (stage) parts.push(`Stage: ${stage}`);
    if (district.trim()) parts.push(`District: ${district.trim()}`);
    if (crop.trim()) parts.push(`Crop: ${crop.trim()}`);
    const filterText = parts.length ? parts.join(' · ') : 'Active filters';
    return `Showing ${leads.length} of ${total} leads. ${filterText}. Clear filters below to see all.`;
  }, [
    filtersActive,
    leads.length,
    queueCounts,
    scope,
    opportunityLevel,
    pendingTasks,
    escalationsOnly,
    smartFilter,
    stage,
    district,
    crop,
  ]);

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
    const el = tableWrapRef.current;
    if (!el) return;
    const onScroll = () => setTableScrolledX(el.scrollLeft > 8);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [leads, loading]);

  useLayoutEffect(() => {
    if (!actionMenu) {
      setActionMenuPos(null);
      return;
    }
    const rect = actionMenu.anchor.getBoundingClientRect();
    const menuWidth = 152;
    let left = rect.right - menuWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
    setActionMenuPos({ top: rect.bottom + 6, left });
  }, [actionMenu]);

  useEffect(() => {
    if (!actionMenu) return;
    function close(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (actionMenu.anchor.contains(target)) return;
      if (target.closest('.tc-lq-dropdown--portal')) return;
      setActionMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setActionMenu(null);
    }
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
    };
  }, [actionMenu]);

  function toggleActionMenu(lead: OperationalLead, anchor: HTMLButtonElement) {
    setActionMenu((prev) => (prev?.lead.id === lead.id ? null : { lead, anchor }));
  }

  function closeActionMenu() {
    setActionMenu(null);
  }

  const advancedFilterCount = useMemo(() => {
    let n = 0;
    if (stage) n += 1;
    if (district.trim()) n += 1;
    if (pincode.trim()) n += 1;
    if (language.trim()) n += 1;
    if (crop.trim()) n += 1;
    if (owner.trim()) n += 1;
    if (opportunityLevel) n += 1;
    if (escalationsOnly) n += 1;
    return n;
  }, [stage, district, pincode, language, crop, owner, opportunityLevel, escalationsOnly]);

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
      case 'actions':
        return (
          <LeadRowActions
            lead={lead}
            canWrite={canWrite}
            menuOpen={actionMenu?.lead.id === lead.id}
            onMoreClick={(anchor) => toggleActionMenu(lead, anchor)}
            onOpen={() => onOpenLead(lead.id, lead)}
          />
        );
      default:
        return '—';
    }
  }

  const colDef = (id: LeadQueueColumnId) => LEAD_QUEUE_COLUMNS.find((c) => c.id === id)!;

  const colAlignClass = (id: LeadQueueColumnId) => {
    const align = colDef(id).align ?? 'left';
    return `tc-lq-align-${align}`;
  };

  return (
    <div className="tc-lq-root">
      {summary ? (
        <div className="tc-lq-metrics-block">
          <div className="tc-lq-metrics-head">
            <h2 className="tc-lq-section-title">Lead queue</h2>
            {queueHeaderExtra ? <div className="tc-lq-metrics-actions">{queueHeaderExtra}</div> : null}
          </div>
          <div className="tc-lq-summary-strip" role="group" aria-label="Queue metrics">
          {(
            [
              { key: 'pending', label: 'Pending', value: summary.pendingTasks },
              { key: 'escalated', label: 'Escalations', value: summary.escalations },
              { key: 'due_today', label: 'Due today', value: summary.dueToday },
              { key: 'hot_leads', label: 'Hot leads', value: summary.hotLeads },
              { key: 'high_opportunity', label: 'High opp.', value: summary.highOpportunity },
              { key: 'at_risk', label: 'At risk', value: summary.atRisk },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              className={`tc-lq-summary-card${
                (item.key === 'high_opportunity' ? smartFilter === 'hot_leads' : smartFilter === item.key)
                  ? ' is-active'
                  : ''
              }`}
              onClick={() => {
                if (item.key === 'at_risk') return;
                const filterKey =
                  item.key === 'high_opportunity' ? 'hot_leads' : item.key;
                setSmartFilter(filterKey);
                setPendingTasks(filterKey === 'pending');
                setEscalationsOnly(filterKey === 'escalated');
              }}
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </button>
          ))}
          </div>
          {tasksPanel ? <div className="tc-lq-tasks-panel-wrap">{tasksPanel}</div> : null}
        </div>
      ) : null}

      <div className="tc-lq-filters-bar" role="toolbar" aria-label="Quick filters">
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
          <label className="tc-lq-chip tc-lq-chip--toggle">
            <input
              type="checkbox"
              checked={pendingTasks}
              onChange={(e) => setPendingTasks(e.target.checked)}
            />
            Pending only
          </label>
        </div>
      </div>

      <section className="tc-lq-command-panel">
        <div className="tc-lq-command-row">
          <div className="tc-lq-command-main">
            <div className="tc-scope-tabs tc-scope-tabs--compact">
              <button
                type="button"
                className={`tc-scope-tab ${scope === 'mine' ? 'active' : ''}`}
                onClick={() => onScopeChange('mine')}
              >
                My leads{' '}
                <em title={scope === 'mine' ? scopeTabHint ?? undefined : undefined}>
                  {scope === 'mine' && scopeTabHint ? scopeTabHint : queueCounts.mine}
                </em>
              </button>
              <button
                type="button"
                className={`tc-scope-tab ${scope === 'all' ? 'active' : ''}`}
                onClick={() => onScopeChange('all')}
              >
                All leads{' '}
                <em title={scope === 'all' ? scopeTabHint ?? undefined : undefined}>
                  {scope === 'all' && scopeTabHint ? scopeTabHint : queueCounts.all}
                </em>
              </button>
            </div>
            <div className="tc-lq-search-wrap">
              <span className="tc-lq-search-icon" aria-hidden>
                ⌕
              </span>
              <input
                className="tc-lq-search"
                placeholder="Search farmer, phone, crop, district…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="tc-lq-command-tools">
            <StaticSelect
              className="tc-lq-sort-select"
              compact
              value={sort}
              onChange={setSort}
              options={[
                { value: 'priority', label: 'Priority' },
                { value: 'pending_tasks', label: 'Pending tasks' },
                { value: 'escalations', label: 'Escalations' },
                { value: 'opportunity_score', label: 'Opportunity' },
                { value: 'relationship_score', label: 'Relationship' },
                { value: 'acreage', label: 'Acreage' },
                { value: 'follow_up_due', label: 'Follow-up due' },
                { value: 'recent_interaction', label: 'Recent interaction' },
                { value: 'recently_added', label: 'Recently added' },
              ]}
            />
            <button
              type="button"
              className={`tc-lq-tool-btn${showAdvancedFilters ? ' is-active' : ''}`}
              onClick={() => setShowAdvancedFilters((v) => !v)}
            >
              Filters
              {advancedFilterCount > 0 ? <span className="tc-lq-tool-badge">{advancedFilterCount}</span> : null}
            </button>
            <button
              type="button"
              className={`tc-lq-tool-btn${showColumns ? ' is-active' : ''}`}
              onClick={() => setShowColumns((v) => !v)}
            >
              Columns
            </button>
            <button type="button" className="tc-lq-tool-btn" onClick={() => void exportLeads()} title="Export CSV">
              Export
            </button>
            <button type="button" className="tc-lq-tool-btn tc-lq-tool-btn--icon" onClick={() => void loadLeads()} title="Refresh">
              ↻
            </button>
          </div>
        </div>

        {showAdvancedFilters ? (
          <div className="tc-lq-advanced-filters">
            <StaticSelect
              className="tc-lq-field"
              value={stage}
              onChange={setStage}
              options={[
                { value: '', label: 'All stages' },
                { value: 'new_lead', label: 'New lead' },
                { value: 'interested', label: 'Interested' },
                { value: 'follow_up', label: 'Follow-up' },
                { value: 'recommendation', label: 'Recommendation' },
                { value: 'order_placed', label: 'Order placed' },
              ]}
            />
            <input
              className="tc-lq-field"
              placeholder="District"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            />
            <input
              className="tc-lq-field"
              placeholder="Pincode"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
            />
            <input
              className="tc-lq-field"
              placeholder="Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            />
            <input
              className="tc-lq-field"
              placeholder="Crop"
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
            />
            <input
              className="tc-lq-field"
              placeholder="Owner email"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
            <StaticSelect
              className="tc-lq-field"
              value={opportunityLevel}
              onChange={(value) =>
                setOpportunityLevel(value as '' | 'high' | 'medium' | 'low')
              }
              options={[
                { value: '', label: 'Opportunity level' },
                { value: 'high', label: 'High (70+)' },
                { value: 'medium', label: 'Medium (40-69)' },
                { value: 'low', label: 'Low (<40)' },
              ]}
            />
            <label className="tc-lq-field tc-lq-field--check">
              <input
                type="checkbox"
                checked={escalationsOnly}
                onChange={(e) => setEscalationsOnly(e.target.checked)}
              />
              Escalations only
            </label>
          </div>
        ) : null}
      </section>

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

      {filterHint ? (
        <p className="tc-lq-filter-hint" role="status">
          {filterHint}{' '}
          <button
            type="button"
            className="tc-lq-filter-hint-clear"
            onClick={() => {
              setOpportunityLevel('');
              setStage('');
              setDistrict('');
              setPincode('');
              setLanguage('');
              setCrop('');
              setOwner('');
              setEscalationsOnly(false);
              setPendingTasks(false);
              setSmartFilter('all');
            }}
          >
            Clear filters
          </button>
        </p>
      ) : null}

      {loading ? (
        <Loading label="Loading lead queue…" />
      ) : (
        <>
          <div className={`tc-lq-table-panel${tableScrolledX ? ' is-scrolled-x' : ''}`}>
            <div className="tc-lq-table-scroll-hint" aria-hidden>
              Scroll horizontally for more columns →
            </div>
            <div className="tc-lq-table-wrap" ref={tableWrapRef}>
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
                        className={[
                          'tc-lq-th',
                          colAlignClass(id),
                          col.sticky ? 'tc-lq-th--sticky' : '',
                          id === 'actions' ? 'tc-lq-th--sticky-right' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
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
                            className={[
                              'tc-lq-td',
                              colAlignClass(id),
                              col.sticky ? 'tc-lq-td--sticky' : '',
                              id === 'actions' ? 'tc-lq-td--sticky-right' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
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
                <LeadRowActions
                  lead={lead}
                  canWrite={canWrite}
                  menuOpen={actionMenu?.lead.id === lead.id}
                  onMoreClick={(anchor) => toggleActionMenu(lead, anchor)}
                  onOpen={() => onOpenLead(lead.id, lead)}
                />
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
            <StaticSelect
              className={inputClass}
              value={bulkStage}
              onChange={setBulkStage}
              options={[
                { value: 'new_lead', label: 'New Lead' },
                { value: 'interested', label: 'Interested' },
                { value: 'follow_up', label: 'Follow-up' },
                { value: 'recommendation', label: 'Recommendation' },
                { value: 'order_placed', label: 'Order Placed' },
              ]}
            />
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
            <StaticSelect
              className={inputClass}
              value={bulkOwner}
              onChange={setBulkOwner}
              options={[
                { value: '', label: 'Select…' },
                ...team.map((m) => ({ value: m.email, label: `${m.fullName} (${m.email})` })),
              ]}
            />
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
            <StaticSelect
              className={inputClass}
              value={bulkOwner}
              onChange={setBulkOwner}
              options={[
                { value: '', label: 'Select…' },
                ...team.map((m) => ({ value: m.email, label: `${m.fullName} — ${m.role}` })),
              ]}
            />
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

      {actionMenu && actionMenuPos && canWrite
        ? createPortal(
            <div
              className="tc-lq-dropdown tc-lq-dropdown--portal"
              role="menu"
              style={{ top: actionMenuPos.top, left: actionMenuPos.left }}
              onClick={(e) => e.stopPropagation()}
            >
              {onEditLead ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onEditLead(actionMenu.lead.id);
                    closeActionMenu();
                  }}
                >
                  Edit lead
                </button>
              ) : null}
              {onDeleteLead ? (
                <button
                  type="button"
                  role="menuitem"
                  className="danger"
                  onClick={() => {
                    onDeleteLead(actionMenu.lead);
                    closeActionMenu();
                  }}
                >
                  Delete lead
                </button>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
