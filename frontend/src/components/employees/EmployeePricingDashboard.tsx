import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Badge, Btn, DataTable, Loading, Panel, StaticSelect, TableWrap } from '../ui';

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
  rank: number;
  isTopPerformer: boolean;
  isUnderPerformer: boolean;
};

type Filter = 'all' | 'top' | 'under' | 'risk';

function formatInr(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function gradeTone(g: string) {
  if (g === 'A+') return 'success';
  if (g === 'A') return 'info';
  if (g === 'B') return 'neutral';
  if (g === 'C') return 'warn';
  return 'error';
}

function currentMonthInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function EmployeePricingDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [monthYear, setMonthYear] = useState(currentMonthInput());
  const [filter, setFilter] = useState<Filter>('all');
  const [summary, setSummary] = useState({ total: 0, topCount: 0, underCount: 0, avgScore: 0 });
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (monthYear) p.set('monthYear', monthYear);
    if (filter !== 'all') p.set('filter', filter);
    return p.toString();
  }, [monthYear, filter]);

  function load() {
    setLoading(true);
    api<{ ok: boolean; monthYear: string; employees: Row[]; summary: typeof summary }>(
      `${pricingApi}/kpi/dashboard?${query}`
    )
      .then((d) => {
        setMonthYear(d.monthYear);
        setRows(d.employees ?? []);
        setSummary(d.summary ?? { total: 0, topCount: 0, underCount: 0, avgScore: 0 });
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load KPIs'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [query]);

  async function recompute() {
    setRecomputing(true);
    try {
      await api(`${pricingApi}/kpi/recompute`, {
        method: 'POST',
        body: JSON.stringify({ monthYear }),
      });
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
      description="Rank employees by monthly KPI · Target ₹6L · Top 3 highlighted · Filter underperformers"
      actions={
        <div className="pricing-dash-actions">
          <label className="pricing-dash-month">
            <span className="sr-only">Month</span>
            <input
              type="month"
              value={monthYear}
              onChange={(e) => setMonthYear(e.target.value)}
            />
          </label>
          <StaticSelect
            className="pricing-dash-filter"
            value={filter}
            onChange={(value) => setFilter(value as Filter)}
            options={[
              { value: 'all', label: 'All employees' },
              { value: 'top', label: 'Top performers' },
              { value: 'under', label: 'Under target (<80%)' },
              { value: 'risk', label: 'At risk (C / Risk)' },
            ]}
          />
          <Btn size="sm" variant="secondary" disabled={recomputing} onClick={() => void recompute()}>
            {recomputing ? 'Updating…' : 'Refresh KPIs'}
          </Btn>
        </div>
      }
    >
      {loading ? <Loading label="Loading KPI dashboard…" /> : null}
      {error ? <p className="pricing-dash-error">{error}</p> : null}
      {!loading && !error ? (
        <div className="pricing-dash-summary">
          <span>{summary.total} employees</span>
          <span>Avg score {summary.avgScore.toFixed(0)}</span>
          <span className="pricing-dash-summary-top">Top 3 ranked</span>
          <span className="pricing-dash-summary-under">{summary.underCount} under target</span>
        </div>
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="muted">No KPI data for this period — save quotes/orders to populate scores.</p>
      ) : null}
      {!loading && rows.length > 0 ? (
        <TableWrap>
          <DataTable>
            <thead>
              <tr>
                <th>#</th>
                <th>Employee</th>
                <th>Sales</th>
                <th>Realization</th>
                <th>Incentive</th>
                <th>Profit</th>
                <th>Score</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.employeeProfileId}
                  className={
                    r.isTopPerformer
                      ? 'pricing-row-top'
                      : r.isUnderPerformer
                        ? 'pricing-row-under'
                        : undefined
                  }
                >
                  <td>{r.rank}</td>
                  <td>
                    <strong>{r.fullName}</strong>
                    <div className="muted text-xs">{r.employeeCode}</div>
                    {r.isTopPerformer ? <span className="pricing-top-badge">Top</span> : null}
                  </td>
                  <td>
                    {formatInr(r.salesVolumeInr)}
                    <div className="muted text-xs">{r.salesAchievementPct.toFixed(0)}% of target</div>
                  </td>
                  <td>{r.avgRealizationPct.toFixed(1)}%</td>
                  <td>{formatInr(r.incentiveEarnedInr)}</td>
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
