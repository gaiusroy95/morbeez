import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { paths, toPath } from '../lib/routes';
import { LeadDetailPanel } from '../components/telecaller/LeadDetailPanel';
import { AgronomistTaskDetailModal, type AgronomistTaskRow } from '../components/agronomist/AgronomistTaskDetailModal';
import { Alert, Btn, HubTabs, Loading, ReadOnlyBanner, StatCard } from '../components/ui';
import '../styles/agronomist-ops.css';

const agroBase = '/morbeez-staff/api/v1/os/agronomist';
const telBase = '/morbeez-staff/api/v1/os/telecaller';

type OpsTab = 'dashboard' | 'tasks' | 'visits' | 'farmers';

type DashboardData = {
  todaysVisits: number;
  pendingFollowUps: number;
  openEscalations: number;
  pendingCallbacks: number;
  findingReviewQueue: number;
  aiReviewCases: number;
};

type FarmerRow = {
  id: string;
  name: string;
  phone: string | null;
  district: string | null;
  primaryCrop: string | null;
  openTaskCount: number;
  lastVisitAt: string | null;
  leadId?: string | null;
};

type VisitRow = {
  id: string;
  title: string;
  dueLabel: string;
  farmerName: string;
  blockName: string | null;
  cropName: string | null;
  location: string | null;
  leadId: string | null;
};

export function AgronomistOperationsPage({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<OpsTab>('dashboard');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [tasks, setTasks] = useState<AgronomistTaskRow[]>([]);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [farmers, setFarmers] = useState<FarmerRow[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const bump = () => setRefreshKey((k) => k + 1);

  const loadDashboard = useCallback(async () => {
    const data = await api<{ ok: boolean; dashboard: DashboardData }>(`${agroBase}/mobile/dashboard`);
    setDashboard(data.dashboard);
  }, []);

  const loadTasks = useCallback(async () => {
    const data = await api<{ ok: boolean; tasks: AgronomistTaskRow[] }>(`${agroBase}/operations/tasks?status=pending`);
    setTasks(data.tasks ?? []);
  }, []);

  const loadVisits = useCallback(async () => {
    const data = await api<{ ok: boolean; visits: VisitRow[] }>(`${agroBase}/operations/visits`);
    setVisits(data.visits ?? []);
  }, []);

  const loadFarmers = useCallback(async () => {
    const data = await api<{ ok: boolean; farmers: Omit<FarmerRow, 'leadId'>[] }>(
      `${agroBase}/mobile/farmers?filter=assigned&limit=60`
    );
    const rows = await Promise.all(
      (data.farmers ?? []).map(async (f) => {
        try {
          const summary = await api<{ ok: boolean; summary: { leadId: string | null } }>(
            `${agroBase}/farmers/${f.id}/workspace-summary`
          );
          return { ...f, leadId: summary.summary?.leadId ?? null };
        } catch {
          return { ...f, leadId: null };
        }
      })
    );
    setFarmers(rows);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadDashboard(), loadTasks(), loadVisits(), loadFarmers()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agronomist workspace');
    } finally {
      setLoading(false);
    }
  }, [loadDashboard, loadTasks, loadVisits, loadFarmers]);

  useEffect(() => {
    void loadAll();
  }, [loadAll, refreshKey]);

  const openTasks = useMemo(() => tasks.filter((t) => t.status === 'pending'), [tasks]);

  if (loading && !dashboard) return <Loading label="Loading agronomist operations…" />;

  return (
    <div className="agro-ops-page">
      {!canWrite ? <ReadOnlyBanner moduleLabel="Agronomist operations" /> : null}
      {error ? <Alert>{error}</Alert> : null}

      <div className="agro-ops-head">
        <div>
          <h1 className="page-title">Agronomist Operations</h1>
          <p className="page-subtitle">
            Farmer support, tasks, visits, and field cases — separate from{' '}
            <Link to={toPath(paths.agronomistAiReview)}>AI Review Center</Link>.
          </p>
        </div>
        <Btn label="Refresh" variant="secondary" onClick={bump} />
      </div>

      <HubTabs
        tabs={[
          { id: 'dashboard' as const, label: 'Dashboard' },
          { id: 'tasks' as const, label: `My tasks (${openTasks.length})` },
          { id: 'visits' as const, label: `Scheduled visits (${visits.length})` },
          { id: 'farmers' as const, label: 'Farmers' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'dashboard' ? (
        <div className="agro-ops-dashboard">
          <div className="agro-ops-stats">
            <StatCard label="Open tasks" value={String(openTasks.length)} />
            <StatCard label="Visits scheduled" value={String(visits.length)} />
            <StatCard label="Today's visits" value={String(dashboard?.todaysVisits ?? 0)} />
            <StatCard label="Follow-ups due" value={String(dashboard?.pendingFollowUps ?? 0)} />
            <StatCard label="Open escalations" value={String(dashboard?.openEscalations ?? 0)} />
            <StatCard label="Callbacks" value={String(dashboard?.pendingCallbacks ?? 0)} />
          </div>

          <div className="agro-ops-split">
            <section className="agro-ops-panel">
              <h3>Upcoming visits</h3>
              <ul className="agro-ops-list">
                {visits.slice(0, 5).map((v) => (
                  <li key={v.id}>
                    <button type="button" className="agro-ops-list-btn" onClick={() => setSelectedTaskId(v.id)}>
                      <strong>{v.dueLabel}</strong> — {v.farmerName}
                      {v.blockName ? ` · ${v.blockName}` : ''}
                    </button>
                  </li>
                ))}
                {visits.length === 0 ? <li className="muted">No scheduled visits.</li> : null}
              </ul>
            </section>
            <section className="agro-ops-panel">
              <h3>Priority tasks</h3>
              <ul className="agro-ops-list">
                {openTasks.slice(0, 5).map((t) => (
                  <li key={t.id}>
                    <button type="button" className="agro-ops-list-btn" onClick={() => setSelectedTaskId(t.id)}>
                      <span className="capitalize">{t.priority ?? 'medium'}</span> — {t.title}
                      {t.farmerName ? ` (${t.farmerName})` : ''}
                    </button>
                  </li>
                ))}
                {openTasks.length === 0 ? <li className="muted">No open tasks.</li> : null}
              </ul>
            </section>
          </div>
        </div>
      ) : null}

      {tab === 'tasks' ? (
        <div className="agro-ops-table-wrap">
          <table className="agro-ops-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Farmer</th>
                <th>Block / crop</th>
                <th>Issue</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id} className="clickable" onClick={() => setSelectedTaskId(t.id)}>
                  <td className="capitalize">{t.priority ?? 'medium'}</td>
                  <td>{t.farmerName ?? '—'}</td>
                  <td>{[t.blockName, t.cropName].filter(Boolean).join(' / ') || '—'}</td>
                  <td>{t.issue ?? t.title}</td>
                  <td>{t.dueLabel ?? '—'}</td>
                  <td className="capitalize">{t.status ?? 'pending'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tasks.length === 0 ? <p className="muted p-4">No tasks assigned to you.</p> : null}
        </div>
      ) : null}

      {tab === 'visits' ? (
        <div className="agro-ops-table-wrap">
          <table className="agro-ops-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Farmer</th>
                <th>Block</th>
                <th>Location</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id}>
                  <td>{v.dueLabel}</td>
                  <td>{v.farmerName}</td>
                  <td>{v.blockName ? `${v.blockName}${v.cropName ? ` (${v.cropName})` : ''}` : '—'}</td>
                  <td>{v.location ?? '—'}</td>
                  <td>
                    <button type="button" className="link-btn" onClick={() => setSelectedTaskId(v.id)}>
                      Open
                    </button>
                    {v.leadId ? (
                      <>
                        {' · '}
                        <button type="button" className="link-btn" onClick={() => setSelectedLeadId(v.leadId)}>
                          Farmer workspace
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visits.length === 0 ? <p className="muted p-4">No scheduled field visits.</p> : null}
        </div>
      ) : null}

      {tab === 'farmers' ? (
        selectedLeadId ? (
          <div className="agro-ops-farmer-workspace">
            <button type="button" className="link-btn mb-3" onClick={() => setSelectedLeadId(null)}>
              ← Back to farmer list
            </button>
            <LeadDetailPanel leadId={selectedLeadId} canWrite={canWrite} variant="agronomist" />
          </div>
        ) : (
          <div className="agro-ops-table-wrap">
            <table className="agro-ops-table">
              <thead>
                <tr>
                  <th>Farmer</th>
                  <th>Location</th>
                  <th>Crop</th>
                  <th>Open tasks</th>
                  <th>Last visit</th>
                </tr>
              </thead>
              <tbody>
                {farmers.map((f) => (
                  <tr
                    key={f.id}
                    className={f.leadId ? 'clickable' : ''}
                    onClick={() => f.leadId && setSelectedLeadId(f.leadId)}
                  >
                    <td>{f.name}{f.phone ? ` · ${f.phone}` : ''}</td>
                    <td>{f.district ?? '—'}</td>
                    <td>{f.primaryCrop ?? '—'}</td>
                    <td>{f.openTaskCount}</td>
                    <td>{f.lastVisitAt ? new Date(f.lastVisitAt).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {farmers.length === 0 ? <p className="muted p-4">No assigned farmers yet.</p> : null}
          </div>
        )
      ) : null}

      {selectedTaskId ? (
        <AgronomistTaskDetailModal
          taskId={selectedTaskId}
          apiBase="agronomist"
          canWrite={canWrite}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={bump}
        />
      ) : null}
    </div>
  );
}
