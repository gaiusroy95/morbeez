import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Badge, Btn, Loading, Panel, TableWrap, DataTable } from '../ui';

const pricingApi = '/morbeez-staff/api/v1/os/pricing';

type Row = {
  employeeProfileId: string;
  fullName: string;
  employeeCode: string;
  salesVolumeInr: number;
  avgRealizationPct: number;
  grossProfitInr: number;
  totalScore: number;
  grade: string;
  profitLabel: string;
  salesAchievementPct: number;
  incentiveEarnedInr: number;
};

function formatInr(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function gradeTone(g: string) {
  if (g === 'A+') return 'success';
  if (g === 'A') return 'info';
  if (g === 'B') return 'neutral';
  if (g === 'C') return 'warning';
  return 'error';
}

export function EmployeePricingDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [monthYear, setMonthYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api<{ ok: boolean; monthYear: string; employees: Row[] }>(`${pricingApi}/kpi/dashboard`)
      .then((d) => {
        setMonthYear(d.monthYear);
        setRows(d.employees ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load KPIs'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function recompute() {
    setRecomputing(true);
    try {
      await api(`${pricingApi}/kpi/recompute`, { method: 'POST', body: JSON.stringify({}) });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Recompute failed');
    } finally {
      setRecomputing(false);
    }
  }

  return (
    <Panel
      title="Sales performance & incentives"
      description="Monthly KPI score (100 pts) · Target ₹6L · Retail realization + bulk profit rules"
      actions={
        <Btn size="sm" variant="secondary" disabled={recomputing} onClick={() => void recompute()}>
          {recomputing ? 'Updating…' : 'Refresh KPIs'}
        </Btn>
      }
    >
      {loading ? <Loading label="Loading KPI dashboard…" /> : null}
      {error ? <p className="pricing-dash-error">{error}</p> : null}
      {monthYear ? <p className="muted text-xs mb-2">Period: {monthYear}</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="muted">No KPI data yet — save quotes/orders to populate scores.</p>
      ) : null}
      {!loading && rows.length > 0 ? (
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Sales</th>
                <th>Realization</th>
                <th>Profit</th>
                <th>Score</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.employeeProfileId}>
                  <td>
                    <strong>{r.fullName}</strong>
                    <div className="muted text-xs">{r.employeeCode}</div>
                  </td>
                  <td>
                    {formatInr(r.salesVolumeInr)}
                    <div className="muted text-xs">{r.salesAchievementPct.toFixed(0)}% of target</div>
                  </td>
                  <td>{r.avgRealizationPct.toFixed(1)}%</td>
                  <td>
                    {formatInr(r.grossProfitInr)}
                    <div className="muted text-xs">{r.profitLabel}</div>
                  </td>
                  <td>{r.totalScore.toFixed(0)}</td>
                  <td>
                    <Badge tone={gradeTone(r.grade)}>{r.grade}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </TableWrap>
      ) : null}
    </Panel>
  );
}
