import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../../lib/api';
import { CrmModals, type CrmModalType } from './CrmModals';
import { BlocksTab } from './BlocksTab';
import { EditFarmerModal } from './EditFarmerModal';
import { LeadExportMenu } from './LeadExportMenu';
import { RoiTrackerTab } from './RoiTrackerTab';
import { openWhatsAppShare } from '../../lib/crmExport';
import { FarmerIntelligencePanel } from '../intelligence/FarmerIntelligencePanel';
import {
  InteractionDetailModal,
  type InteractionListRow,
} from './InteractionDetailModal';
import { NoteDetailModal, type NoteListRow } from './NoteDetailModal';
import { EscalationDetailModal, type EscalationListRow } from './EscalationDetailModal';
import { InteractionsTab } from './InteractionsTab';
import { OrdersTab } from './OrdersTab';
import { OrderDetailModal, type OrderListRow } from './OrderDetailModal';
import { FieldFindingsTab } from './FieldFindingsTab';
import { FieldFindingDetailModal, type FieldFindingListRow } from './FieldFindingDetailModal';
import { AgronomistTab, type AgronomistActivityRow } from './AgronomistTab';
import { AgronomistActivityModal } from './AgronomistActivityModal';
import { Modal } from '../Modal';

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
  | 'pending_tasks'
  | 'escalations'
  | 'notes'
  | 'orders'
  | 'roi_tracker';

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
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'interactions', label: 'Interactions' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'findings', label: 'Field findings' },
  { id: 'agronomist', label: 'Agronomist' },
  { id: 'pending_tasks', label: 'Pending Tasks' },
  { id: 'escalations', label: 'Escalations' },
  { id: 'notes', label: 'Notes' },
  { id: 'orders', label: 'Orders' },
  { id: 'roi_tracker', label: 'ROI tracker' },
];

const TAB_ICONS: Record<Tab, string> = {
  overview: '◉',
  interactions: '☎',
  whatsapp: '🟢',
  blocks: '▦',
  findings: '🧪',
  agronomist: '🧑‍🌾',
  pending_tasks: '⏰',
  escalations: '⚠',
  notes: '📝',
  orders: '🛒',
  roi_tracker: '📒',
};

export function LeadDetailPanel({ leadId, canWrite }: Props) {
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
  const [selectedInteraction, setSelectedInteraction] = useState<InteractionListRow | null>(
    null
  );
  const [selectedNote, setSelectedNote] = useState<NoteListRow | null>(null);
  const [selectedEscalation, setSelectedEscalation] = useState<EscalationListRow | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderListRow | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<FieldFindingListRow | null>(null);
  const [selectedAgActivity, setSelectedAgActivity] = useState<AgronomistActivityRow | null>(null);
  const [archiveModal, setArchiveModal] = useState<{ path: string; label: string } | null>(null);

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
      await loadBlocks();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lead');
    } finally {
      setLoading(false);
    }
  }, [leadId, loadBlocks]);

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
    return <p className="tc-muted" style={{ padding: 24 }}>Loading farmer…</p>;
  }

  if (!detail) {
    return <p className="text-sm text-red-600" style={{ padding: 24 }}>{error || 'Lead not found'}</p>;
  }

  const l = detail.lead;
  const f = detail.farmer;
  const timeline = Array.isArray(detail.timeline) ? detail.timeline : [];
  const recentOrders = Array.isArray(detail.orders) ? detail.orders : [];
  const overviewBlocks = Array.isArray(detail.farmOverview?.blocks) ? detail.farmOverview.blocks : [];

  return (
    <div className="tc-detail-root">
      <header className="tc-detail-header">
        <div className="tc-detail-identity-row">
          <span className="tc-avatar-lg">{l.farmerInitials}</span>
          <div className="min-w-0 flex-1">
            <div className="tc-detail-topline">
              <h2>{l.farmerName}</h2>
              <span className="tc-customer-chip">Customer</span>
              <div className="tc-header-quick-actions">
                <a
                  className="tc-icon-btn"
                  aria-label="WhatsApp"
                  href={l.phone ? `https://wa.me/${String(l.phone).replace(/\D/g, '')}` : undefined}
                  target="_blank"
                  rel="noreferrer"
                >
                  🟢
                </a>
                <a
                  className="tc-icon-btn"
                  aria-label="Call"
                  href={l.phone ? `tel:${String(l.phone).replace(/\s+/g, '')}` : undefined}
                >
                  📞
                </a>
                <div className="tc-header-menu-wrap">
                  <button
                    type="button"
                    className="tc-note-btn"
                    aria-label="Actions"
                    aria-expanded={headerMenuOpen}
                    onClick={() => setHeaderMenuOpen((v) => !v)}
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
              </div>
              <a
                className="tc-call-btn"
                href={l.phone ? `tel:${String(l.phone).replace(/\s+/g, '')}` : undefined}
              >
                📞 Call
              </a>
              <button type="button" className="tc-note-btn" onClick={() => canWrite && setModal('task')}>
                ⊕ Add Note
              </button>
              <LeadExportMenu leadId={leadId} canShare={Boolean(l.phone)} />
            </div>
            <p className="tc-detail-subline">
              <strong>{l.phone ?? '—'}</strong> <span className="mx-2">•</span> {f.territory}{' '}
              {l.pincode ? (
                <>
                  <span className="mx-2">•</span> Pincode: {l.pincode}
                </>
              ) : null}
            </p>
            {canWrite ? (
              <select
                className="tc-stage-select"
                value={l.stage}
                onChange={(e) => changeStage(e.target.value)}
                aria-label="Lead stage"
              >
                {STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className={`tc-stage ${STAGE_CLASS[l.stage] ?? 'stage-new'}`}>{l.stageLabel}</span>
            )}
          </div>
        </div>
        <nav className="tc-detail-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`tc-detail-tab ${tab === t.id ? 'active' : ''}`}
            >
              <span className="tc-tab-icon">{TAB_ICONS[t.id]}</span>
              {t.label}
            </button>
          ))}
        </nav>
        {canWrite ? (
          <div className="tc-detail-actions">
            <button type="button" className="tc-action-btn" onClick={() => setModal('call')}>
              Log call
            </button>
            <button type="button" className="tc-action-btn" onClick={() => setModal('task')}>
              Follow-up
            </button>
            <button type="button" className="tc-action-btn" onClick={() => setModal('visit')}>
              Schedule visit
            </button>
            <button type="button" className="tc-action-btn" onClick={() => setModal('order')}>
              New order
            </button>
          </div>
        ) : null}
      </header>

      {error ? <p className="text-sm text-red-600" style={{ padding: '12px 20px 0' }}>{error}</p> : null}

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
          <p className="text-sm text-slate-700">Do you want to archive this {archiveModal.label}?</p>
        </Modal>
      ) : null}

      <div className="tc-detail-body">
        {tab === 'overview' ? (
          <div className="tc-farmer-dashboard">
            <section className="tc-profile-summary">
              <article className="tc-profile-metric">
                <span>Total acres</span>
                <strong>{f.acreage || '—'}</strong>
              </article>
              <article className="tc-profile-metric">
                <span>Primary crop</span>
                <strong>{f.crop || '—'}</strong>
              </article>
              <FarmerIntelligencePanel leadId={leadId} fallbackLeadScore={Number(l.leadScore)} />
              <article className="tc-profile-metric">
                <span>Customer since</span>
                <strong>{timeline.length ? timeline[timeline.length - 1]?.atLabel ?? '—' : '—'}</strong>
              </article>
              <article className="tc-profile-metric">
                <span>Next follow-up</span>
                <strong>
                  {detail.nextFollowUp?.dueLabel ?? 'None'}
                  <em className="tc-badge-due">In 1 day</em>
                </strong>
              </article>
            </section>

            <section className="tc-dashboard-main-grid">
              <article className="tc-dashboard-card">
                <h3>Farmer overview</h3>
                <dl>
                  <Row label="Full Name" value={l.farmerName} />
                  <Row label="Territory" value={f.territory || '—'} />
                  <Row label="Pincode" value={f.pincode ?? l.pincode ?? '—'} />
                  <Row label="Language" value={f.language || '—'} />
                  <Row label="Phone" value={l.phone ?? '—'} />
                  <Row label="Irrigation" value={f.irrigation || '—'} />
                  <Row label="Soil" value={f.soilType || '—'} />
                </dl>
              </article>

              <article className="tc-dashboard-card">
                <h3>Recent orders</h3>
                <ul className="tc-compact-list">
                  {recentOrders.slice(0, 3).map((o, idx) => (
                    <li key={`${o.label}-${o.date}-${idx}`}>
                      <strong>{o.label || `Order ${idx + 1}`}</strong>
                      <span>₹{Number(o.amount ?? 0)}</span>
                    </li>
                  ))}
                  {recentOrders.length === 0 ? <li className="tc-empty-row">No recent orders</li> : null}
                </ul>
              </article>

              <article className="tc-dashboard-card">
                <h3>Upcoming follow-ups</h3>
                {detail.nextFollowUp ? (
                  <div className="tc-followup-block">
                    <p className="tc-followup-title">{detail.nextFollowUp.title}</p>
                    <p className="tc-followup-time">{detail.nextFollowUp.dueLabel}</p>
                  </div>
                ) : (
                  <p className="tc-empty-row">No follow-up scheduled</p>
                )}
                {canWrite ? (
                  <form onSubmit={addNote} className="mt-3 border-t border-slate-100 pt-3">
                    <label className="text-xs text-slate-600">Internal note</label>
                    <textarea
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                      rows={2}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Call summary, farmer concern…"
                    />
                    <button
                      type="submit"
                      className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Save note
                    </button>
                  </form>
                ) : null}
              </article>
            </section>

            <section className="tc-dashboard-card tc-blocks-summary">
              <div className="tc-card-head">
                <h3>Blocks summary</h3>
                <button type="button" className="tc-inline-link" onClick={() => setTab('blocks')}>
                  View all blocks
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Block</th>
                      <th className="px-3 py-2">Crop</th>
                      <th className="px-3 py-2">Area</th>
                      <th className="px-3 py-2">Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewBlocks.map((b) => (
                      <tr key={b.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">{b.name}</td>
                        <td className="px-3 py-2">{b.cropType || '—'}</td>
                        <td className="px-3 py-2">{String(b.acreage ?? '—')}</td>
                        <td className="px-3 py-2">{b.isPrimary ? 'Primary' : 'Secondary'}</td>
                      </tr>
                    ))}
                    {overviewBlocks.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-slate-500" colSpan={4}>
                          No blocks found
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="tc-dashboard-footer-grid">
              <article className="tc-dashboard-card">
                <h3>Interaction summary</h3>
                <div className="tc-mini-kpis">
                  <div>
                    <span>Calls</span>
                    <strong>{timeline.filter((x) => String(x.type).toLowerCase().includes('call')).length}</strong>
                  </div>
                  <div>
                    <span>WhatsApp</span>
                    <strong>{timeline.filter((x) => String(x.type).toLowerCase().includes('whatsapp')).length}</strong>
                  </div>
                  <div>
                    <span>Recommendations</span>
                    <strong>{timeline.filter((x) => String(x.type).toLowerCase().includes('recommend')).length}</strong>
                  </div>
                </div>
              </article>
              <article className="tc-dashboard-card">
                <h3>AI insight</h3>
                <p className="text-sm text-slate-600">
                  {timeline[0]?.detail ??
                    'Keep follow-up cadence weekly and convert latest recommendation into order after confirmation.'}
                </p>
              </article>
              <article className="tc-dashboard-card">
                <h3>Suggested next action</h3>
                <ul className="tc-compact-list">
                  <li><strong>Call farmer for confirmation</strong><span>Today</span></li>
                  <li><strong>Share recommendation on WhatsApp</strong><span>Today</span></li>
                  <li><strong>Schedule field visit if needed</strong><span>This week</span></li>
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

        {tab === 'findings' ? (
          <FieldFindingsTab
            leadId={leadId}
            canWrite={canWrite}
            blocks={blocks.map((b) => ({ id: b.id, name: b.name, cropName: b.cropName }))}
            refreshKey={dataVersion}
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

        {tab === 'escalations' ? (
          <>
            <p className="mb-3 text-xs text-slate-500">
              Cases needing review. Click a row to open details, change status, and add comments for
              the agronomist team.
            </p>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody>
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
                    const badgeClass =
                      workflow === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : workflow === 'agronomist_review'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-100 text-slate-800';
                    return (
                      <tr
                        key={row.id}
                        className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-emerald-50/60"
                        onClick={() => setSelectedEscalation(row)}
                      >
                        <td className="px-4 py-3 max-w-md">
                          {String(row.summary || row.reason || '—').slice(0, 120)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                          >
                            {row.statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 capitalize text-slate-600">
                          {row.priority ?? '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                          {row.createdLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {escalations.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">
                  No escalations for this farmer.
                </p>
              ) : null}
            </div>
          </>
        ) : null}

        {tab === 'notes' ? (
          <>
            <p className="mb-3 text-xs text-slate-500">
              Internal notes for this farmer. Click a row to read or edit the full note.
            </p>
            {canWrite ? (
              <div className="mb-3">
                <ActionBtn onClick={() => setModal('note')}>+ Add note</ActionBtn>
              </div>
            ) : null}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Summary</th>
                    <th className="px-4 py-3">By</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody>
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
                        className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-emerald-50/60"
                        onClick={() => setSelectedNote(row)}
                      >
                        <td className="px-4 py-3 max-w-lg">
                          <span className="text-slate-800">
                            {String(row.summary || '—').slice(0, 120)}
                          </span>
                          {row.isLegacy ? (
                            <span className="ml-2 text-xs text-slate-400">(historical)</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{row.author}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                          {row.createdLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {notesHistory.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">
                  No notes yet. Use + Add note to create one.
                </p>
              ) : null}
            </div>
          </>
        ) : null}

        {tab === 'orders' ? (
          <OrdersTab
            leadId={leadId}
            canWrite={canWrite}
            blocks={blocks.map((b) => ({ id: b.id, name: b.name }))}
            refreshKey={dataVersion}
            onNewOrder={() => setModal('order')}
            onOpenDetail={setSelectedOrder}
          />
        ) : null}

        {tab === 'roi_tracker' ? <RoiTrackerTab leadId={leadId} canWrite={canWrite} /> : null}

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
                  <p className="tc-muted" style={{ textAlign: 'center', padding: 24 }}>
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
              <label className="block text-xs text-slate-600">
                Owner
                <select
                  className="tc-stage-select"
                  style={{ width: '100%', marginTop: 6 }}
                  disabled={!canWrite}
                  value={String(session?.conversation_owner ?? 'ai')}
                  onChange={(e) => patchSession({ owner: e.target.value })}
                >
                  {['ai', 'telecaller', 'agronomist'].map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
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
    <button type="button" className="tc-action-btn" onClick={onClick}>
      {children}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function categoryBadgeClass(category: string): string {
  const c = category.toLowerCase();
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
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <p className="px-4 py-6 text-center text-sm text-slate-500">{empty}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
        {tasks.length} pending item{tasks.length === 1 ? '' : 's'} — tasks, interactions, field
        follow-ups, escalations, AI approvals
      </p>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Task</th>
            <th className="px-4 py-3">Due</th>
            <th className="px-4 py-3">Farmer</th>
            <th className="px-4 py-3">Status</th>
            {canWrite ? <th className="px-4 py-3 w-24" /> : null}
          </tr>
        </thead>
        <tbody>
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
                className={`border-t border-slate-100 ${isDueToday ? 'bg-amber-50/80' : ''} ${
                  navigateTab ? 'cursor-pointer hover:bg-emerald-50/60' : ''
                }`}
                onClick={() => {
                  if (navigateTab) onNavigate(navigateTab);
                }}
              >
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${categoryBadgeClass(category)}`}
                  >
                    {category}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <strong className="block text-slate-900">{String(t.title ?? '—')}</strong>
                  {t.subtitle ? (
                    <span className="text-xs text-slate-500">{String(t.subtitle)}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                  {String(t.dueLabel ?? t.dueAt ?? '—')}
                  {isDueToday ? (
                    <span className="ml-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      Today
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">{String(t.farmerName ?? '—')}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {String(t.statusLabel ?? t.status ?? 'pending')}
                  </span>
                </td>
                {canWrite ? (
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {canComplete && taskId ? (
                      <button
                        type="button"
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                        onClick={() => onComplete(taskId)}
                      >
                        Done
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Open tab →</span>
                    )}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

