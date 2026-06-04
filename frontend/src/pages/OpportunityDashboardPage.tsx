import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Alert, Btn, HubTabs, Panel, ReadOnlyBanner, TableWrap } from '../components/ui';
import { StatIcon } from '../components/NavIcon';

const intelBase = '/morbeez-staff/api/v1/os/intelligence';
const dashBase = `${intelBase}/opportunity-dashboard`;
const scoreBase = `${intelBase}/opportunity-scores`;
const alertsBase = `${intelBase}/opportunity-alerts`;

type Tab =
  | 'overview'
  | 'districts'
  | 'farmers'
  | 'at_risk'
  | 'employees'
  | 'relationship'
  | 'retention'
  | 'alerts';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'districts', label: 'Districts' },
  { id: 'farmers', label: 'Top farmers' },
  { id: 'at_risk', label: 'At risk' },
  { id: 'employees', label: 'Performance' },
  { id: 'relationship', label: 'Relationship' },
  { id: 'retention', label: 'Retention' },
];

type Overview = {
  periodDays: number;
  kpis: {
    farmersScored: number;
    avgOpportunityScore: number;
    highOpportunityFarmers: number;
    atRiskFarmers: number;
    churnedFarmers: number;
    events30d: number;
    conversions30d: number;
    activeAttributions: number;
    employeesScored: number;
    lastFarmerScoreRun: string | null;
    lastEmployeeScoreRun: string | null;
  };
  retentionBands: Array<{ band: string; count: number }>;
  scoreDistribution: Array<{ bucket: string; count: number }>;
};

type DistrictRow = {
  district: string;
  farmerCount: number;
  avgOpportunityScore: number;
  atRiskCount: number;
  highOpportunityCount: number;
  intensity: number;
};

type FarmerRow = {
  farmerId: string;
  opportunityScore: number;
  name: string | null;
  phone: string | null;
  district: string | null;
  riskBand: string | null;
};

type AtRiskRow = {
  farmerId: string;
  name: string | null;
  phone: string | null;
  district: string | null;
  opportunityScore: number | null;
  riskBand: string;
  daysSinceLastInbound: number | null;
};

type EmployeeRow = {
  employeeProfileId: string;
  performanceScore: number;
  attributedFarmerCount: number;
  fullName: string | null;
  email: string | null;
  role: string | null;
  calculatedAt: string;
};

type SpecialtyEmployeeRow = EmployeeRow & { specialtyScore: number };

type OppAlert = {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  body: string | null;
  status: string;
  createdAt: string;
};

function bandLabel(band: string): string {
  if (band === 'healthy') return 'Healthy';
  if (band === 'watch') return 'Watch';
  if (band === 'at_risk') return 'At risk';
  if (band === 'churned') return 'Churned';
  return band;
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function OpportunityDashboardPage({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState('');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [eventVolume, setEventVolume] = useState<Array<{ eventType: string; count: number }>>([]);
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [topFarmers, setTopFarmers] = useState<FarmerRow[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [relationshipLeaders, setRelationshipLeaders] = useState<SpecialtyEmployeeRow[]>([]);
  const [retentionLeaders, setRetentionLeaders] = useState<SpecialtyEmployeeRow[]>([]);
  const [alerts, setAlerts] = useState<OppAlert[]>([]);
  const [minAttributed, setMinAttributed] = useState(10);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'overview') {
        const d = await api<{
          ok: boolean;
          overview: Overview;
          eventVolume: Array<{ eventType: string; count: number }>;
        }>(`${dashBase}/overview?days=30`);
        setOverview(d.overview);
        setEventVolume(d.eventVolume);
      } else if (tab === 'districts') {
        const d = await api<{ ok: boolean; districts: DistrictRow[] }>(`${dashBase}/districts?limit=40`);
        setDistricts(d.districts);
      } else if (tab === 'farmers') {
        const d = await api<{ ok: boolean; farmers: FarmerRow[] }>(
          `${dashBase}/farmers/top?limit=30&minScore=50`
        );
        setTopFarmers(d.farmers);
      } else if (tab === 'at_risk') {
        const d = await api<{ ok: boolean; farmers: AtRiskRow[] }>(`${dashBase}/farmers/at-risk?limit=50`);
        setAtRisk(d.farmers);
      } else if (tab === 'alerts') {
        const d = await api<{ ok: boolean; alerts: OppAlert[] }>(`${alertsBase}?status=open&limit=80`);
        setAlerts(d.alerts);
      } else if (tab === 'relationship') {
        const d = await api<{
          ok: boolean;
          employees: SpecialtyEmployeeRow[];
          minAttributedFarmers: number;
        }>(`${intelBase}/performance-scores/employees/top-relationship-builders?limit=25`);
        setRelationshipLeaders(d.employees);
        setMinAttributed(d.minAttributedFarmers);
      } else if (tab === 'retention') {
        const d = await api<{ ok: boolean; employees: SpecialtyEmployeeRow[]; minAttributedFarmers: number }>(
          `${intelBase}/performance-scores/employees/high-retention?limit=25`
        );
        setRetentionLeaders(d.employees);
        setMinAttributed(d.minAttributedFarmers);
      } else {
        const d = await api<{
          ok: boolean;
          employees: EmployeeRow[];
          minAttributedFarmers: number;
        }>(`${dashBase}/employees?limit=25`);
        setEmployees(d.employees);
        setMinAttributed(d.minAttributedFarmers);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load dashboard');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runGenerateAlerts() {
    if (!canWrite) return;
    setActionBusy(true);
    setActionMsg('');
    setError('');
    try {
      const gen = await api<{ ok: boolean; created: number }>(`${alertsBase}/generate`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const tasks = await api<{ ok: boolean; tasksCreated: number }>(`${alertsBase}/enqueue-tasks`, {
        method: 'POST',
        body: JSON.stringify({ limit: 40 }),
      });
      const nurture = await api<{ ok: boolean; tasksCreated: number; whatsappSent: number }>(
        `${alertsBase}/enqueue-nurture`,
        { method: 'POST', body: JSON.stringify({ limit: 25 }) }
      );
      setActionMsg(
        `Generated ${gen.created} alerts; ${tasks.tasksCreated} retention tasks; ${nurture.tasksCreated} nurture tasks (${nurture.whatsappSent} WhatsApp).`
      );
      if (tab === 'alerts') await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Alert action failed');
    } finally {
      setActionBusy(false);
    }
  }

  async function acknowledgeAlert(alertId: string) {
    if (!canWrite) return;
    await api(`${alertsBase}/${alertId}/acknowledge`, { method: 'POST', body: '{}' });
    await load();
  }

  async function runRecalculate() {
    if (!canWrite) return;
    setRecalcBusy(true);
    setRecalcMsg('');
    setError('');
    try {
      const d = await api<{
        ok: boolean;
        batch?: { processed: number };
        employeeBatch?: { processed: number };
      }>(`${scoreBase}/recalculate`, {
        method: 'POST',
        body: JSON.stringify({ limit: 500, includeEmployees: true, runBusinessActions: true }),
      });
      const f = d.batch?.scored ?? d.batch?.processed ?? 0;
      const e = d.employeeBatch?.scored ?? d.employeeBatch?.processed ?? 0;
      setRecalcMsg(`Scored ${f} farmers and ${e} employees (+ business actions). Refreshing…`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Recalculate failed');
    } finally {
      setRecalcBusy(false);
    }
  }

  const k = overview?.kpis;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <p className="muted" style={{ margin: 0, maxWidth: 560 }}>
          Events → attribution → opportunity scores → dashboards. Relationship-driven signals, not
          sales-only lead counts.
        </p>
        {canWrite ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="secondary" disabled={actionBusy || recalcBusy} onClick={() => void runGenerateAlerts()}>
              {actionBusy ? 'Working…' : 'Run alerts + CRM tasks'}
            </Btn>
            <Btn variant="primary" disabled={recalcBusy || actionBusy} onClick={() => void runRecalculate()}>
              {recalcBusy ? 'Scoring…' : 'Recalculate scores'}
            </Btn>
          </div>
        ) : (
          <ReadOnlyBanner />
        )}
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {recalcMsg ? <Alert tone="success">{recalcMsg}</Alert> : null}
      {actionMsg ? <Alert tone="info">{actionMsg}</Alert> : null}

      <HubTabs tabs={TABS} active={tab} onChange={(id) => setTab(id as Tab)} />

      {loading ? (
        <p className="muted">Loading…</p>
      ) : tab === 'overview' && overview && k ? (
        <>
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <article className="stat-card">
              <div className="stat-card-head">
                <span className="stat-label">Farmers scored</span>
                <span className="stat-icon stat-icon-teal">
                  <StatIcon name="farmers" />
                </span>
              </div>
              <div className="stat-value">{k.farmersScored}</div>
            </article>
            <article className="stat-card">
              <div className="stat-card-head">
                <span className="stat-label">Avg opportunity</span>
                <span className="stat-icon stat-icon-purple">
                  <StatIcon name="ai" />
                </span>
              </div>
              <div className="stat-value">{k.avgOpportunityScore}</div>
            </article>
            <article className="stat-card">
              <div className="stat-card-head">
                <span className="stat-label">High opportunity</span>
                <span className="stat-icon stat-icon-green">
                  <StatIcon name="trend" />
                </span>
              </div>
              <div className="stat-value">{k.highOpportunityFarmers}</div>
              <div className="stat-trend">
                <span className="trend-vs">score ≥ 70</span>
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-card-head">
                <span className="stat-label">At risk / churned</span>
                <span className="stat-icon stat-icon-blue">
                  <StatIcon name="tasks" />
                </span>
              </div>
              <div className="stat-value">
                {k.atRiskFarmers} / {k.churnedFarmers}
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-card-head">
                <span className="stat-label">Events (30d)</span>
                <span className="stat-icon stat-icon-blue">
                  <StatIcon name="cart" />
                </span>
              </div>
              <div className="stat-value">{k.events30d}</div>
            </article>
            <article className="stat-card">
              <div className="stat-card-head">
                <span className="stat-label">Conversions (30d)</span>
                <span className="stat-icon stat-icon-green">
                  <StatIcon name="sales" />
                </span>
              </div>
              <div className="stat-value">{k.conversions30d}</div>
            </article>
            <article className="stat-card">
              <div className="stat-card-head">
                <span className="stat-label">Employees scored</span>
                <span className="stat-icon stat-icon-teal">
                  <StatIcon name="farmers" />
                </span>
              </div>
              <div className="stat-value">{k.employeesScored}</div>
              <div className="stat-trend">
                <span className="trend-vs">{k.activeAttributions} active attributions</span>
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-card-head">
                <span className="stat-label">Last score run</span>
                <span className="stat-icon stat-icon-purple">
                  <StatIcon name="ai" />
                </span>
              </div>
              <div className="stat-value" style={{ fontSize: 15 }}>
                {formatWhen(k.lastFarmerScoreRun)}
              </div>
            </article>
          </div>

          <div
            style={{
              marginTop: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            <Panel title="Retention bands">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {overview.retentionBands.map((b) => (
                  <li
                    key={b.band}
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}
                  >
                    <span>{bandLabel(b.band)}</span>
                    <strong>{b.count}</strong>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Opportunity distribution">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {overview.scoreDistribution.map((b) => (
                  <li
                    key={b.bucket}
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}
                  >
                    <span>{b.bucket}</span>
                    <strong>{b.count}</strong>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Event volume (30d)">
              {eventVolume.length === 0 ? (
                <p className="muted">No events in period.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {eventVolume.slice(0, 12).map((e) => (
                    <li
                      key={e.eventType}
                      style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}
                    >
                      <span>{e.eventType.replace(/_/g, ' ')}</span>
                      <strong>{e.count}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      ) : tab === 'districts' ? (
        <Panel title="District opportunity heatmap">
          <TableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>District</th>
                  <th>Farmers</th>
                  <th>Avg score</th>
                  <th>High opp.</th>
                  <th>At risk</th>
                  <th>Intensity</th>
                </tr>
              </thead>
              <tbody>
                {districts.map((d) => (
                  <tr key={d.district}>
                    <td>{d.district}</td>
                    <td>{d.farmerCount}</td>
                    <td>{d.avgOpportunityScore}</td>
                    <td>{d.highOpportunityCount}</td>
                    <td>{d.atRiskCount}</td>
                    <td>{d.intensity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      ) : tab === 'farmers' ? (
        <Panel title="Top opportunity farmers (score ≥ 50)">
          <TableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>District</th>
                  <th>Score</th>
                  <th>Retention</th>
                </tr>
              </thead>
              <tbody>
                {topFarmers.map((f) => (
                  <tr key={f.farmerId}>
                    <td>{f.name ?? '—'}</td>
                    <td>{f.phone ?? '—'}</td>
                    <td>{f.district ?? '—'}</td>
                    <td>
                      <strong>{f.opportunityScore}</strong>
                    </td>
                    <td>{f.riskBand ? bandLabel(f.riskBand) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      ) : tab === 'alerts' ? (
        <Panel title="Open intelligence alerts">
          {alerts.length === 0 ? (
            <p className="muted">No open alerts. Run nightly scoring or “Run alerts + CRM tasks”.</p>
          ) : (
            <TableWrap>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Type</th>
                    <th>Title</th>
                    <th>When</th>
                    {canWrite ? <th /> : null}
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id}>
                      <td>{a.severity}</td>
                      <td>{a.alertType.replace(/_/g, ' ')}</td>
                      <td>
                        <strong>{a.title}</strong>
                        {a.body ? (
                          <div className="muted" style={{ fontSize: 12 }}>
                            {a.body}
                          </div>
                        ) : null}
                      </td>
                      <td>{formatWhen(a.createdAt)}</td>
                      {canWrite ? (
                        <td>
                          <Btn size="sm" variant="ghost" onClick={() => void acknowledgeAlert(a.id)}>
                            Ack
                          </Btn>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Panel>
      ) : tab === 'at_risk' ? (
        <Panel title="At-risk and churned farmers">
          <TableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>District</th>
                  <th>Band</th>
                  <th>Days silent</th>
                  <th>Opportunity</th>
                </tr>
              </thead>
              <tbody>
                {atRisk.map((f) => (
                  <tr key={f.farmerId}>
                    <td>{f.name ?? f.phone ?? f.farmerId.slice(0, 8)}</td>
                    <td>{f.district ?? '—'}</td>
                    <td>{bandLabel(f.riskBand)}</td>
                    <td>{f.daysSinceLastInbound ?? '—'}</td>
                    <td>{f.opportunityScore ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      ) : tab === 'relationship' ? (
        <Panel title={`Top relationship builders (≥${minAttributed} farmers)`}>
          <TableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Relationship</th>
                  <th>Overall</th>
                  <th>Attributed</th>
                </tr>
              </thead>
              <tbody>
                {relationshipLeaders.map((e) => (
                  <tr key={e.employeeProfileId}>
                    <td>{e.fullName ?? e.email ?? '—'}</td>
                    <td>
                      <strong>{e.specialtyScore}</strong>
                    </td>
                    <td>{e.performanceScore}</td>
                    <td>{e.attributedFarmerCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      ) : tab === 'retention' ? (
        <Panel title={`High retention quality (≥${minAttributed} farmers)`}>
          <TableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Retention</th>
                  <th>Overall</th>
                  <th>Attributed</th>
                </tr>
              </thead>
              <tbody>
                {retentionLeaders.map((e) => (
                  <tr key={e.employeeProfileId}>
                    <td>{e.fullName ?? e.email ?? '—'}</td>
                    <td>
                      <strong>{e.specialtyScore}</strong>
                    </td>
                    <td>{e.performanceScore}</td>
                    <td>{e.attributedFarmerCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      ) : (
        <Panel title={`Employee leaderboard (≥${minAttributed} attributed farmers)`}>
          <TableWrap>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Attributed</th>
                  <th>Performance</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.employeeProfileId}>
                    <td>{e.fullName ?? e.email ?? '—'}</td>
                    <td>{e.role ?? '—'}</td>
                    <td>{e.attributedFarmerCount}</td>
                    <td>
                      <strong>{e.performanceScore}</strong>
                    </td>
                    <td>{formatWhen(e.calculatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      )}
    </div>
  );
}
