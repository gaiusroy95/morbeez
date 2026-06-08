import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSyncConsoleSearchMode } from '../hooks/useSyncConsoleSearch';
import { api } from '../lib/api';
import { assignableRolesForActor } from '../lib/role-home';
import { defaultsForPage } from '../lib/console-page-search';
import { paths, toPath } from '../lib/routes';
import { formatInrFull, initials, roleLabel } from '../lib/format';
import { Field, Modal, inputClass } from '../components/Modal';
import {
  Alert,
  Badge,
  Btn,
  DataTable,
  EmptyState,
  FilterBar,
  Input,
  Loading,
  Panel,
  StaticSelect,
  Select,
  TableWrap,
} from '../components/ui';
import { StatIcon } from '../components/NavIcon';
import { EmployeePricingDashboard } from '../components/employees/EmployeePricingDashboard';
import { BulkMarginReviewPanel } from '../components/employees/BulkMarginReviewPanel';

type Employee = {
  id: string;
  hasProfile?: boolean;
  email: string;
  fullName: string;
  role: string;
  active: boolean;
  lastLoginAt?: string | null;
  employeeCode: string;
  totalLeads: number;
  pendingTasks: number;
  pendingFollowUpsToday: number;
  turnoverInr: number;
  performanceScore: number;
  performanceLabel: string;
  performanceSource?: 'engine' | 'estimated';
  attributedFarmerCount?: number;
  leaderboardEligible?: boolean;
  statusOnline: boolean;
  agronomistTier?: 'new' | 'experienced' | null;
  lateLoginDays?: number | null;
  isLateLogin?: boolean;
  interactionsToday?: number;
  interactionsThisMonth?: number;
  estimatedIncentiveInr?: number;
  roiPct?: number;
  personalMobile?: string;
  companyWhatsapp?: string;
};

type Workspace = {
  summary: {
    totalEmployees: number;
    activeCount: number;
    inactiveCount: number;
    avgPerformanceScore: number;
    avgTurnoverInr: number;
    pendingTasks: number;
    interactionsToday?: number;
    avgRoiPct?: number;
  };
  secondary: {
    onlineNow: number;
    lateLogin: number;
    lowTurnover: number;
    totalLeads: number;
    interactionsToday?: number;
  };
  employees: Employee[];
};

type DetailOverview = {
  pendingTasks: number;
  pendingFollowUps: number;
  newLeadsToday: number;
  interactionsToday: number;
  interactionsThisMonth: number;
  onlineStatus: string;
  lastLoginAt: string | null;
  lateLoginDays: number | null;
  isLateLogin: boolean;
  estimatedIncentiveInr: number;
  roiPct: number;
  avgPerformanceScore: number;
  attributedFarmerCount: number;
  leaderboardEligible: boolean;
  performanceSource: 'engine' | 'estimated';
};

type Detail = {
  employee: Employee;
  overview: DetailOverview;
  turnoverTrend: { labels: string[]; values: number[] };
  performanceBreakdown: Array<{ label: string; pct: number }>;
  performanceFactors?: Array<{ code?: string; label: string; delta?: number }>;
  recentLeads: Array<{ id: string; name: string; crop: string; when: string }>;
  recentTasks: Array<{ id: string; title: string; status: string; dueAt: string | null }>;
};

function perfClass(label: string): string {
  if (label === 'Excellent') return 'perf-excellent';
  if (label === 'Very Good') return 'perf-verygood';
  if (label === 'Good') return 'perf-good';
  if (label === 'Average') return 'perf-average';
  return 'perf-low';
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ProgressRing({ pct, label, display }: { pct: number; label: string; display: string }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="emp-ring">
      <svg viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e5ebe7" strokeWidth="8" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="#34b35e"
          strokeWidth="8"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 44 44)"
        />
        <text x="44" y="48" textAnchor="middle" className="emp-ring-value">
          {display}
        </text>
      </svg>
      <div className="emp-ring-label">{label}</div>
    </div>
  );
}

export function EmployeesPage({ canWrite = false }: { canWrite?: boolean }) {
  const { employeeId } = useParams<{ employeeId?: string }>();
  const navigate = useNavigate();
  const { admin } = useAuth();
  const assignableRoles = assignableRolesForActor(admin?.role);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [listTab, setListTab] = useState<'active' | 'inactive'>('active');
  const [detailTab, setDetailTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const employeeSearchDefaults = defaultsForPage('employees');
  useSyncConsoleSearchMode(
    employeeId ? 'none' : 'local',
    search,
    setSearch,
    employeeSearchDefaults.placeholder ?? 'Search employees…'
  );
  const [loading, setLoading] = useState(!employeeId);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showHeavyPanels, setShowHeavyPanels] = useState(false);
  const [error, setError] = useState('');
  const [showNewEmployee, setShowNewEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deactivatingEmployee, setDeactivatingEmployee] = useState<Employee | null>(null);
  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [deactivateSaving, setDeactivateSaving] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');
  const [confirmActionModal, setConfirmActionModal] = useState<{
    title: string;
    body: string;
    action: () => Promise<void>;
  } | null>(null);
  const [infoModal, setInfoModal] = useState<{ title: string; message: string } | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await api<{ ok: boolean } & Workspace>('/morbeez-staff/api/v1/staff/workspace');
      setWorkspace(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setError('');
    try {
      const d = await api<{ ok: boolean } & Detail>(`/morbeez-staff/api/v1/staff/${id}`);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load employee');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (employeeId) return;
    void loadWorkspace();
  }, [employeeId, loadWorkspace]);

  useEffect(() => {
    if (!employeeId) {
      setDetail(null);
      return;
    }
    void loadDetail(employeeId);
  }, [employeeId, loadDetail]);

  useEffect(() => {
    if (employeeId || !workspace) {
      setShowHeavyPanels(false);
      return;
    }
    const timer = window.setTimeout(() => setShowHeavyPanels(true), 120);
    return () => window.clearTimeout(timer);
  }, [employeeId, workspace]);

  async function createEmployee(input: {
    fullName: string;
    email: string;
    role: string;
    status: 'active' | 'inactive';
    personalMobile?: string;
    companyWhatsapp?: string;
    alternateMobile?: string;
    gender?: string;
    dateOfBirth?: string;
    joiningDate?: string;
    department?: string;
    reportingManagerId?: string | null;
    employmentType?: string;
    state?: string;
    district?: string;
    taluk?: string;
    address?: string;
    languages?: string[];
    cropsExpertise?: string[];
    diseaseKnowledgeRating?: number;
    whatsappSkillRating?: number;
    customerHandlingRating?: number;
    fieldExperienceYears?: number;
    agronomistTier?: 'new' | 'experienced';
    compensation?: Record<string, unknown>;
    attendanceRules?: Record<string, unknown>;
  }): Promise<string> {
    const d = await api<{ ok: boolean; employee: { id: string } }>('/morbeez-staff/api/v1/employees', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    await loadWorkspace();
    return d.employee.id;
  }

  async function sendEmployeeSetupLink(employeeProfileId: string, email: string): Promise<string | null> {
    if (!email.trim()) return null;
    const d = await api<{
      ok: boolean;
      invite: { inviteUrl: string; email: string | null };
    }>(`/morbeez-staff/api/v1/employees/${employeeProfileId}/send-setup-link`, {
      method: 'POST',
      body: JSON.stringify({ channels: ['email'] }),
    });
    return d.invite?.inviteUrl ?? null;
  }

  async function updateEmployee(
    id: string,
    input: {
      fullName?: string;
      role?: string;
      active?: boolean;
      agronomistTier?: 'new' | 'experienced';
    }
  ) {
    const row = workspace?.employees.find((e) => e.id === id);
    if (row?.hasProfile === false) {
      await api(`/morbeez-staff/api/v1/staff/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: input.fullName,
          role: input.role,
          active: input.active,
        }),
      });
    } else {
      await api(`/morbeez-staff/api/v1/employees/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: input.fullName,
          role: input.role,
          status: input.active ? 'active' : 'inactive',
          agronomistTier: input.agronomistTier,
        }),
      });
    }
    await loadWorkspace();
  }

  async function deactivateEmployee(id: string, confirmPassword: string) {
    await api(`/morbeez-staff/api/v1/employees/${id}/deactivate`, {
      method: 'POST',
      body: JSON.stringify({ confirmPassword }),
    });
    await loadWorkspace();
  }

  async function reactivateEmployee(id: string) {
    await api(`/morbeez-staff/api/v1/employees/${id}/reactivate`, {
      method: 'POST',
      body: '{}',
    });
    await loadWorkspace();
  }

  function openEmployee(id: string) {
    setError('');
    setDetailTab('overview');
    navigate(toPath(`${paths.employees}/${id}`));
  }

  async function sendResetLink(id: string): Promise<string | null> {
    const d = await api<{
      ok: boolean;
      reset: { resetUrl: string };
    }>(`/morbeez-staff/api/v1/employees/${id}/reset-password-link`, {
      method: 'POST',
      body: JSON.stringify({ channels: ['email'] }),
    });
    await loadWorkspace();
    return d.reset?.resetUrl ?? null;
  }

  if (employeeId) {
    if (detailLoading && !detail?.employee) {
      return <Loading label="Loading employee…" />;
    }
    if (error && !detail?.employee) {
      return (
        <div className="emp-page">
          <Alert tone="error">{error}</Alert>
          <Btn className="mt-4" onClick={() => navigate(toPath(paths.employees))}>
            Back to employees
          </Btn>
        </div>
      );
    }
    if (!detail?.employee) {
      return (
        <div className="emp-page">
          <Alert tone="error">Employee not found</Alert>
          <Btn className="mt-4" onClick={() => navigate(toPath(paths.employees))}>
            Back to employees
          </Btn>
        </div>
      );
    }
  }

  if (!employeeId) {
    if (loading && !workspace) return <Loading label="Loading employees…" />;
    if (error && !workspace) return <Alert tone="error">{error}</Alert>;
    if (!workspace) return null;
  }

  if (employeeId && detail?.employee) {
    const e = detail.employee;
    const ov = detail.overview;
    const roi = ov.roiPct ?? e.roiPct ?? 0;
    const turnoverPct = Math.min(100, Math.round((e.turnoverInr / 200000) * 100));

    return (
      <div className="emp-page route-employees-detail">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <button
            type="button"
            className="font-semibold text-brand-700 hover:underline"
            onClick={() => navigate(toPath(paths.employees))}
          >
            Employees
          </button>
          <span>/</span>
          <span className="font-medium text-slate-800">{e.fullName}</span>
        </nav>

        <div className="emp-detail-header">
          <div className="emp-profile-main">
            <div className="emp-avatar-lg">{initials(e.fullName)}</div>
            <div>
              <h2 style={{ margin: '0 0 6px', fontSize: '1.35rem' }}>
                {e.fullName} {e.active ? <Badge tone="active">Active</Badge> : <Badge tone="archived">Inactive</Badge>}
              </h2>
              <p className="muted" style={{ margin: 0 }}>
                {roleLabel(e.role)} · {e.employeeCode} · {e.email}
              </p>
              <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
                Last login: {formatDateTime(ov.lastLoginAt ?? e.lastLoginAt)}
                {ov.isLateLogin ? ' · Late login' : ''}
                {e.performanceSource === 'engine' ? (
                  <>
                    {' '}
                    · {e.attributedFarmerCount ?? 0} attributed farmers
                    {e.leaderboardEligible ? '' : ' (building leaderboard sample)'}
                  </>
                ) : (
                  <> · estimated score (run intelligence recalc for engine score)</>
                )}
              </p>
            </div>
          </div>
          <div className="emp-metrics-rings">
            <ProgressRing pct={e.performanceScore} label="Performance" display={`${e.performanceScore}%`} />
            <ProgressRing pct={Math.min(100, roi)} label="ROI" display={`${roi}%`} />
            <ProgressRing pct={turnoverPct} label="Sales (mo)" display={formatInrFull(e.turnoverInr)} />
          </div>
        </div>

        <div className="emp-subtabs">
          {['overview', 'performance', 'leads', 'tasks', 'activity'].map((t) => (
            <button
              key={t}
              type="button"
              className={`emp-subtab ${detailTab === t ? 'active' : ''}`}
              onClick={() => setDetailTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {detailTab === 'overview' ? (
          <>
            <div className="emp-overview-grid">
              <div className="emp-mini-card">
                <div className="emp-mini-label">Pending Tasks</div>
                <div className="emp-mini-value">{e.pendingTasks}</div>
              </div>
              <div className="emp-mini-card">
                <div className="emp-mini-label">Follow-ups Today</div>
                <div className="emp-mini-value">{e.pendingFollowUpsToday}</div>
              </div>
              <div className="emp-mini-card">
                <div className="emp-mini-label">Total Leads</div>
                <div className="emp-mini-value">{e.totalLeads}</div>
              </div>
              <div className="emp-mini-card">
                <div className="emp-mini-label">Interactions today</div>
                <div className="emp-mini-value">{ov.interactionsToday}</div>
              </div>
              <div className="emp-mini-card">
                <div className="emp-mini-label">Interactions (mo)</div>
                <div className="emp-mini-value">{ov.interactionsThisMonth}</div>
              </div>
              <div className="emp-mini-card">
                <div className="emp-mini-label">New leads today</div>
                <div className="emp-mini-value">{ov.newLeadsToday}</div>
              </div>
              <div className="emp-mini-card">
                <div className="emp-mini-label">Est. incentive</div>
                <div className="emp-mini-value" style={{ fontSize: '1rem' }}>
                  {formatInrFull(ov.estimatedIncentiveInr)}
                </div>
              </div>
              <div className="emp-mini-card">
                <div className="emp-mini-label">Status</div>
                <div className="emp-mini-value" style={{ fontSize: '1rem' }}>
                  <span className={`status-dot ${e.statusOnline ? 'online' : ''}`}>
                    {e.statusOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            <div className="emp-chart-row">
              <Panel title="Turnover trend (6 months)">
                <div className="chart-wrap" style={{ height: 220, padding: '12px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 180 }}>
                    {detail.turnoverTrend.values.map((v, i) => {
                      const max = Math.max(...detail.turnoverTrend.values, 1);
                      return (
                        <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                          <div
                            style={{
                              height: `${Math.max(8, (v / max) * 140)}px`,
                              background: 'var(--green-500)',
                              borderRadius: '6px 6px 0 0',
                            }}
                          />
                          <small className="muted">{detail.turnoverTrend.labels[i]}</small>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Panel>
              <Panel title="Performance breakdown">
                {detail.performanceBreakdown.map((row) => (
                  <div className="emp-bar-row" key={row.label}>
                    <span className="emp-bar-label">{row.label}</span>
                    <div className="emp-bar-track">
                      <div className="emp-bar-fill" style={{ width: `${row.pct}%` }} />
                    </div>
                    <span style={{ width: 36, fontSize: 12, fontWeight: 700 }}>{row.pct}%</span>
                  </div>
                ))}
              </Panel>
            </div>

            <div className="emp-bottom-grid">
              <Panel title="Recent leads">
                {detail.recentLeads.length ? (
                  detail.recentLeads.map((l) => (
                    <div className="emp-list-item" key={l.id}>
                      <strong>{l.name}</strong>
                      <div className="muted">{l.crop}</div>
                    </div>
                  ))
                ) : (
                  <EmptyState>No leads assigned</EmptyState>
                )}
              </Panel>
              <Panel title="Recent tasks">
                {detail.recentTasks.length ? (
                  detail.recentTasks.map((t) => (
                    <div className="emp-list-item" key={t.id}>
                      <strong>{t.title}</strong>
                      <Badge tone={t.status === 'done' ? 'success' : 'warn'}>{t.status}</Badge>
                    </div>
                  ))
                ) : (
                  <EmptyState>No tasks</EmptyState>
                )}
              </Panel>
              <Panel title="Employee info">
                <div className="emp-list-item">
                  <span className="muted">Role</span>
                  <div>{roleLabel(e.role)}</div>
                </div>
                <div className="emp-list-item">
                  <span className="muted">Code</span>
                  <div>{e.employeeCode}</div>
                </div>
                <div className="emp-list-item">
                  <span className="muted">Performance</span>
                  <div>
                    <span className={`perf-pill ${perfClass(e.performanceLabel)}`}>{e.performanceLabel}</span>
                  </div>
                </div>
              </Panel>
            </div>
          </>
        ) : null}

        {detailTab === 'performance' ? (
          <div className="space-y-4">
            {e.performanceSource === 'engine' && !e.leaderboardEligible ? (
              <Alert tone="warn">
                Leaderboard ranking unlocks at 10 attributed farmers (currently {e.attributedFarmerCount ?? 0}).
                Score still updates from real CRM and WhatsApp signals.
              </Alert>
            ) : null}
            <Panel title="Performance breakdown">
              {detail.performanceBreakdown.length ? (
                detail.performanceBreakdown.map((row) => (
                  <div className="emp-bar-row" key={row.label}>
                    <span className="emp-bar-label">{row.label}</span>
                    <div className="emp-bar-track">
                      <div className="emp-bar-fill" style={{ width: `${row.pct}%` }} />
                    </div>
                    <span style={{ width: 36, fontSize: 12, fontWeight: 700 }}>{row.pct}%</span>
                  </div>
                ))
              ) : (
                <EmptyState>No performance components available</EmptyState>
              )}
            </Panel>
            {detail.performanceFactors && detail.performanceFactors.length > 0 ? (
              <Panel title="Score factors (explainability)">
                <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {detail.performanceFactors.slice(0, 12).map((f, i) => (
                    <li key={f.code ?? i}>{f.label}</li>
                  ))}
                </ul>
              </Panel>
            ) : null}
            <Panel title="Turnover trend (6 months)">
              <div className="chart-wrap" style={{ height: 220, padding: '12px 0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 180 }}>
                  {detail.turnoverTrend.values.map((v, i) => {
                    const max = Math.max(...detail.turnoverTrend.values, 1);
                    return (
                      <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                        <div
                          style={{
                            height: `${Math.max(8, (v / max) * 140)}px`,
                            background: 'var(--green-500)',
                            borderRadius: '6px 6px 0 0',
                          }}
                        />
                        <small className="muted">{detail.turnoverTrend.labels[i]}</small>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Panel>
          </div>
        ) : null}

        {detailTab === 'leads' ? (
          <Panel title="Assigned leads">
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Crop / Area</th>
                    <th>Last interaction</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recentLeads.length ? (
                    detail.recentLeads.map((lead) => (
                      <tr key={lead.id}>
                        <td>
                          <strong>{lead.name}</strong>
                        </td>
                        <td>{lead.crop || '—'}</td>
                        <td>{formatDateTime(lead.when)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3}>
                        <EmptyState>No leads assigned</EmptyState>
                      </td>
                    </tr>
                  )}
                </tbody>
              </DataTable>
            </TableWrap>
          </Panel>
        ) : null}

        {detailTab === 'tasks' ? (
          <Panel title="Assigned tasks">
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Due</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recentTasks.length ? (
                    detail.recentTasks.map((task) => (
                      <tr key={task.id}>
                        <td>
                          <strong>{task.title}</strong>
                        </td>
                        <td>
                          <Badge tone={task.status === 'done' ? 'success' : 'warn'}>{task.status}</Badge>
                        </td>
                        <td>{formatDateTime(task.dueAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3}>
                        <EmptyState>No tasks</EmptyState>
                      </td>
                    </tr>
                  )}
                </tbody>
              </DataTable>
            </TableWrap>
          </Panel>
        ) : null}

        {detailTab === 'activity' ? (
          <Panel title="Employee activity timeline">
            {(() => {
              const events = [
                ...detail.recentLeads.map((l) => ({
                  id: `lead-${l.id}`,
                  label: `Lead touched: ${l.name}`,
                  sub: l.crop || 'Lead activity',
                  at: l.when,
                })),
                ...detail.recentTasks.map((t) => ({
                  id: `task-${t.id}`,
                  label: `Task update: ${t.title}`,
                  sub: `Status: ${t.status}`,
                  at: t.dueAt,
                })),
              ]
                .filter((x) => !!x.at)
                .sort((a, b) => new Date(String(b.at)).getTime() - new Date(String(a.at)).getTime());

              if (!events.length) return <EmptyState>No activity available yet</EmptyState>;

              return (
                <div className="space-y-3">
                  {events.map((ev) => (
                    <div key={ev.id} className="emp-list-item">
                      <div>
                        <strong>{ev.label}</strong>
                        <div className="muted">{ev.sub}</div>
                      </div>
                      <div className="muted">{formatDateTime(ev.at)}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Panel>
        ) : null}
      </div>
    );
  }

  const filtered = workspace.employees.filter((e) => {
    if (listTab === 'active' && !e.active) return false;
    if (listTab === 'inactive' && e.active) return false;
    if (roleFilter && e.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        e.fullName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        (e.personalMobile ?? '').toLowerCase().includes(q) ||
        (e.companyWhatsapp ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const s = workspace.summary;
  const sec = workspace.secondary;

  return (
    <div className="emp-page">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {showHeavyPanels ? (
        <>
          <div className="mb-4">
            <EmployeePricingDashboard />
          </div>
          <div className="mb-4" id="bulk-margin-reviews">
            <BulkMarginReviewPanel />
          </div>
        </>
      ) : (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Loading pricing and margin tools…
        </div>
      )}

      <div className="stat-grid">
        <article className="stat-card">
          <div className="stat-card-head">
            <span className="stat-label">Total Employees</span>
            <span className="stat-icon stat-icon-teal">
              <StatIcon name="farmers" />
            </span>
          </div>
          <div className="stat-value">{s.totalEmployees}</div>
          <div className="stat-trend trend-up">
            <span className="trend-pct">+{s.activeCount}</span>
            <span className="trend-vs">active</span>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-card-head">
            <span className="stat-label">Avg Performance</span>
            <span className="stat-icon stat-icon-purple">
              <StatIcon name="trend" />
            </span>
          </div>
          <div className="stat-value">{s.avgPerformanceScore}</div>
          <div className="stat-trend trend-up">
            <span className="trend-pct">/ 100</span>
          </div>
        </article>
        <article className="stat-card">
          <div className="stat-card-head">
            <span className="stat-label">Avg Turnover</span>
            <span className="stat-icon stat-icon-green">
              <StatIcon name="sales" />
            </span>
          </div>
          <div className="stat-value">{formatInrFull(s.avgTurnoverInr)}</div>
        </article>
        <article className="stat-card">
          <div className="stat-card-head">
            <span className="stat-label">Pending Tasks</span>
            <span className="stat-icon stat-icon-orange">
              <StatIcon name="cart" />
            </span>
          </div>
          <div className="stat-value">{s.pendingTasks}</div>
        </article>
      </div>

      <div className="emp-mini-grid">
        <div className="emp-mini-card">
          <div className="emp-mini-label">Online now</div>
          <div className="emp-mini-value">{sec.onlineNow}</div>
        </div>
        <div className="emp-mini-card">
          <div className="emp-mini-label">Late login</div>
          <div className="emp-mini-value">{sec.lateLogin}</div>
        </div>
        <div className="emp-mini-card">
          <div className="emp-mini-label">Low turnover</div>
          <div className="emp-mini-value">{sec.lowTurnover}</div>
        </div>
        <div className="emp-mini-card">
          <div className="emp-mini-label">Interactions today</div>
          <div className="emp-mini-value">{sec.interactionsToday ?? s.interactionsToday ?? 0}</div>
        </div>
        <div className="emp-mini-card">
          <div className="emp-mini-label">Total leads</div>
          <div className="emp-mini-value">{sec.totalLeads}</div>
        </div>
      </div>

      <div className="emp-tabs-row">
        <button
          type="button"
          className={`emp-tab ${listTab === 'active' ? 'active' : ''}`}
          onClick={() => setListTab('active')}
        >
          Active Employees ({s.activeCount})
        </button>
        <button
          type="button"
          className={`emp-tab ${listTab === 'inactive' ? 'active' : ''}`}
          onClick={() => setListTab('inactive')}
        >
          Inactive Employees ({s.inactiveCount})
        </button>
      </div>

      <Panel>
        <FilterBar>
          <Select value={roleFilter} onChange={(ev) => setRoleFilter(ev.target.value)}>
            <option value="">All roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="operations">Operations</option>
            <option value="telecaller">Telecaller</option>
            <option value="agronomist">Agronomist</option>
            <option value="manager">Manager</option>
            <option value="viewer">Viewer</option>
          </Select>
          {canWrite ? (
            <Btn variant="primary" onClick={() => setShowNewEmployee(true)}>
              + New employee
            </Btn>
          ) : null}
          <Btn variant="secondary">Filters</Btn>
          <Btn variant="secondary">Export</Btn>
        </FilterBar>

        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Performance</th>
                <th>Turnover (mo)</th>
                <th>Leads</th>
                <th>Tasks</th>
                <th>Follow-ups</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.length ? (
                filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="emp-table-row--clickable"
                    onClick={() => openEmployee(e.id)}
                  >
                    <td>
                      <div className="emp-table-user">
                        <span className="emp-table-avatar">{initials(e.fullName)}</span>
                        <div>
                          <strong>{e.fullName}</strong>
                          <small>
                            {e.employeeCode} · {e.email}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge tone="role">{roleLabel(e.role)}</Badge>
                      {e.role === 'agronomist' && e.agronomistTier === 'experienced' ? (
                        <Badge tone="ok" style={{ marginLeft: 6 }}>
                          Experienced
                        </Badge>
                      ) : null}
                    </td>
                    <td>
                      <span className={`perf-pill ${perfClass(e.performanceLabel)}`}>
                        {e.performanceScore} · {e.performanceLabel}
                      </span>
                      {e.performanceSource === 'engine' ? (
                        <small className="muted" style={{ display: 'block', marginTop: 4 }}>
                          {e.attributedFarmerCount ?? 0} farmers
                        </small>
                      ) : null}
                    </td>
                    <td>{formatInrFull(e.turnoverInr)}</td>
                    <td>{e.totalLeads}</td>
                    <td>{e.pendingTasks}</td>
                    <td>{e.pendingFollowUpsToday}</td>
                    <td>
                      <span className={`status-dot ${e.statusOnline ? 'online' : ''}`}>
                        {e.statusOnline ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <details className="relative emp-row-actions">
                        <summary className="cursor-pointer list-none rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                          Actions ▾
                        </summary>
                        <div className="absolute right-0 z-20 mt-2 w-52 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
                          <button
                            type="button"
                            className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                            onClick={() => openEmployee(e.id)}
                          >
                            View
                          </button>
                          {canWrite ? (
                            <button
                              type="button"
                              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                              onClick={() => setEditingEmployee(e)}
                            >
                              Edit
                            </button>
                          ) : null}
                          {canWrite && e.active ? (
                            <button
                              type="button"
                              className="block w-full rounded px-2 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setDeactivatingEmployee(e);
                                setDeactivatePassword('');
                                setDeactivateError('');
                              }}
                            >
                              Deactivate
                            </button>
                          ) : null}
                          {canWrite && !e.active ? (
                            <button
                              type="button"
                              className="block w-full rounded px-2 py-1.5 text-left text-sm text-emerald-700 hover:bg-emerald-50"
                              onClick={() =>
                                setConfirmActionModal({
                                  title: 'Reactivate employee',
                                  body: `Reactivate ${e.fullName}?`,
                                  action: async () => {
                                    await reactivateEmployee(e.id);
                                  },
                                })
                              }
                            >
                              Reactivate
                            </button>
                          ) : null}
                          {canWrite ? (
                            <button
                              type="button"
                              className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                              onClick={async () => {
                                try {
                                  const url = await sendResetLink(e.id);
                                  if (url) {
                                    try {
                                      await navigator.clipboard.writeText(url);
                                    } catch {
                                      /* ignore */
                                    }
                                    setInfoModal({
                                      title: 'Reset link created',
                                      message: `Password reset link created (copied to clipboard when possible):\n\n${url}`,
                                    });
                                  }
                                } catch (err) {
                                  setInfoModal({
                                    title: 'Reset link failed',
                                    message:
                                      err instanceof Error
                                        ? err.message
                                        : 'Could not create reset link',
                                  });
                                }
                              }}
                            >
                              Password Reset Mail Sent
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                            onClick={() => window.print()}
                          >
                            Monthly Payout Print
                          </button>
                        </div>
                      </details>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>
                    <EmptyState>No employees in this view</EmptyState>
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableWrap>
      </Panel>
      {showNewEmployee ? (
        <NewEmployeeModal
          onClose={() => setShowNewEmployee(false)}
          onCreated={async () => {
            setShowNewEmployee(false);
            await loadWorkspace();
          }}
          createEmployee={createEmployee}
          sendSetupLink={sendEmployeeSetupLink}
          assignableRoles={assignableRoles}
        />
      ) : null}
      {editingEmployee ? (
        <EditEmployeeModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onSaved={async () => {
            setEditingEmployee(null);
            await loadWorkspace();
          }}
          updateEmployee={updateEmployee}
        />
      ) : null}
      {deactivatingEmployee ? (
        <Modal
          title={`Deactivate ${deactivatingEmployee.fullName}`}
          onClose={() => {
            setDeactivatingEmployee(null);
            setDeactivatePassword('');
            setDeactivateError('');
          }}
          onSave={async () => {
            setDeactivateSaving(true);
            setDeactivateError('');
            try {
              await deactivateEmployee(deactivatingEmployee.id, deactivatePassword);
              setDeactivatingEmployee(null);
              setDeactivatePassword('');
            } catch (e) {
              setDeactivateError(e instanceof Error ? e.message : 'Could not deactivate employee');
            } finally {
              setDeactivateSaving(false);
            }
          }}
          saveLabel="Confirm Deactivation"
          saving={deactivateSaving}
        >
          {deactivateError ? <Alert tone="error">{deactivateError}</Alert> : null}
          <p className="mb-2 text-sm text-slate-600">
            Enter your admin password to confirm deactivation.
          </p>
          <Field label="Admin password confirmation">
            <input
              type="password"
              className={inputClass}
              value={deactivatePassword}
              onChange={(e) => setDeactivatePassword(e.target.value)}
              placeholder="Enter your password"
            />
          </Field>
        </Modal>
      ) : null}
      {confirmActionModal ? (
        <Modal
          title={confirmActionModal.title}
          onClose={() => setConfirmActionModal(null)}
          onSave={async () => {
            try {
              await confirmActionModal.action();
              setConfirmActionModal(null);
            } catch (e) {
              setInfoModal({
                title: 'Action failed',
                message: e instanceof Error ? e.message : 'Could not complete action',
              });
            }
          }}
          saveLabel="Confirm"
        >
          <p className="text-sm text-slate-700">{confirmActionModal.body}</p>
        </Modal>
      ) : null}
      {infoModal ? (
        <Modal title={infoModal.title} onClose={() => setInfoModal(null)}>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{infoModal.message}</p>
        </Modal>
      ) : null}
    </div>
  );
}

function NewEmployeeModal({
  onClose,
  onCreated,
  createEmployee,
  sendSetupLink,
  assignableRoles,
}: {
  onClose: () => void;
  onCreated: () => Promise<void>;
  sendSetupLink: (employeeId: string, email: string) => Promise<string | null>;
  assignableRoles: string[];
  createEmployee: (input: {
    fullName: string;
    email: string;
    role: string;
    status: 'active' | 'inactive';
    personalMobile?: string;
    companyWhatsapp?: string;
    alternateMobile?: string;
    gender?: string;
    dateOfBirth?: string;
    joiningDate?: string;
    department?: string;
    reportingManagerId?: string | null;
    employmentType?: string;
    state?: string;
    district?: string;
    taluk?: string;
    address?: string;
    languages?: string[];
    cropsExpertise?: string[];
    diseaseKnowledgeRating?: number;
    whatsappSkillRating?: number;
    customerHandlingRating?: number;
    fieldExperienceYears?: number;
    agronomistTier?: 'new' | 'experienced';
    compensation?: Record<string, unknown>;
    attendanceRules?: Record<string, unknown>;
  }) => Promise<string>;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const defaultRole = assignableRoles.includes('telecaller')
    ? 'telecaller'
    : assignableRoles[0] ?? 'viewer';
  const [role, setRole] = useState(defaultRole);
  const [experiencedAgronomist, setExperiencedAgronomist] = useState(false);
  const [active, setActive] = useState(true);
  const [personalMobile, setPersonalMobile] = useState('');
  const [companyWhatsapp, setCompanyWhatsapp] = useState('');
  const [alternateMobile, setAlternateMobile] = useState('');
  const [gender, setGender] = useState('male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [department, setDepartment] = useState('Operations');
  const [employmentType, setEmploymentType] = useState('full_time');
  const [state, setState] = useState('Kerala');
  const [district, setDistrict] = useState('');
  const [taluk, setTaluk] = useState('');
  const [address, setAddress] = useState('');
  const [languages, setLanguages] = useState<string[]>(['English']);
  const [cropsExpertise, setCropsExpertise] = useState<string[]>([]);
  const [diseaseKnowledgeRating, setDiseaseKnowledgeRating] = useState(70);
  const [whatsappSkillRating, setWhatsappSkillRating] = useState(70);
  const [customerHandlingRating, setCustomerHandlingRating] = useState(70);
  const [fieldExperienceYears, setFieldExperienceYears] = useState(0);
  const [fixedSalary, setFixedSalary] = useState(30000);
  const [incentiveEnabled, setIncentiveEnabled] = useState(true);
  const [monthlySalesTarget, setMonthlySalesTarget] = useState(300000);
  const [incentivePct, setIncentivePct] = useState(2);
  const [conversionBonusEnabled, setConversionBonusEnabled] = useState(true);
  const [conversionTarget, setConversionTarget] = useState(50);
  const [additionalBonus, setAdditionalBonus] = useState(1000);
  const [retentionBonusEnabled, setRetentionBonusEnabled] = useState(false);
  const [relationshipBonusEnabled, setRelationshipBonusEnabled] = useState(false);
  const [followUpBonusEnabled, setFollowUpBonusEnabled] = useState(false);
  const [farmerRetentionBonus, setFarmerRetentionBonus] = useState(0);
  const [recommendationSuccessBonus, setRecommendationSuccessBonus] = useState(0);
  const [escalationBonus, setEscalationBonus] = useState(0);
  const [kmAllowanceEnabled, setKmAllowanceEnabled] = useState(false);
  const [ratePerKm, setRatePerKm] = useState(0);
  const [fieldVisitBonus, setFieldVisitBonus] = useState(0);
  const [assignedRegions, setAssignedRegions] = useState('');
  const [gpsTrackingEnabled, setGpsTrackingEnabled] = useState(false);
  const [offlineSyncEnabled, setOfflineSyncEnabled] = useState(false);
  const [travelAllowance, setTravelAllowance] = useState(0);
  const [joiningBonus, setJoiningBonus] = useState(0);
  const [minDailyHours, setMinDailyHours] = useState(9);
  const [monthlyWorkingDays, setMonthlyWorkingDays] = useState(23);
  const [workingWindowStart, setWorkingWindowStart] = useState('08:00');
  const [workingWindowEnd, setWorkingWindowEnd] = useState('19:00');
  const [idleWarningMinutes, setIdleWarningMinutes] = useState(45);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const employeeId = await createEmployee({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        role,
        status: active ? 'active' : 'inactive',
        personalMobile: personalMobile.trim() || undefined,
        companyWhatsapp: companyWhatsapp.trim() || undefined,
        alternateMobile: alternateMobile.trim() || undefined,
        gender,
        dateOfBirth: dateOfBirth || undefined,
        joiningDate: joiningDate || undefined,
        department,
        employmentType,
        state,
        district: district.trim() || undefined,
        taluk: taluk.trim() || undefined,
        address: address.trim() || undefined,
        languages,
        cropsExpertise,
        diseaseKnowledgeRating,
        whatsappSkillRating,
        customerHandlingRating,
        fieldExperienceYears,
        agronomistTier:
          role === 'agronomist' ? (experiencedAgronomist ? 'experienced' : 'new') : undefined,
        compensation: {
          fixed_salary: fixedSalary,
          incentive_enabled: incentiveEnabled,
          salary_cycle: 'monthly',
          joining_bonus: joiningBonus,
          travel_allowance: travelAllowance,
          monthly_sales_target: role === 'telecaller' ? monthlySalesTarget : 0,
          incentive_pct_after_target: role === 'telecaller' ? incentivePct : 0,
          conversion_target_pct: role === 'telecaller' ? conversionTarget : 0,
          additional_bonus_after_conversion: role === 'telecaller' ? additionalBonus : 0,
          conversion_bonus_enabled: role === 'telecaller' ? conversionBonusEnabled : false,
          retention_bonus_enabled: role === 'telecaller' ? retentionBonusEnabled : false,
          relationship_bonus_enabled: role === 'telecaller' ? relationshipBonusEnabled : false,
          follow_up_bonus_enabled: role === 'telecaller' ? followUpBonusEnabled : false,
          farmer_retention_bonus: role === 'agronomist' ? farmerRetentionBonus : 0,
          recommendation_success_bonus: role === 'agronomist' ? recommendationSuccessBonus : 0,
          escalation_bonus: role === 'agronomist' ? escalationBonus : 0,
          km_allowance_enabled: role === 'agronomist' ? kmAllowanceEnabled : false,
          rate_per_km: role === 'agronomist' ? ratePerKm : 0,
          field_visit_bonus: role === 'agronomist' ? fieldVisitBonus : 0,
          metadata: {
            assignedRegions: role === 'agronomist' ? assignedRegions : '',
            gpsTrackingEnabled: role === 'agronomist' ? gpsTrackingEnabled : false,
            offlineSyncEnabled: role === 'agronomist' ? offlineSyncEnabled : false,
          },
        },
        attendanceRules: {
          min_daily_hours: minDailyHours,
          monthly_working_days: monthlyWorkingDays,
          working_window_start: workingWindowStart,
          working_window_end: workingWindowEnd,
          idle_warning_threshold_minutes: idleWarningMinutes,
        },
      });
      if (email.trim()) {
        const url = await sendSetupLink(employeeId, email.trim());
        if (url) {
          setInviteUrl(url);
          try {
            await navigator.clipboard.writeText(url);
          } catch {
            /* clipboard may be blocked */
          }
          return;
        }
      }
      await onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create employee');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={inviteUrl ? 'Invitation link' : 'New employee'}
      onClose={onClose}
      onSave={inviteUrl ? onCreated : save}
      saveLabel={inviteUrl ? 'Done' : 'Create'}
      saving={saving}
    >
      {inviteUrl ? (
        <div className="space-y-3">
          <Alert tone="success">
            Employee created. Send this link to their email (copied to clipboard when possible).
          </Alert>
          <input className={inputClass} readOnly value={inviteUrl} onFocus={(e) => e.target.select()} />
        </div>
      ) : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {!inviteUrl ? (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-800">Basic Information</h4>
        <Field label="Full name">
          <input
            className={inputClass}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Asha Nair"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="asha@morbeez.in"
          />
        </Field>
        <Field label="Role">
          <StaticSelect
            className={inputClass}
            value={role}
            onChange={setRole}
            options={assignableRoles.map((r) => ({ value: r, label: roleLabel(r) }))}
          />
        </Field>
        <p className="text-xs text-slate-500">
          After create, an email invite link is generated. The employee must open it and enter the
          organization console password.
        </p>
        <Field label="Personal mobile">
          <input className={inputClass} value={personalMobile} onChange={(e) => setPersonalMobile(e.target.value)} />
        </Field>
        <Field label="Company WhatsApp">
          <input className={inputClass} value={companyWhatsapp} onChange={(e) => setCompanyWhatsapp(e.target.value)} />
        </Field>
        <Field label="Alternate number">
          <input className={inputClass} value={alternateMobile} onChange={(e) => setAlternateMobile(e.target.value)} />
        </Field>
        <Field label="Gender">
          <StaticSelect
            className={inputClass}
            value={gender}
            onChange={setGender}
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
              { value: 'other', label: 'Other' },
            ]}
          />
        </Field>
        <Field label="Date of birth">
          <input type="date" className={inputClass} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        </Field>
        <Field label="Joining date">
          <input type="date" className={inputClass} value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} />
        </Field>
        <h4 className="text-sm font-semibold text-slate-800">Role & Department</h4>
        <Field label="Department">
          <input className={inputClass} value={department} onChange={(e) => setDepartment(e.target.value)} />
        </Field>
        <Field label="Employment type">
          <StaticSelect
            className={inputClass}
            value={employmentType}
            onChange={setEmploymentType}
            options={[
              { value: 'full_time', label: 'Full-time' },
              { value: 'contract', label: 'Contract' },
              { value: 'part_time', label: 'Part-time' },
            ]}
          />
        </Field>
        <h4 className="text-sm font-semibold text-slate-800">Location & Languages</h4>
        <Field label="State">
          <input className={inputClass} value={state} onChange={(e) => setState(e.target.value)} />
        </Field>
        <Field label="District">
          <input className={inputClass} value={district} onChange={(e) => setDistrict(e.target.value)} />
        </Field>
        <Field label="Taluk">
          <input className={inputClass} value={taluk} onChange={(e) => setTaluk(e.target.value)} />
        </Field>
        <Field label="Address">
          <textarea className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="Languages">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {['Malayalam', 'Tamil', 'Kannada', 'English', 'Hindi'].map((lang) => (
              <label key={lang} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={languages.includes(lang)}
                  onChange={(e) =>
                    setLanguages((prev) =>
                      e.target.checked ? [...prev, lang] : prev.filter((x) => x !== lang)
                    )
                  }
                />
                {lang}
              </label>
            ))}
          </div>
        </Field>
        <h4 className="text-sm font-semibold text-slate-800">Agriculture Skills</h4>
        <Field label="Crops expertise">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {['Ginger', 'Banana', 'Cardamom', 'Pepper', 'Vegetables'].map((crop) => (
              <label key={crop} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cropsExpertise.includes(crop)}
                  onChange={(e) =>
                    setCropsExpertise((prev) =>
                      e.target.checked ? [...prev, crop] : prev.filter((x) => x !== crop)
                    )
                  }
                />
                {crop}
              </label>
            ))}
          </div>
        </Field>
        <Field label="Disease knowledge rating">
          <input type="number" className={inputClass} value={diseaseKnowledgeRating} onChange={(e) => setDiseaseKnowledgeRating(Number(e.target.value || 0))} />
        </Field>
        <Field label="WhatsApp communication skill">
          <input type="number" className={inputClass} value={whatsappSkillRating} onChange={(e) => setWhatsappSkillRating(Number(e.target.value || 0))} />
        </Field>
        <Field label="Customer handling skill">
          <input type="number" className={inputClass} value={customerHandlingRating} onChange={(e) => setCustomerHandlingRating(Number(e.target.value || 0))} />
        </Field>
        <Field label="Field experience years">
          <input type="number" className={inputClass} value={fieldExperienceYears} onChange={(e) => setFieldExperienceYears(Number(e.target.value || 0))} />
        </Field>
        <h4 className="text-sm font-semibold text-slate-800">Salary & Incentives</h4>
        <Field label="Fixed salary">
          <input type="number" className={inputClass} value={fixedSalary} onChange={(e) => setFixedSalary(Number(e.target.value || 0))} />
        </Field>
        <Field label="Joining bonus">
          <input type="number" className={inputClass} value={joiningBonus} onChange={(e) => setJoiningBonus(Number(e.target.value || 0))} />
        </Field>
        <Field label="Travel allowance">
          <input type="number" className={inputClass} value={travelAllowance} onChange={(e) => setTravelAllowance(Number(e.target.value || 0))} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={incentiveEnabled} onChange={(e) => setIncentiveEnabled(e.target.checked)} />
          Incentive enabled
        </label>

        {role === 'telecaller' ? (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-3">
            <h5 className="text-sm font-semibold text-slate-800">Telecaller Conditional Fields</h5>
            <Field label="Monthly Sales Target">
              <input type="number" className={inputClass} value={monthlySalesTarget} onChange={(e) => setMonthlySalesTarget(Number(e.target.value || 0))} />
            </Field>
            <Field label="Incentive % After Target">
              <input type="number" className={inputClass} value={incentivePct} onChange={(e) => setIncentivePct(Number(e.target.value || 0))} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={conversionBonusEnabled} onChange={(e) => setConversionBonusEnabled(e.target.checked)} />
              Conversion Bonus Enabled
            </label>
            <Field label="Conversion Target %">
              <input type="number" className={inputClass} value={conversionTarget} onChange={(e) => setConversionTarget(Number(e.target.value || 0))} />
            </Field>
            <Field label="Additional Bonus After Conversion Target">
              <input type="number" className={inputClass} value={additionalBonus} onChange={(e) => setAdditionalBonus(Number(e.target.value || 0))} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={retentionBonusEnabled} onChange={(e) => setRetentionBonusEnabled(e.target.checked)} />
              Retention Bonus Enabled
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={relationshipBonusEnabled} onChange={(e) => setRelationshipBonusEnabled(e.target.checked)} />
              Relationship Bonus Enabled
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={followUpBonusEnabled} onChange={(e) => setFollowUpBonusEnabled(e.target.checked)} />
              Follow-up Bonus Enabled
            </label>
          </div>
        ) : null}

        {role === 'agronomist' ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-3">
            <h5 className="text-sm font-semibold text-slate-800">Agronomist settings</h5>
            <label className="flex items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-white px-3 py-2.5 text-sm text-slate-800">
              <span>
                <strong>Experienced agronomist</strong>
                <span className="block text-xs font-normal text-slate-500 mt-0.5">
                  Can edit AI responses, submit, and approve without Super Admin (new agronomists
                  require approval).
                </span>
              </span>
              <input
                type="checkbox"
                checked={experiencedAgronomist}
                onChange={(e) => setExperiencedAgronomist(e.target.checked)}
              />
            </label>
            <Field label="Farmer Retention Bonus">
              <input type="number" className={inputClass} value={farmerRetentionBonus} onChange={(e) => setFarmerRetentionBonus(Number(e.target.value || 0))} />
            </Field>
            <Field label="Recommendation Success Bonus">
              <input type="number" className={inputClass} value={recommendationSuccessBonus} onChange={(e) => setRecommendationSuccessBonus(Number(e.target.value || 0))} />
            </Field>
            <Field label="Escalation Resolution Bonus">
              <input type="number" className={inputClass} value={escalationBonus} onChange={(e) => setEscalationBonus(Number(e.target.value || 0))} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={kmAllowanceEnabled} onChange={(e) => setKmAllowanceEnabled(e.target.checked)} />
              KM Allowance Enabled
            </label>
            <Field label="Rate Per KM">
              <input type="number" className={inputClass} value={ratePerKm} onChange={(e) => setRatePerKm(Number(e.target.value || 0))} />
            </Field>
            <Field label="Field Visit Bonus">
              <input type="number" className={inputClass} value={fieldVisitBonus} onChange={(e) => setFieldVisitBonus(Number(e.target.value || 0))} />
            </Field>
            <Field label="Assigned Regions">
              <input className={inputClass} value={assignedRegions} onChange={(e) => setAssignedRegions(e.target.value)} placeholder="District/Taluk list" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={gpsTrackingEnabled} onChange={(e) => setGpsTrackingEnabled(e.target.checked)} />
              GPS Tracking Enabled
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={offlineSyncEnabled} onChange={(e) => setOfflineSyncEnabled(e.target.checked)} />
              Offline Sync Enabled
            </label>
          </div>
        ) : null}

        {role !== 'telecaller' && role !== 'agronomist' ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Role-based conditional fields are disabled. Select role <strong>Telecaller</strong> or <strong>Agronomist</strong> to enable additional fields.
          </div>
        ) : null}

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div>Estimated Monthly Earnings</div>
          <div>Fixed Salary: {formatInrFull(fixedSalary)}</div>
          <div>Estimated Incentive: {formatInrFull(Math.round((monthlySalesTarget * incentivePct) / 10000))}</div>
          <strong>
            Estimated Total: {formatInrFull(fixedSalary + Math.round((monthlySalesTarget * incentivePct) / 10000))}
          </strong>
        </div>
        <h4 className="text-sm font-semibold text-slate-800">Attendance Rules</h4>
        <Field label="Minimum daily hours">
          <input type="number" className={inputClass} value={minDailyHours} onChange={(e) => setMinDailyHours(Number(e.target.value || 0))} />
        </Field>
        <Field label="Monthly working days">
          <input type="number" className={inputClass} value={monthlyWorkingDays} onChange={(e) => setMonthlyWorkingDays(Number(e.target.value || 0))} />
        </Field>
        <Field label="Working window start">
          <input type="time" className={inputClass} value={workingWindowStart} onChange={(e) => setWorkingWindowStart(e.target.value)} />
        </Field>
        <Field label="Working window end">
          <input type="time" className={inputClass} value={workingWindowEnd} onChange={(e) => setWorkingWindowEnd(e.target.value)} />
        </Field>
        <Field label="Idle warning threshold (minutes)">
          <input type="number" className={inputClass} value={idleWarningMinutes} onChange={(e) => setIdleWarningMinutes(Number(e.target.value || 0))} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active account
        </label>
      </div>
      ) : null}
    </Modal>
  );
}

function EditEmployeeModal({
  employee,
  onClose,
  onSaved,
  updateEmployee,
}: {
  employee: Employee;
  onClose: () => void;
  onSaved: () => Promise<void>;
  updateEmployee: (
    id: string,
    input: {
      fullName?: string;
      role?: string;
      active?: boolean;
      agronomistTier?: 'new' | 'experienced';
    }
  ) => Promise<void>;
}) {
  const [fullName, setFullName] = useState(employee.fullName);
  const [role, setRole] = useState(employee.role);
  const [experiencedAgronomist, setExperiencedAgronomist] = useState(
    employee.agronomistTier === 'experienced'
  );
  const [active, setActive] = useState(employee.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    try {
      await updateEmployee(employee.id, {
        fullName: fullName.trim(),
        role,
        active,
        agronomistTier:
          role === 'agronomist' ? (experiencedAgronomist ? 'experienced' : 'new') : undefined,
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update employee');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit employee" onClose={onClose} onSave={save} saveLabel="Update" saving={saving}>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="space-y-3">
        <Field label="Full name">
          <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Role">
          <StaticSelect
            className={inputClass}
            value={role}
            onChange={setRole}
            options={[
              { value: 'super_admin', label: 'Super Admin' },
              { value: 'admin', label: 'Admin' },
              { value: 'operations', label: 'Operations' },
              { value: 'telecaller', label: 'Telecaller' },
              { value: 'agronomist', label: 'Agronomist' },
              { value: 'manager', label: 'Manager' },
              { value: 'viewer', label: 'Viewer' },
            ]}
          />
        </Field>
        {role === 'agronomist' ? (
          <label className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-slate-800">
            <span>
              <strong>Experienced agronomist</strong>
              <span className="block text-xs font-normal text-slate-500 mt-0.5">
                Self-approve recommendations without Super Admin
              </span>
            </span>
            <input
              type="checkbox"
              checked={experiencedAgronomist}
              onChange={(e) => setExperiencedAgronomist(e.target.checked)}
            />
          </label>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active account
        </label>
      </div>
    </Modal>
  );
}
