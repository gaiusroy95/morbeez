import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { formatPhoneDisplay, telHref, whatsAppPhone } from '@morbeez/shared';
import { api } from '../../lib/api';
import { CrmModals, type CrmModalType } from './CrmModals';
import { BlocksTab } from './BlocksTab';
import { EditFarmerModal } from './EditFarmerModal';
import { LeadExportMenuItems } from './LeadExportMenu';
import { RoiTrackerTab } from './RoiTrackerTab';
import { FieldActivitiesTab } from './FieldActivitiesTab';
import { FarmerIntelligencePanel, useFarmerIntelligenceProfile } from '../intelligence/FarmerIntelligencePanel';
import {
  InteractionDetailModal,
  type InteractionListRow,
} from './InteractionDetailModal';
import { NoteDetailModal, type NoteListRow } from './NoteDetailModal';
import { EscalationDetailModal, type EscalationListRow } from './EscalationDetailModal';
import { InteractionsTab } from './InteractionsTab';
import { OrdersTab } from './OrdersTab';
import { EstimateDetailView } from './EstimateDetailView';
import { CreateEstimateModal } from './CreateEstimateModal';
import { OrderDetailModal, type OrderListRow } from './OrderDetailModal';
import { FieldFindingsTab } from './FieldFindingsTab';
import { FieldFindingDetailModal, type FieldFindingListRow } from './FieldFindingDetailModal';
import { AgronomistTab, type AgronomistActivityRow } from './AgronomistTab';
import { AgronomistTasksTab } from './AgronomistTasksTab';
import '../../styles/agronomist-ops.css';
import { AgronomistActivityModal } from './AgronomistActivityModal';
import { Modal } from '../Modal';
import { Alert, Badge, Btn, DataTable, EmptyState, HubTabs, Loading, Panel, StaticSelect, TBody, Td, Th, THead, TableWrap } from '../ui';
import { CallIntelligencePanel } from './CallIntelligencePanel';
import { LeadTimelineFeed } from './LeadTimelineFeed';
import { TelecallerLeadTeamPanel } from './TelecallerLeadTeamPanel';

const STAGE_CLASS: Record<string, string> = {
  new_lead: 'stage-new',
  interested: 'stage-interested',
  follow_up: 'stage-follow',
  recommendation: 'stage-rec',
  order_placed: 'stage-order',
  repeat_customer: 'stage-repeat',
};

const STAGES = [
  { id: 'new_lead', label: 'New Lead' },
  { id: 'interested', label: 'Interested' },
  { id: 'follow_up', label: 'Follow-up' },
  { id: 'recommendation', label: 'Recommendation' },
  { id: 'order_placed', label: 'Order Placed' },
  { id: 'repeat_customer', label: 'Repeat Customer' },
] as const;

type Tab =
  | 'overview'
  | 'interactions'
  | 'whatsapp'
  | 'blocks'
  | 'findings'
  | 'agronomist'
  | 'agronomist_tasks'
  | 'pending_tasks'
  | 'escalations'
  | 'notes'
  | 'team'
  | 'orders'
  | 'roi_tracker'
  | 'field_activity';

type LeadDetail = {
  lead: {
    id: string;
    farmerId: string;
    farmerName: string;
    farmerInitials: string;
    phone: string | null;
    pincode?: string | null;
    district: string | null;
    state: string | null;
    stage: string;
    stageLabel: string;
    leadScore: number;
    notes: string | null;
    assignedTo?: string | null;
    serviceModel?: string | null;
    assignedPartnerId?: string | null;
    assignedPartnerName?: string | null;
    ownership?: string | null;
    enrollmentSource?: string | null;
    lastInteractionLabel?: string | null;
    leadChannel?: string | null;
    campaignSource?: string | null;
    marketingOwnerId?: string | null;
    marketingOwnerName?: string | null;
    attributionBadge?: string | null;
  };
  farmer: {
    pincode?: string | null;
    language: string;
    territory: string;
    crop: string;
    acreage: string;
    irrigation: string;
    soilType: string;
  };
  farmOverview: {
    totalBlocks: number;
    primaryCrop: string;
    blocks?: Array<{ id: string; name: string; cropType: string; acreage: unknown; isPrimary: boolean }>;
  };
  timeline: Array<{ id: string; type: string; title: string; detail: string; atLabel: string }>;
  nextFollowUp: { title: string; dueLabel: string; notes?: string } | null;
  orders: Array<{ label: string; amount: number; date: string }>;
};

type BlockRow = {
  id: string;
  name: string;
  cropName?: string;
  area?: string;
  plantingDate?: string;
  growthStageName?: string;
};

type Props = {
  leadId: string;
  canWrite: boolean;
  variant?: 'telecaller' | 'agronomist';
};

const LEAD_TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'interactions', label: 'Interactions' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'findings', label: 'Field findings' },
  { id: 'agronomist', label: 'Agronomist' },
  { id: 'agronomist_tasks', label: 'Agronomist tasks' },
  { id: 'pending_tasks', label: 'Pending tasks' },
  { id: 'team', label: 'Team' },
  { id: 'escalations', label: 'Escalations' },
  { id: 'notes', label: 'Notes' },
  { id: 'orders', label: 'Orders' },
  { id: 'roi_tracker', label: 'ROI tracker' },
  { id: 'field_activity', label: 'Field activity' },
];

export function LeadDetailPanel({ leadId, canWrite, variant = 'telecaller' }: Props) {
  const visibleTabs = useMemo(
    () =>
      variant === 'agronomist'
        ? LEAD_TABS.filter(
            (t) => !['orders', 'roi_tracker', 'whatsapp', 'interactions', 'team'].includes(t.id)
          )
        : LEAD_TABS,
    [variant]
  );
  const [tab, setTab] = useState<Tab>('overview');
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Array<Record<string, unknown>>>([]);
  const [escalations, setEscalations] = useState<Array<Record<string, unknown>>>([]);
  const [notesHistory, setNotesHistory] = useState<Array<Record<string, unknown>>>([]);
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);
  const [modal, setModal] = useState<CrmModalType>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [session, setSession] = useState<Record<string, unknown> | null>(null);
  const [waText, setWaText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEditFarmer, setShowEditFarmer] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [escalationCount, setEscalationCount] = useState(0);
  const [selectedInteraction, setSelectedInteraction] = useState<InteractionListRow | null>(
    null
  );
  const [selectedNote, setSelectedNote] = useState<NoteListRow | null>(null);
  const [selectedEscalation, setSelectedEscalation] = useState<EscalationListRow | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderListRow | null>(null);
  const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
  const [showCreateEstimate, setShowCreateEstimate] = useState(false);
  const [editingEstimateId, setEditingEstimateId] = useState<string | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<FieldFindingListRow | null>(null);
  const [selectedAgActivity, setSelectedAgActivity] = useState<AgronomistActivityRow | null>(null);
  const [archiveModal, setArchiveModal] = useState<{ path: string; label: string } | null>(null);
  const [marketingOwners, setMarketingOwners] = useState<Array<{ id: string; fullName: string }>>([]);
  const [attributionDraft, setAttributionDraft] = useState({
    leadChannel: '',
    campaignSource: '',
    marketingOwnerId: '',
    marketingOwnerName: '',
  });
  const { profile: intelProfile, loading: intelLoading } = useFarmerIntelligenceProfile(leadId);

  const base = '/morbeez-staff/api/v1/os/telecaller';

  const loadBlocks = useCallback(async () => {
    try {
      const b = await api<{ ok: boolean; blocks: BlockRow[] }>(`${base}/leads/${leadId}/blocks`);
      setBlocks(b.blocks ?? []);
    } catch {
      /* non-fatal */
    }
  }, [leadId]);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await api<LeadDetail & { ok: boolean }>(`${base}/leads/${leadId}`);
      setDetail(d);
      setAttributionDraft({
        leadChannel: String(d.lead.leadChannel ?? ''),
        campaignSource: String(d.lead.campaignSource ?? ''),
        marketingOwnerId: String(d.lead.marketingOwnerId ?? ''),
        marketingOwnerName: String(d.lead.marketingOwnerName ?? ''),
      });
      await loadBlocks();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lead');
    } finally {
      setLoading(false);
    }
  }, [leadId, loadBlocks]);

  useEffect(() => {
    void api<{ ok: boolean; owners: Array<{ id: string; fullName: string }> }>(
      `${base}/marketing-owners`
    )
      .then((res) => setMarketingOwners(res.owners ?? []))
      .catch(() => undefined);
  }, [base]);

  async function saveAttribution() {
    if (!canWrite) return;
    try {
      await api(`${base}/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          leadChannel: attributionDraft.leadChannel || null,
          campaignSource: attributionDraft.campaignSource.trim() || null,
          marketingOwnerId: attributionDraft.marketingOwnerId || null,
          marketingOwnerName: attributionDraft.marketingOwnerName.trim() || null,
        }),
      });
      bumpData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update attribution');
    }
  }

  const bumpData = useCallback(() => {
    setDataVersion((v) => v + 1);
    loadDetail();
  }, [loadDetail]);

  const loadTabData = useCallback(async () => {
    if (!detail) return;
    const farmerId = detail.lead.farmerId;
    try {
      if (tab === 'blocks') {
        const b = await api<{ ok: boolean; blocks: BlockRow[] }>(`${base}/leads/${leadId}/blocks`);
        setBlocks(b.blocks ?? []);
      } else if (tab === 'pending_tasks') {
        const t = await api<{ ok: boolean; tasks: Array<Record<string, unknown>> }>(`${base}/leads/${leadId}/tasks`);
        setPendingTasks(t.tasks ?? []);
      } else if (tab === 'whatsapp') {
        const [msg, sess] = await Promise.all([
          api<{ ok: boolean; messages: Array<Record<string, unknown>> }>(
            `${base}/whatsapp/${farmerId}/messages`
          ),
          api<{ ok: boolean; session: Record<string, unknown> | null }>(
            `${base}/whatsapp/${farmerId}/session`
          ),
        ]);
        setMessages(msg.messages ?? []);
        setSession(sess.session);
      } else if (tab === 'escalations') {
        const r = await api<{ ok: boolean; escalations: Array<Record<string, unknown>> }>(
          `${base}/leads/${leadId}/escalations`
        );
        setEscalations(r.escalations ?? []);
      } else if (tab === 'notes') {
        const r = await api<{ ok: boolean; notes: Array<Record<string, unknown>> }>(`${base}/leads/${leadId}/notes`);
        setNotesHistory(r.notes ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tab');
    }
  }, [tab, leadId, detail, dataVersion]);

  useEffect(() => {
    loadDetail();
    setTab('overview');
  }, [loadDetail]);

  useEffect(() => {
    if (!detail) return;
    let cancelled = false;
    Promise.all([
      api<{ ok: boolean; tasks: Array<{ status?: string }> }>(`${base}/leads/${leadId}/tasks`).catch(
        () => ({ ok: false, tasks: [] as Array<{ status?: string }> })
      ),
      api<{ ok: boolean; escalations: Array<{ status?: string }> }>(
        `${base}/leads/${leadId}/escalations`
      ).catch(() => ({ ok: false, escalations: [] as Array<{ status?: string }> })),
    ]).then(([tasksRes, escRes]) => {
      if (cancelled) return;
      const openTasks = (tasksRes.tasks ?? []).filter(
        (t) => String(t.status ?? 'pending') === 'pending'
      );
      const openEsc = (escRes.escalations ?? []).filter(
        (e) => !['resolved', 'closed'].includes(String(e.status ?? '').toLowerCase())
      );
      setPendingCount(openTasks.length);
      setEscalationCount(openEsc.length);
    });
    return () => {
      cancelled = true;
    };
  }, [leadId, detail, dataVersion]);

  useEffect(() => {
    if (detail && tab !== 'overview') loadTabData();
  }, [tab, detail, loadTabData, dataVersion]);

  async function changeStage(stage: string) {
    if (!canWrite) return;
    try {
      await api(`${base}/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
      });
      await loadDetail();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update stage');
    }
  }

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || !noteText.trim()) return;
    try {
      await api(`${base}/leads/${leadId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note: noteText.trim() }),
      });
      setNoteText('');
      await loadDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save note');
    }
  }

  async function sendWhatsApp(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || !detail || !waText.trim()) return;
    try {
      await api(`${base}/whatsapp/${detail.lead.farmerId}/send`, {
        method: 'POST',
        body: JSON.stringify({ text: waText.trim() }),
      });
      setWaText('');
      const msg = await api<{ ok: boolean; messages: Array<Record<string, unknown>> }>(
        `${base}/whatsapp/${detail.lead.farmerId}/messages`
      );
      setMessages(msg.messages ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed');
    }
  }

  async function archiveResource(path: string, label: string) {
    if (!canWrite) return;
    setArchiveModal({ path, label });
  }

  async function confirmArchiveResource() {
    if (!archiveModal) return;
    try {
      await api(archiveModal.path, { method: 'DELETE' });
      setArchiveModal(null);
      bumpData();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not archive ${archiveModal.label}`);
    }
  }

  async function patchSession(patch: Record<string, unknown>) {
    if (!canWrite || !detail) return;
    try {
      const res = await api<{ ok: boolean; session: Record<string, unknown> }>(
        `${base}/whatsapp/${detail.lead.farmerId}/session`,
        { method: 'PATCH', body: JSON.stringify(patch) }
      );
      setSession(res.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Session update failed');
    }
  }

  if (loading && !detail) {
    return <Loading label="Loading farmer…" />;
  }

  if (!detail) {
    return (
      <Alert tone="error" className="m-6">
        {error || 'Lead not found'}
      </Alert>
    );
  }

  const l = detail.lead;
  const f = detail.farmer;
  const timeline = Array.isArray(detail.timeline) ? detail.timeline : [];
  const recentOrders = Array.isArray(detail.orders) ? detail.orders : [];
  const overviewBlocks = Array.isArray(detail.farmOverview?.blocks) ? detail.farmOverview.blocks : [];
  const customerSince =
    timeline.length > 0 ? timeline[timeline.length - 1]?.atLabel ?? '—' : '—';
  const lastContacted = l.lastInteractionLabel ?? timeline[0]?.atLabel ?? '—';
  const assignedLabel = l.assignedTo ? String(l.assignedTo).split('@')[0] : 'Unassigned';
  const assignInitials =
    assignedLabel === 'Unassigned'
      ? '?'
      : assignedLabel
          .split(/[\s._-]+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? '')
          .join('') || assignedLabel.slice(0, 2).toUpperCase();
  const callCount = timeline.filter((x) => String(x.type).toLowerCase().includes('call')).length;
  const waCount = timeline.filter((x) => String(x.type).toLowerCase().includes('whatsapp')).length;
  const recCount = timeline.filter((x) => String(x.type).toLowerCase().includes('recommend')).length;

  return (
    <div className="tc-detail-root">
      <header className="tc-detail-header">
        <div className="tc-detail-header-layout">
          <div className="tc-detail-header-left">
            <div className="tc-detail-identity-row">
              <span className="tc-avatar-lg tc-avatar-lg--live">{l.farmerInitials}</span>
              <div className="tc-detail-identity-text">
                <div className="tc-detail-name-row">
                  <h2>{l.farmerName}</h2>
                  <span className="tc-customer-chip">
                    Customer
                    <span className="tc-customer-chip-dot" aria-hidden />
                  </span>
                </div>
                <p className="tc-detail-subline">
                  {formatPhoneDisplay(l.phone)}
                  <span className="tc-detail-dot">•</span>
                  {f.territory}
                  {l.pincode ? (
                    <>
                      <span className="tc-detail-dot">•</span>
                      Pincode: {l.pincode}
                    </>
                  ) : null}
                  {l.attributionBadge ? (
                    <>
                      <span className="tc-detail-dot">•</span>
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-800">
                        {l.attributionBadge}
                      </span>
                    </>
                  ) : null}
                </p>
                {canWrite ? (
                  <StaticSelect
                    className="tc-stage-select"
                    value={l.stage}
                    onChange={changeStage}
                    options={STAGES.map((s) => ({ value: s.id, label: s.label }))}
                  />
                ) : (
                  <span className={`tc-stage ${STAGE_CLASS[l.stage] ?? 'stage-new'}`}>{l.stageLabel}</span>
                )}
              </div>
            </div>
          </div>

          <div className="tc-detail-header-right">
            <div className="tc-detail-header-actions">
              <a
                className="tc-call-btn"
                href={telHref(l.phone) ?? undefined}
              >
                📞 Call
              </a>
              <button
                type="button"
                className="tc-note-btn"
                onClick={() => canWrite && setModal('note')}
              >
                ⊕ Add Note
              </button>
              <div className="tc-header-menu-wrap">
                <button
                  type="button"
                  className="tc-note-btn"
                  aria-label="Actions"
                  aria-expanded={headerMenuOpen}
                  onClick={() => {
                    setOverflowMenuOpen(false);
                    setHeaderMenuOpen((v) => !v);
                  }}
                >
                  Actions ▾
                </button>
                {headerMenuOpen ? (
                  <div className="tc-header-dropdown" role="menu">
                    {canWrite ? (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setHeaderMenuOpen(false);
                            setShowEditFarmer(true);
                          }}
                        >
                          Edit farmer profile
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setHeaderMenuOpen(false);
                            setModal('task');
                          }}
                        >
                          Create follow-up
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setHeaderMenuOpen(false);
                            setModal('recommendation');
                          }}
                        >
                          Add recommendation
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setHeaderMenuOpen(false);
                            setModal('visit');
                          }}
                        >
                          Schedule site visit
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        setTab('roi_tracker');
                      }}
                    >
                      Open ROI tracker
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="tc-header-menu-wrap">
                <button
                  type="button"
                  className="tc-more-btn"
                  aria-label="More options"
                  aria-expanded={overflowMenuOpen}
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    setOverflowMenuOpen((v) => !v);
                  }}
                >
                  ⋮
                </button>
                {overflowMenuOpen ? (
                  <div className="tc-header-dropdown" role="menu">
                    {l.phone ? (
                      <a
                        className="tc-header-dropdown-link"
                        role="menuitem"
                        href={`https://wa.me/${whatsAppPhone(l.phone)}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setOverflowMenuOpen(false)}
                      >
                        Open WhatsApp
                      </a>
                    ) : null}
                    <LeadExportMenuItems
                      leadId={leadId}
                      canShare={Boolean(l.phone)}
                      onClose={() => setOverflowMenuOpen(false)}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="tc-detail-header-meta">
              <div className="tc-detail-meta-item">
                <span className="tc-detail-meta-label">Last contacted</span>
                <strong className="tc-detail-meta-value">{lastContacted}</strong>
              </div>
              <div className="tc-detail-meta-item tc-detail-meta-item--assign">
                <span className="tc-detail-meta-label">Assigned to</span>
                <div className="tc-assign-chip">
                  <span className="tc-assign-avatar">{assignInitials}</span>
                  <span>{assignedLabel}</span>
                  <span className="tc-assign-chevron" aria-hidden>
                    ▾
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <HubTabs
          className="mt-3 border-t border-border pt-1"
          tabs={visibleTabs.map((t) => ({
            id: t.id,
            label: t.label,
            badge:
              t.id === 'pending_tasks' && pendingCount > 0
                ? pendingCount
                : t.id === 'escalations' && escalationCount > 0
                  ? escalationCount
                  : undefined,
          }))}
          active={tab}
          onChange={setTab}
        />
        {canWrite ? (
          <div className="flex flex-wrap items-center gap-2 py-3">
            <Btn size="sm" variant="secondary" onClick={() => setModal('call')}>
              Log call
            </Btn>
            <Btn size="sm" variant="secondary" onClick={() => setModal('task')}>
              Follow-up
            </Btn>
            <Btn size="sm" variant="secondary" onClick={() => setModal('visit')}>
              Schedule visit
            </Btn>
            <Btn size="sm" variant="secondary" onClick={() => setShowCreateEstimate(true)}>
              Create quote
            </Btn>
            <div className="tc-detail-alert-badges">
              {pendingCount > 0 ? (
                <button
                  type="button"
                  className="tc-alert-pill tc-alert-pill--tasks"
                  onClick={() => setTab('pending_tasks')}
                >
                  Pending tasks ({pendingCount})
                </button>
              ) : null}
              {escalationCount > 0 ? (
                <button
                  type="button"
                  className="tc-alert-pill tc-alert-pill--esc"
                  onClick={() => setTab('escalations')}
                >
                  Escalations ({escalationCount})
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      {error ? <Alert tone="error" className="mx-5 mt-3">{error}</Alert> : null}

      {modal ? (
        <CrmModals
          type={modal}
          leadId={leadId}
          blocks={blocks}
          onClose={() => setModal(null)}
          onSaved={bumpData}
        />
      ) : null}

      {selectedInteraction ? (
        <InteractionDetailModal
          leadId={leadId}
          row={selectedInteraction}
          canWrite={canWrite}
          onSaved={bumpData}
          onClose={() => setSelectedInteraction(null)}
          onOpenFinding={(findingId) => {
            setSelectedInteraction(null);
            setSelectedFinding({ id: findingId });
          }}
          onOpenRecommendation={() => {
            setSelectedInteraction(null);
            setTab('agronomist');
          }}
        />
      ) : null}

      {selectedNote ? (
        <NoteDetailModal
          leadId={leadId}
          row={selectedNote}
          canWrite={canWrite}
          onSaved={bumpData}
          onClose={() => setSelectedNote(null)}
        />
      ) : null}

      {selectedEscalation ? (
        <EscalationDetailModal
          row={selectedEscalation}
          canWrite={canWrite}
          onSaved={bumpData}
          onClose={() => setSelectedEscalation(null)}
        />
      ) : null}

      {showCreateEstimate || editingEstimateId ? (
        <CreateEstimateModal
          leadId={leadId}
          estimateId={editingEstimateId ?? undefined}
          farmerName={detail?.lead.farmerName ?? 'Farmer'}
          farmerPhone={detail?.lead.phone}
          farmerDistrict={detail?.lead.district}
          farmerState={detail?.lead.state}
          onClose={() => {
            setShowCreateEstimate(false);
            setEditingEstimateId(null);
          }}
          onCreated={bumpData}
        />
      ) : null}

      {selectedOrder ? (
        <OrderDetailModal
          leadId={leadId}
          row={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      ) : null}

      {selectedFinding ? (
        <FieldFindingDetailModal
          leadId={leadId}
          row={selectedFinding}
          canWrite={canWrite}
          onSaved={bumpData}
          onClose={() => setSelectedFinding(null)}
        />
      ) : null}

      {selectedAgActivity ? (
        <AgronomistActivityModal
          leadId={leadId}
          activity={selectedAgActivity}
          onClose={() => setSelectedAgActivity(null)}
        />
      ) : null}

      {showEditFarmer ? (
        <EditFarmerModal
          leadId={leadId}
          onClose={() => setShowEditFarmer(false)}
          onSaved={bumpData}
        />
      ) : null}
      {archiveModal ? (
        <Modal
          title={`Archive ${archiveModal.label}`}
          onClose={() => setArchiveModal(null)}
          onSave={confirmArchiveResource}
          saveLabel="Archive"
        >
          <p className="text-sm text-ink-secondary">Do you want to archive this {archiveModal.label}?</p>
        </Modal>
      ) : null}

      <div className="tc-detail-body">
        {tab === 'overview' ? (
          <div className="tc-farmer-dashboard tc-farmer-dashboard--v2">
            <section className="tc-kpi-strip">
              <article className="tc-kpi-card">
                <span className="tc-kpi-label">Total acres</span>
                <strong className="tc-kpi-value">{f.acreage || '—'}</strong>
              </article>
              <article className="tc-kpi-card">
                <span className="tc-kpi-label">Primary crop</span>
                <strong className="tc-kpi-value">{f.crop || detail.farmOverview?.primaryCrop || '—'}</strong>
              </article>
              <FarmerIntelligencePanel
                leadId={leadId}
                fallbackLeadScore={Number(l.leadScore)}
                variant="kpis"
                profile={intelProfile}
                loading={intelLoading}
              />
            </section>

            <p className="tc-farmer-facts-line">
              {[f.territory, l.pincode ? `PIN ${l.pincode}` : null, f.language, f.irrigation, f.soilType]
                .filter(Boolean)
                .join(' · ')}
            </p>

            <section className="tc-overview-split">
              <div className="tc-overview-primary">
                <FarmerIntelligencePanel
                  leadId={leadId}
                  fallbackLeadScore={Number(l.leadScore)}
                  variant="detail"
                  profile={intelProfile}
                  loading={intelLoading}
                />
                <footer className="tc-overview-timeline-footer">
                  <div>
                    <span>Customer since</span>
                    <strong>{customerSince}</strong>
                  </div>
                  <div>
                    <span>Next follow-up</span>
                    <strong>
                      {detail.nextFollowUp?.dueLabel ?? 'None scheduled'}
                      {detail.nextFollowUp ? <em className="tc-badge-due">Due soon</em> : null}
                    </strong>
                  </div>
                </footer>
                <LeadTimelineFeed leadId={leadId} refreshKey={dataVersion} />
              </div>

              <aside className="tc-overview-sidebar">
                <article className="tc-sidebar-card tc-sidebar-card--accent">
                  <h3>Upcoming follow-ups</h3>
                  {detail.nextFollowUp ? (
                    <div className="tc-followup-block">
                      <p className="tc-followup-title">{detail.nextFollowUp.title}</p>
                      <p className="tc-followup-time">{detail.nextFollowUp.dueLabel}</p>
                    </div>
                  ) : (
                    <p className="tc-empty-row">No follow-up scheduled</p>
                  )}
                </article>

                <article className="tc-sidebar-card tc-sidebar-card--partner">
                  <h3>Partner program</h3>
                  <dl className="tc-kv-mini">
                    <div>
                      <dt>Service model</dt>
                      <dd>{l.serviceModel?.replace(/_/g, ' ') ?? 'remote advisory'}</dd>
                    </div>
                    <div>
                      <dt>Assigned partner</dt>
                      <dd>{l.assignedPartnerName ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Ownership</dt>
                      <dd>{l.ownership ?? 'Morbeez'}</dd>
                    </div>
                    {l.enrollmentSource ? (
                      <div>
                        <dt>Enrollment</dt>
                        <dd>{l.enrollmentSource}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {l.assignedPartnerName ? (
                    <button type="button" className="tc-link-btn" onClick={() => setTab('team')}>
                      Open team discussion →
                    </button>
                  ) : null}
                </article>

                <article className="tc-sidebar-card">
                  <h3>Marketing attribution</h3>
                  {canWrite ? (
                    <div className="space-y-2 text-sm">
                      <StaticSelect
                        className="tc-stage-select w-full"
                        value={attributionDraft.leadChannel}
                        onChange={(v) => setAttributionDraft((d) => ({ ...d, leadChannel: v }))}
                        options={[
                          { value: '', label: 'Channel…' },
                          { value: 'meta', label: 'Meta' },
                          { value: 'instagram', label: 'Instagram' },
                          { value: 'google', label: 'Google' },
                          { value: 'whatsapp', label: 'WhatsApp' },
                          { value: 'field', label: 'Field' },
                          { value: 'referral', label: 'Referral' },
                          { value: 'organic', label: 'Organic' },
                          { value: 'other', label: 'Other' },
                        ]}
                      />
                      <input
                        className="tc-stage-select w-full"
                        placeholder="Campaign name"
                        value={attributionDraft.campaignSource}
                        onChange={(e) =>
                          setAttributionDraft((d) => ({ ...d, campaignSource: e.target.value }))
                        }
                      />
                      <StaticSelect
                        className="tc-stage-select w-full"
                        value={attributionDraft.marketingOwnerId}
                        onChange={(v) => setAttributionDraft((d) => ({ ...d, marketingOwnerId: v }))}
                        options={[
                          { value: '', label: 'In-house marketer…' },
                          ...marketingOwners.map((o) => ({ value: o.id, label: o.fullName })),
                        ]}
                      />
                      <input
                        className="tc-stage-select w-full"
                        placeholder="External agency name"
                        value={attributionDraft.marketingOwnerName}
                        onChange={(e) =>
                          setAttributionDraft((d) => ({ ...d, marketingOwnerName: e.target.value }))
                        }
                      />
                      <button type="button" className="tc-note-save-btn" onClick={() => void saveAttribution()}>
                        Save attribution
                      </button>
                    </div>
                  ) : (
                    <p className="tc-empty-row">{l.attributionBadge ?? 'Not attributed'}</p>
                  )}
                </article>

                {canWrite ? (
                  <CallIntelligencePanel
                    leadId={leadId}
                    farmerPhone={l.phone}
                    canWrite={canWrite}
                    onConfirmed={bumpData}
                  />
                ) : null}

                {canWrite ? (
                  <article className="tc-sidebar-card">
                    <h3>Internal note</h3>
                    <form onSubmit={addNote}>
                      <textarea
                        className="tc-note-input"
                        rows={3}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Call summary, farmer concern…"
                      />
                      <button type="submit" className="tc-note-save-btn">
                        Save note
                      </button>
                    </form>
                  </article>
                ) : null}

                <article className="tc-sidebar-card">
                  <h3>Recent orders</h3>
                  {recentOrders.length > 0 ? (
                    <ul className="tc-compact-list">
                      {recentOrders.slice(0, 3).map((o, idx) => (
                        <li key={`${o.label}-${o.date}-${idx}`}>
                          <strong>{o.label || `Order ${idx + 1}`}</strong>
                          <span>₹{Number(o.amount ?? 0).toLocaleString('en-IN')}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="tc-empty-orders">
                      <span className="tc-empty-orders-icon" aria-hidden>
                        🛒
                      </span>
                      <p>No recent orders</p>
                    </div>
                  )}
                </article>
              </aside>
            </section>

            <section className="tc-dashboard-card tc-blocks-summary">
              <div className="tc-card-head">
                <h3>Blocks summary</h3>
                <button type="button" className="tc-inline-link" onClick={() => setTab('blocks')}>
                  View all blocks
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="tc-blocks-table">
                  <thead>
                    <tr>
                      <th>Block</th>
                      <th>Crop</th>
                      <th>Area</th>
                      <th>Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewBlocks.map((b) => (
                      <tr key={b.id}>
                        <td>{b.name}</td>
                        <td>{b.cropType || '—'}</td>
                        <td>{String(b.acreage ?? '—')}</td>
                        <td>{b.isPrimary ? 'Primary' : 'Secondary'}</td>
                      </tr>
                    ))}
                    {overviewBlocks.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="tc-empty-row">
                          No blocks found
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="tc-overview-bottom">
              <article className="tc-bottom-card">
                <h3>Interaction summary</h3>
                <div className="tc-mini-kpis">
                  <div>
                    <span>Calls</span>
                    <strong>{callCount}</strong>
                  </div>
                  <div>
                    <span>WhatsApp</span>
                    <strong>{waCount}</strong>
                  </div>
                  <div>
                    <span>Recommendations</span>
                    <strong>{recCount}</strong>
                  </div>
                </div>
              </article>
              <article className="tc-bottom-card tc-bottom-card--insight">
                <h3>AI insight</h3>
                <p>
                  {timeline[0]?.detail ??
                    'Keep follow-up cadence weekly and convert latest recommendation into order after confirmation.'}
                </p>
              </article>
              <article className="tc-bottom-card">
                <h3>Suggested next action</h3>
                <ul className="tc-action-list">
                  <li>
                    <strong>Call farmer for confirmation</strong>
                    <span>Today</span>
                  </li>
                  <li>
                    <strong>Share recommendation on WhatsApp</strong>
                    <span>Today</span>
                  </li>
                  <li>
                    <strong>Schedule field visit if needed</strong>
                    <span>This week</span>
                  </li>
                </ul>
              </article>
            </section>
          </div>
        ) : null}

        {tab === 'blocks' ? (
          <BlocksTab
            leadId={leadId}
            canWrite={canWrite}
            refreshKey={dataVersion}
            visitContext={
              variant === 'agronomist' && detail?.lead?.farmerId
                ? {
                    farmerId: detail.lead.farmerId,
                    farmerName: detail.lead.farmerName,
                  }
                : undefined
            }
            onAddBlock={() => setModal('block')}
            onOpenFinding={(row) => setSelectedFinding(row)}
            onScheduleVisit={() => setModal('visit')}
            onAddRecommendation={() => setModal('recommendation')}
            onAddFieldFinding={() => setModal('finding')}
          />
        ) : null}

        {tab === 'interactions' ? (
          <InteractionsTab
            leadId={leadId}
            canWrite={canWrite}
            blocks={blocks.map((b) => ({ id: b.id, name: b.name, cropName: b.cropName }))}
            refreshKey={dataVersion}
            onAddInteraction={() => setModal('interaction')}
            onOpenDetail={setSelectedInteraction}
            onArchive={(id) => void archiveResource(`${base}/interactions/${id}`, 'interaction')}
          />
        ) : null}

        {tab === 'agronomist' ? (
          <AgronomistTab
            leadId={leadId}
            canWrite={canWrite}
            refreshKey={dataVersion}
            onScheduleVisit={() => setModal('visit')}
            onAddRecommendation={() => setModal('recommendation')}
            onOpenActivity={(a) => {
              if (a.source === 'field_finding') {
                setSelectedFinding({
                  id: a.id,
                  visitedLabel: a.dateLabel,
                  blockName: a.block,
                });
              } else {
                setSelectedAgActivity(a);
              }
            }}
          />
        ) : null}

        {tab === 'agronomist_tasks' ? (
          <AgronomistTasksTab
            leadId={leadId}
            canWrite={canWrite}
            refreshKey={dataVersion}
            blocks={blocks.map((b) => ({ id: b.id, name: b.name, cropName: b.cropName }))}
          />
        ) : null}

        {tab === 'findings' ? (
          <FieldFindingsTab
            leadId={leadId}
            canWrite={canWrite}
            blocks={blocks.map((b) => ({ id: b.id, name: b.name, cropName: b.cropName }))}
            refreshKey={dataVersion}
            visitContext={
              variant === 'agronomist' && detail?.lead?.farmerId
                ? {
                    farmerId: detail.lead.farmerId,
                    farmerName: detail.lead.farmerName,
                  }
                : undefined
            }
            onAddFinding={() => setModal('finding')}
            onOpenDetail={setSelectedFinding}
            onArchive={(id) => void archiveResource(`${base}/field-findings/${id}`, 'field finding')}
          />
        ) : null}

        {tab === 'pending_tasks' ? (
          <PendingTasksTable
            tasks={pendingTasks}
            canWrite={canWrite}
            empty="No pending work — CRM tasks, interactions, field follow-ups, escalations, or AI approvals will appear here."
            onNavigate={(navTab) => setTab(navTab)}
            onComplete={async (taskId) => {
              try {
                await api(`${base}/tasks/${taskId}/complete`, { method: 'PATCH', body: '{}' });
                bumpData();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not complete task');
              }
            }}
          />
        ) : null}

        {tab === 'team' ? (
          <TelecallerLeadTeamPanel leadId={leadId} canWrite={canWrite} />
        ) : null}

        {tab === 'escalations' ? (
          <>
            <p className="mb-3 text-xs text-ink-muted">
              Cases needing review. Click a row to open details, change status, and add comments for
              the agronomist team.
            </p>
            <Panel bodyClassName="p-0">
              {escalations.length === 0 ? (
                <EmptyState>No escalations for this farmer.</EmptyState>
              ) : (
                <TableWrap>
                  <DataTable>
                    <THead>
                      <tr>
                        <Th>Reason</Th>
                        <Th>Status</Th>
                        <Th>Priority</Th>
                        <Th>When</Th>
                      </tr>
                    </THead>
                    <TBody>
                      {escalations.map((e) => {
                        const workflow = String(
                          e.workflowStatus ?? e.status ?? 'pending'
                        ) as EscalationListRow['workflowStatus'];
                        const row: EscalationListRow = {
                          id: String(e.id),
                          summary: e.summary
                            ? String(e.summary)
                            : String(e.reason ?? '').slice(0, 160),
                          reason: e.reason ? String(e.reason) : undefined,
                          statusLabel: String(e.statusLabel ?? e.status ?? 'Pending'),
                          workflowStatus: workflow,
                          priority: e.priority ? String(e.priority) : undefined,
                          createdLabel: String(e.createdLabel ?? e.created_at ?? '—'),
                        };
                        return (
                          <tr
                            key={row.id}
                            className="cursor-pointer transition hover:bg-brand-50/50"
                            onClick={() => setSelectedEscalation(row)}
                          >
                            <Td className="max-w-md font-medium text-ink">
                              {String(row.summary || row.reason || '—').slice(0, 120)}
                            </Td>
                            <Td>
                              <Badge tone={workflowBadgeTone(workflow)}>{row.statusLabel}</Badge>
                            </Td>
                            <Td className="capitalize">{row.priority ?? '—'}</Td>
                            <Td className="whitespace-nowrap">{row.createdLabel}</Td>
                          </tr>
                        );
                      })}
                    </TBody>
                  </DataTable>
                </TableWrap>
              )}
            </Panel>
          </>
        ) : null}

        {tab === 'notes' ? (
          <>
            <p className="mb-3 text-xs text-ink-muted">
              Internal notes for this farmer. Click a row to read or edit the full note.
            </p>
            {canWrite ? (
              <div className="mb-3">
                <ActionBtn onClick={() => setModal('note')}>+ Add note</ActionBtn>
              </div>
            ) : null}
            <Panel bodyClassName="p-0">
              {notesHistory.length === 0 ? (
                <EmptyState>No notes yet. Use + Add note to create one.</EmptyState>
              ) : (
                <TableWrap>
                  <DataTable>
                    <THead>
                      <tr>
                        <Th>Summary</Th>
                        <Th>By</Th>
                        <Th>When</Th>
                      </tr>
                    </THead>
                    <TBody>
                      {notesHistory.map((n) => {
                        const row: NoteListRow = {
                          id: String(n.id),
                          summary: n.summary ? String(n.summary) : String(n.note ?? '').slice(0, 160),
                          author: String(n.author ?? 'Telecaller'),
                          createdLabel: String(n.createdLabel ?? '—'),
                          canEdit: n.canEdit !== false && !n.isLegacy,
                          isLegacy: Boolean(n.isLegacy),
                        };
                        return (
                          <tr
                            key={row.id}
                            className="cursor-pointer transition hover:bg-brand-50/50"
                            onClick={() => setSelectedNote(row)}
                          >
                            <Td className="max-w-lg">
                              <span className="text-ink">{String(row.summary || '—').slice(0, 120)}</span>
                              {row.isLegacy ? (
                                <span className="ml-2 text-xs text-ink-muted">(historical)</span>
                              ) : null}
                            </Td>
                            <Td>{row.author}</Td>
                            <Td className="whitespace-nowrap">{row.createdLabel}</Td>
                          </tr>
                        );
                      })}
                    </TBody>
                  </DataTable>
                </TableWrap>
              )}
            </Panel>
          </>
        ) : null}

        {tab === 'orders' ? (
          selectedEstimateId ? (
            <EstimateDetailView
              leadId={leadId}
              estimateId={selectedEstimateId}
              canWrite={canWrite}
              onBack={() => setSelectedEstimateId(null)}
              onEdit={(id) => {
                setSelectedEstimateId(null);
                setEditingEstimateId(id);
              }}
            />
          ) : (
            <OrdersTab
              leadId={leadId}
              canWrite={canWrite}
              blocks={blocks.map((b) => ({ id: b.id, name: b.name }))}
              refreshKey={dataVersion}
              onCreateEstimate={() => setShowCreateEstimate(true)}
              onEditEstimate={(id) => setEditingEstimateId(id)}
              onOpenEstimate={setSelectedEstimateId}
              onOpenDetail={setSelectedOrder}
            />
          )
        ) : null}

        {tab === 'roi_tracker' ? <RoiTrackerTab leadId={leadId} canWrite={canWrite} /> : null}

        {tab === 'field_activity' && detail ? (
          <FieldActivitiesTab
            leadId={leadId}
            farmerName={detail.lead.farmerName}
            canWrite={canWrite}
          />
        ) : null}

        {tab === 'whatsapp' ? (
          <div className="tc-wa-layout">
            <div className="tc-wa-thread">
              <div className="tc-wa-messages">
                {messages.map((m) => {
                  const outbound = m.direction === 'outbound';
                  const raw = String(m.content ?? '').trim();
                  const isMedia =
                    !raw ||
                    /^(image|photo|audio|voice|document|video|sticker)$/i.test(raw) ||
                    raw.length < 3;
                  return (
                    <div
                      key={String(m.id)}
                      className={`tc-wa-bubble ${outbound ? 'tc-wa-bubble--out' : 'tc-wa-bubble--in'} ${
                        isMedia ? 'tc-wa-bubble--media' : ''
                      }`}
                    >
                      {isMedia ? (
                        <span>{raw ? `📎 ${raw}` : '📷 Media message'}</span>
                      ) : (
                        raw
                      )}
                      {m.created_at ? (
                        <time dateTime={String(m.created_at)}>
                          {new Date(String(m.created_at)).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      ) : null}
                    </div>
                  );
                })}
                {messages.length === 0 ? (
                  <p className="text-center text-sm text-ink-muted" style={{ padding: 24 }}>
                    No WhatsApp messages in log yet.
                  </p>
                ) : null}
              </div>
              {canWrite ? (
                <form onSubmit={sendWhatsApp} className="tc-wa-composer">
                  <input
                    value={waText}
                    onChange={(e) => setWaText(e.target.value)}
                    placeholder="Type a message…"
                    aria-label="WhatsApp message"
                  />
                  <button type="submit">Send</button>
                </form>
              ) : null}
            </div>
            <aside className="tc-wa-session">
              <h3>Session</h3>
              <label className="block text-xs text-ink-secondary">
                Owner
                <StaticSelect
                  className="tc-stage-select mt-1.5 w-full"
                  disabled={!canWrite}
                  value={String(session?.conversation_owner ?? 'ai')}
                  onChange={(value) => patchSession({ owner: value })}
                  options={['ai', 'telecaller', 'agronomist'].map((o) => ({ value: o, label: o }))}
                />
              </label>
              <label
                className="flex items-center gap-2 text-xs"
                style={{ marginTop: 14, cursor: canWrite ? 'pointer' : 'default' }}
              >
                <input
                  type="checkbox"
                  disabled={!canWrite}
                  checked={Boolean(session?.ai_paused)}
                  onChange={(e) => patchSession({ aiPaused: e.target.checked })}
                />
                Pause AI replies
              </label>
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ActionBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <Btn size="sm" variant="secondary" onClick={onClick}>
      {children}
    </Btn>
  );
}

function workflowBadgeTone(
  workflow: EscalationListRow['workflowStatus']
): 'success' | 'warn' | 'neutral' {
  if (workflow === 'completed') return 'success';
  if (workflow === 'agronomist_review') return 'warn';
  return 'neutral';
}

function categoryBadgeClass(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('partner')) return 'bg-teal-100 text-teal-900';
  if (c.includes('escalation')) return 'bg-red-100 text-red-800';
  if (c.includes('ai')) return 'bg-violet-100 text-violet-800';
  if (c.includes('field')) return 'bg-emerald-100 text-emerald-800';
  if (c.includes('interaction')) return 'bg-blue-100 text-blue-800';
  return 'bg-orange-100 text-orange-800';
}

function PendingTasksTable({
  tasks,
  canWrite,
  empty,
  onNavigate,
  onComplete,
}: {
  tasks: Array<Record<string, unknown>>;
  canWrite: boolean;
  empty: string;
  onNavigate: (tab: Tab) => void;
  onComplete: (taskId: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <Panel bodyClassName="p-0">
        <EmptyState>{empty}</EmptyState>
      </Panel>
    );
  }

  return (
    <Panel
      bodyClassName="p-0"
      description={`${tasks.length} pending item${tasks.length === 1 ? '' : 's'} — tasks, interactions, field follow-ups, escalations, AI approvals`}
    >
      <TableWrap>
        <DataTable>
          <THead>
            <tr>
              <Th>Category</Th>
              <Th>Task</Th>
              <Th>Due</Th>
              <Th>Farmer</Th>
              <Th>Status</Th>
              {canWrite ? <Th className="w-24" /> : null}
            </tr>
          </THead>
          <TBody>
            {tasks.map((t) => {
              const id = String(t.id);
              const isDueToday = Boolean(t.isDueToday);
              const category = String(t.category ?? 'Pending');
              const navigateTab = t.navigateTab as Tab | null | undefined;
              const canComplete = Boolean(t.canComplete && t.taskId);
              const taskId = t.taskId ? String(t.taskId) : null;
              return (
                <tr
                  key={id}
                  className={`${isDueToday ? 'bg-amber-50/80' : ''} ${
                    navigateTab ? 'cursor-pointer hover:bg-brand-50/50' : ''
                  }`}
                  onClick={() => {
                    if (navigateTab) onNavigate(navigateTab);
                  }}
                >
                  <Td>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${categoryBadgeClass(category)}`}
                    >
                      {category}
                    </span>
                  </Td>
                  <Td>
                    <strong className="block text-ink">{String(t.title ?? '—')}</strong>
                    {t.subtitle ? (
                      <span className="text-xs text-ink-muted">{String(t.subtitle)}</span>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {String(t.dueLabel ?? t.dueAt ?? '—')}
                    {isDueToday ? (
                      <span className="ml-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        Today
                      </span>
                    ) : null}
                  </Td>
                  <Td>{String(t.farmerName ?? '—')}</Td>
                  <Td>
                    <Badge tone="neutral">{String(t.statusLabel ?? t.status ?? 'pending')}</Badge>
                  </Td>
                  {canWrite ? (
                    <Td onClick={(e) => e.stopPropagation()}>
                      {canComplete && taskId ? (
                        <Btn
                          size="sm"
                          variant="secondary"
                          className="border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100"
                          onClick={() => onComplete(taskId)}
                        >
                          Done
                        </Btn>
                      ) : (
                        <span className="text-xs text-ink-muted">Open tab →</span>
                      )}
                    </Td>
                  ) : null}
                </tr>
              );
            })}
          </TBody>
        </DataTable>
      </TableWrap>
    </Panel>
  );
}

