import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatInrFull } from '../../lib/format';
import { paths, toPath } from '../../lib/routes';
import { Badge, Btn, DataTable, Loading, Panel, StaticSelect, TableWrap } from '../ui';
import '../../styles/super-admin-monitor.css';

type AlertAction = {
  kind: 'employee' | 'employees' | 'warehouse' | 'commerce';
  href: string;
  employeeProfileId?: string;
};

type Monitor = {
  asOf: string;
  monthYear: string;
  dailySummary: {
    totalSales: number;
    grossProfit: number;
    avgRealizationPct: number;
    ordersCount: number;
    retailSales: number;
    bulkSales: number;
    cashCollected: number;
  };
  monthSummary: {
    totalSales: number;
    grossProfit: number;
    avgRealizationPct: number;
    ordersCount: number;
    retailSales: number;
    bulkSales: number;
    cashCollected: number;
  };
  employeeHeadwise: Array<{
    employeeProfileId: string;
    fullName: string;
    employeeCode: string;
    salesInr: number;
    grossProfitInr: number;
    avgRealizationPct: number;
    incentiveInr: number;
    netContributionInr: number;
    contributionLabel: string;
  }>;
  realizationMonitoring: Array<{
    employeeProfileId: string;
    fullName: string;
    avgRealizationPct: number;
    status: string;
  }>;
  bulkOrderProfit: Array<{
    customerKey: string;
    customerName: string;
    salesInr: number;
    grossProfitInr: number;
    marginPct: number;
    atRisk: boolean;
  }>;
  marginLeakage: Array<{
    employeeProfileId: string;
    fullName: string;
    ordersNearFloor: number;
    avgDiscountPct: number;
    atRisk: boolean;
  }>;
  inventoryHealth: {
    deadStock: number;
    fastMovingStock: number;
    lowInventory: number;
    agingStock: number;
    stockValueUnits: number;
  };
  returnComplaints: Array<{
    employeeProfileId: string;
    fullName: string;
    returnPct: number;
    complaintLevel: string;
  }>;
  employeePerformance: Array<{
    employeeProfileId: string;
    fullName: string;
    kpiScore: number;
    grade: string;
  }>;
  cashFlow: {
    codPending: number;
    receivables: number;
    cashCollected: number;
    adSpend: number;
    adSpendSource: 'logged' | 'estimated';
    profitAfterExpenses: number;
  };
  alerts: Array<{
    id: string;
    severity: 'critical' | 'warning';
    title: string;
    detail: string;
    action?: AlertAction;
  }>;
};

function fmt(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  return formatInrFull(n);
}

function contribTone(label: string) {
  if (label === 'Strong') return 'success';
  if (label === 'Good') return 'info';
  if (label === 'Moderate') return 'warn';
  return 'error';
}

function gradeTone(g: string) {
  if (g === 'A+') return 'success';
  if (g === 'A') return 'info';
  if (g === 'B') return 'neutral';
  if (g === 'C') return 'warn';
  return 'error';
}

function statusTone(s: string) {
  if (s === 'Healthy') return 'success';
  if (s === 'Good') return 'info';
  if (s === 'Watch') return 'warn';
  return 'error';
}

function currentMonthInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function KpiTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <article className="sam-kpi-tile">
      <span className="sam-kpi-label">{label}</span>
      <strong className="sam-kpi-value">{value}</strong>
      {sub ? <span className="sam-kpi-sub">{sub}</span> : null}
    </article>
  );
}

function EmployeeLink({
  id,
  name,
  sub,
  onNavigate,
}: {
  id: string;
  name: string;
  sub?: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <button type="button" className="sam-emp-link" onClick={() => onNavigate(id)}>
      <strong>{name}</strong>
      {sub ? <div className="muted text-xs">{sub}</div> : null}
    </button>
  );
}

export function SuperAdminMonitorDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<Monitor | null>(null);
  const [monthYear, setMonthYear] = useState(currentMonthInput());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [adAmount, setAdAmount] = useState('');
  const [adChannel, setAdChannel] = useState('general');
  const [adSaving, setAdSaving] = useState(false);

  const goEmployee = useCallback(
    (id: string) => {
      navigate(toPath(paths.employeeDetail.replace(':employeeId', id)));
    },
    [navigate]
  );

  const goAlert = useCallback(
    (action?: AlertAction) => {
      if (!action) return;
      navigate(toPath(action.href.replace(/^\//, '')));
    },
    [navigate]
  );

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    return api<{ ok: boolean; monitor: Monitor }>(
      `/morbeez-staff/api/v1/dashboard/super-admin-monitor?monthYear=${encodeURIComponent(monthYear)}`
    )
      .then((r) => setData(r.monitor))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load monitor'))
      .finally(() => setLoading(false));
  }, [monthYear]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshData() {
    setRefreshing(true);
    setError('');
    try {
      const r = await api<{ ok: boolean; monitor: Monitor }>(
        '/morbeez-staff/api/v1/dashboard/super-admin-monitor/refresh',
        { method: 'POST', body: JSON.stringify({ monthYear }) }
      );
      setData(r.monitor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  async function logAdSpend() {
    const amount = Number(adAmount);
    if (!amount || amount <= 0) return;
    setAdSaving(true);
    try {
      await api('/morbeez-staff/api/v1/dashboard/marketing-spend', {
        method: 'POST',
        body: JSON.stringify({ monthYear, channel: adChannel, amountInr: amount }),
      });
      setAdAmount('');
      await refreshData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log ad spend');
    } finally {
      setAdSaving(false);
    }
  }

  if (loading && !data) return <Loading label="Loading business monitor…" />;
  if (error && !data) return <div className="alert alert-error">{error}</div>;
  if (!data) return null;

  const d = data.dailySummary;
  const m = data.monthSummary;

  return (
    <div className="sam-dashboard">
      <header className="sam-header">
        <div>
          <h2 className="sam-title">Business health monitor</h2>
          <p className="sam-subtitle">
            Exception-focused · {data.asOf} · Month {data.monthYear}
          </p>
        </div>
        <div className="sam-header-actions">
          <label className="sam-month-picker">
            Period
            <input type="month" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} />
          </label>
          <Btn size="sm" variant="secondary" disabled={refreshing} onClick={() => void refreshData()}>
            {refreshing ? 'Refreshing…' : 'Refresh data'}
          </Btn>
        </div>
      </header>

      {error ? <div className="alert alert-error sam-inline-error">{error}</div> : null}

      <section className="sam-row sam-row-top">
        <KpiTile label="Total sales (today)" value={fmt(d.totalSales)} sub={`Month ${fmt(m.totalSales)}`} />
        <KpiTile label="Gross profit (today)" value={fmt(d.grossProfit)} sub={`Month ${fmt(m.grossProfit)}`} />
        <KpiTile
          label="Avg realization"
          value={`${d.avgRealizationPct.toFixed(1)}%`}
          sub={`Month ${m.avgRealizationPct.toFixed(1)}%`}
        />
        <KpiTile label="Cash collected" value={fmt(d.cashCollected)} sub={`Month ${fmt(m.cashCollected)}`} />
      </section>

      <Panel title="Daily business summary" description="Key signals for today">
        <div className="sam-summary-grid">
          <KpiTile label="Orders today" value={String(d.ordersCount)} sub={`Month ${m.ordersCount}`} />
          <KpiTile label="Retail sales" value={fmt(d.retailSales)} sub={`Bulk ${fmt(d.bulkSales)}`} />
          <KpiTile label="Retail vs bulk (month)" value={fmt(m.retailSales)} sub={`Bulk ${fmt(m.bulkSales)}`} />
          <KpiTile label="Orders (month)" value={String(m.ordersCount)} />
        </div>
      </Panel>

      <section className="sam-row sam-row-mid">
        <Panel
          title="Employee headwise profit"
          description="Net contribution = GP − incentive − returns − ad allocation"
          className="sam-widget sam-widget-wide"
        >
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Sales</th>
                  <th>Gross profit</th>
                  <th>Realization</th>
                  <th>Incentive</th>
                  <th>Net contribution</th>
                </tr>
              </thead>
              <tbody>
                {data.employeeHeadwise.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      No sales ledger data yet
                    </td>
                  </tr>
                ) : (
                  data.employeeHeadwise.map((e) => (
                    <tr key={e.employeeProfileId} className="sam-click-row">
                      <td>
                        <EmployeeLink
                          id={e.employeeProfileId}
                          name={e.fullName}
                          sub={e.employeeCode}
                          onNavigate={goEmployee}
                        />
                      </td>
                      <td>{fmt(e.salesInr)}</td>
                      <td>{fmt(e.grossProfitInr)}</td>
                      <td>{e.avgRealizationPct.toFixed(0)}%</td>
                      <td>{fmt(e.incentiveInr)}</td>
                      <td>
                        {fmt(e.netContributionInr)}
                        <div>
                          <Badge tone={contribTone(e.contributionLabel)}>{e.contributionLabel}</Badge>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </DataTable>
          </TableWrap>
        </Panel>

        <div className="sam-widget-stack">
          <Panel title="Realization monitoring" className="sam-widget">
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Avg</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.realizationMonitoring.slice(0, 8).map((e) => (
                    <tr key={e.employeeProfileId} className="sam-click-row">
                      <td>
                        <EmployeeLink id={e.employeeProfileId} name={e.fullName} onNavigate={goEmployee} />
                      </td>
                      <td>{e.avgRealizationPct.toFixed(0)}%</td>
                      <td>
                        <Badge tone={statusTone(e.status)}>{e.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
          </Panel>

          <Panel title="Bulk order profit" className="sam-widget">
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Sales</th>
                    <th>GP</th>
                    <th>Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bulkOrderProfit.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        No bulk orders this month
                      </td>
                    </tr>
                  ) : (
                    data.bulkOrderProfit.slice(0, 6).map((b) => (
                      <tr
                        key={b.customerKey}
                        className={b.atRisk ? 'sam-row-risk sam-click-row' : 'sam-click-row'}
                        onClick={() => navigate(toPath(`${paths.employees}#bulk-margin-reviews`))}
                      >
                        <td>{b.customerName}</td>
                        <td>{fmt(b.salesInr)}</td>
                        <td>{fmt(b.grossProfitInr)}</td>
                        <td>
                          {b.marginPct.toFixed(1)}%
                          {b.atRisk ? ' ⚠' : ''}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </DataTable>
            </TableWrap>
          </Panel>

          <Panel title="Margin leakage" className="sam-widget">
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Near floor</th>
                    <th>Avg discount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.marginLeakage.slice(0, 6).map((e) => (
                    <tr
                      key={e.employeeProfileId}
                      className={e.atRisk ? 'sam-row-risk sam-click-row' : 'sam-click-row'}
                    >
                      <td>
                        <EmployeeLink id={e.employeeProfileId} name={e.fullName} onNavigate={goEmployee} />
                      </td>
                      <td>{e.ordersNearFloor}</td>
                      <td>
                        {e.avgDiscountPct.toFixed(0)}%
                        {e.atRisk ? ' ⚠' : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
          </Panel>
        </div>
      </section>

      <section className="sam-row sam-row-bottom">
        <Panel title="Inventory health" className="sam-widget">
          <div className="sam-inv-grid">
            <KpiTile label="Dead stock SKUs" value={String(data.inventoryHealth.deadStock)} />
            <KpiTile label="Fast-moving" value={String(data.inventoryHealth.fastMovingStock)} />
            <KpiTile label="Low inventory" value={String(data.inventoryHealth.lowInventory)} />
            <KpiTile label="Aging stock" value={String(data.inventoryHealth.agingStock)} />
            <KpiTile label="Stock units" value={String(data.inventoryHealth.stockValueUnits)} />
          </div>
          <Btn size="sm" variant="secondary" className="sam-widget-link" onClick={() => navigate(toPath(paths.warehouse))}>
            Open warehouse →
          </Btn>
        </Panel>

        <Panel title="Returns & complaints" className="sam-widget">
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Return %</th>
                  <th>Level</th>
                </tr>
              </thead>
              <tbody>
                {data.returnComplaints.slice(0, 6).map((r) => (
                  <tr
                    key={r.employeeProfileId}
                    className={r.complaintLevel === 'High' ? 'sam-row-risk sam-click-row' : 'sam-click-row'}
                  >
                    <td>
                      <EmployeeLink id={r.employeeProfileId} name={r.fullName} onNavigate={goEmployee} />
                    </td>
                    <td>{r.returnPct.toFixed(1)}%</td>
                    <td>
                      <Badge
                        tone={
                          r.complaintLevel === 'High'
                            ? 'error'
                            : r.complaintLevel === 'Medium'
                              ? 'warn'
                              : 'success'
                        }
                      >
                        {r.complaintLevel}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
        </Panel>

        <Panel title="Cash flow" className="sam-widget">
          <div className="sam-inv-grid">
            <KpiTile label="COD pending" value={fmt(data.cashFlow.codPending)} />
            <KpiTile label="Receivables" value={fmt(data.cashFlow.receivables)} />
            <KpiTile label="Cash collected" value={fmt(data.cashFlow.cashCollected)} />
            <KpiTile
              label={data.cashFlow.adSpendSource === 'logged' ? 'Ad spend (logged)' : 'Ad spend (est.)'}
              value={fmt(data.cashFlow.adSpend)}
            />
            <KpiTile label="Profit after expenses" value={fmt(data.cashFlow.profitAfterExpenses)} />
          </div>
          <div className="sam-ad-spend-form">
            <span className="sam-ad-spend-label">Log ad spend</span>
            <StaticSelect
              value={adChannel}
              onChange={setAdChannel}
              options={[
                { value: 'meta', label: 'Meta' },
                { value: 'google', label: 'Google' },
                { value: 'whatsapp', label: 'WhatsApp' },
                { value: 'field', label: 'Field' },
                { value: 'general', label: 'General' },
                { value: 'other', label: 'Other' },
              ]}
            />
            <input
              type="number"
              min={1}
              placeholder="Amount ₹"
              value={adAmount}
              onChange={(e) => setAdAmount(e.target.value)}
            />
            <Btn size="sm" variant="primary" disabled={adSaving} onClick={() => void logAdSpend()}>
              {adSaving ? 'Saving…' : 'Add'}
            </Btn>
          </div>
        </Panel>

        <Panel title="KPI ranking" className="sam-widget">
          <TableWrap>
            <DataTable>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Score</th>
                  <th>Grade</th>
                </tr>
              </thead>
              <tbody>
                {data.employeePerformance.slice(0, 8).map((e, i) => (
                  <tr
                    key={e.employeeProfileId}
                    className={
                      i < 3 ? 'sam-row-top-performer sam-click-row' : e.grade === 'Risk' ? 'sam-row-risk sam-click-row' : 'sam-click-row'
                    }
                  >
                    <td>
                      <EmployeeLink id={e.employeeProfileId} name={e.fullName} onNavigate={goEmployee} />
                    </td>
                    <td>{e.kpiScore.toFixed(0)}</td>
                    <td>
                      <Badge tone={gradeTone(e.grade)}>{e.grade}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableWrap>
          <Btn size="sm" variant="secondary" className="sam-widget-link" onClick={() => navigate(toPath(paths.employees))}>
            Full employee KPIs →
          </Btn>
        </Panel>

        <Panel
          title="Critical alerts"
          description="High-priority only — click to investigate"
          className="sam-widget sam-alerts"
        >
          {data.alerts.length === 0 ? (
            <p className="muted sam-all-clear">All clear — no critical signals</p>
          ) : (
            <ul className="sam-alert-list">
              {data.alerts.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className={`sam-alert sam-alert--${a.severity}${a.action ? ' sam-alert--clickable' : ''}`}
                    onClick={() => goAlert(a.action)}
                    disabled={!a.action}
                  >
                    <strong>{a.title}</strong>
                    <span>{a.detail}</span>
                    {a.action ? <span className="sam-alert-action">View →</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </div>
  );
}
