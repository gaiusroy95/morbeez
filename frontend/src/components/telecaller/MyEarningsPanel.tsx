import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Badge, Loading, Panel, TableWrap, DataTable } from '../ui';

const pricingApi = '/morbeez-staff/api/v1/os/pricing';

type MonthlyRow = {
  monthYear: string;
  salesVolumeInr: number;
  salesTargetInr: number;
  salesAchievementPct: number;
  grossProfitInr: number;
  incentiveEarnedInr: number;
  fixedSalaryInr: number;
  quarterlyBonusInr: number;
  totalEarningsInr: number;
  totalScore: number;
  grade: string;
  avgRealizationPct: number;
};

type SalesRow = {
  id: string;
  recordedAt: string;
  productTitle: string | null;
  qty: number;
  finalUnitPrice: number;
  incentiveAmount: number;
  retailOrBulk: string | null;
  status: string;
  quoteNumber: string | null;
};

type EarningsData = {
  profile: {
    fullName: string;
    employeeCode: string;
    role: string;
    state: string | null;
    district: string | null;
  };
  compensation: {
    fixedSalaryInr: number;
    monthlySalesTargetInr: number;
    travelAllowanceInr: number;
  };
  currentMonth: MonthlyRow | null;
  monthlyHistory: MonthlyRow[];
  recentSales: SalesRow[];
};

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatMonth(my: string) {
  const [y, m] = my.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
}

function gradeTone(g: string) {
  if (g === 'A+') return 'success';
  if (g === 'A') return 'info';
  if (g === 'B') return 'neutral';
  if (g === 'C') return 'warn';
  return 'error';
}

export function MyEarningsPanel() {
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<{ ok: boolean; earnings: EarningsData }>(`${pricingApi}/earnings/me`)
      .then((r) => {
        if (!cancelled) setData(r.earnings);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load earnings');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading && !data) return null;
  if (error && !data) return null;

  const cur = data?.currentMonth;

  return (
    <section className="tc-earnings-bar">
      <div className="tc-earnings-bar-head">
        <h3>My earnings & incentives</h3>
        <div className="tc-earnings-bar-actions">
          {cur ? (
            <Badge tone={gradeTone(cur.grade)}>
              {cur.grade} · {cur.totalScore.toFixed(0)} pts
            </Badge>
          ) : null}
          <button type="button" className="tc-intel-bar-toggle" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>

      {!collapsed && data ? (
        <>
          <div className="tc-earnings-profile">
            <strong>{data.profile.fullName}</strong>
            <span className="muted text-xs">
              {data.profile.employeeCode}
              {data.profile.district ? ` · ${data.profile.district}` : ''}
            </span>
          </div>

          {cur ? (
            <div className="tc-earnings-kpis">
              <div className="tc-intel-kpi">
                <span className="tc-intel-kpi-label">Fixed salary</span>
                <strong>{formatInr(cur.fixedSalaryInr)}</strong>
              </div>
              <div className="tc-intel-kpi">
                <span className="tc-intel-kpi-label">MTD sales</span>
                <strong>{formatInr(cur.salesVolumeInr)}</strong>
                <span className="tc-intel-kpi-sub">{cur.salesAchievementPct.toFixed(0)}% of target</span>
              </div>
              <div className="tc-intel-kpi">
                <span className="tc-intel-kpi-label">Incentive earned</span>
                <strong>{formatInr(cur.incentiveEarnedInr)}</strong>
              </div>
              <div className="tc-intel-kpi">
                <span className="tc-intel-kpi-label">Bonus</span>
                <strong>{formatInr(cur.quarterlyBonusInr)}</strong>
              </div>
              <div className="tc-intel-kpi">
                <span className="tc-intel-kpi-label">Total (est.)</span>
                <strong className="tc-earnings-total">{formatInr(cur.totalEarningsInr)}</strong>
              </div>
              <div className="tc-intel-kpi">
                <span className="tc-intel-kpi-label">Realization</span>
                <strong>{cur.avgRealizationPct.toFixed(1)}%</strong>
              </div>
            </div>
          ) : null}

          <Panel title="Monthly history" className="tc-earnings-panel-inner">
            <TableWrap>
              <DataTable>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Sales</th>
                    <th>Incentive</th>
                    <th>Bonus</th>
                    <th>Total</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthlyHistory.slice(0, 6).map((m) => (
                    <tr key={m.monthYear}>
                      <td>{formatMonth(m.monthYear)}</td>
                      <td>
                        {formatInr(m.salesVolumeInr)}
                        <div className="muted text-xs">{m.salesAchievementPct.toFixed(0)}%</div>
                      </td>
                      <td>{formatInr(m.incentiveEarnedInr)}</td>
                      <td>{formatInr(m.quarterlyBonusInr)}</td>
                      <td>{formatInr(m.totalEarningsInr)}</td>
                      <td>
                        <Badge tone={gradeTone(m.grade)}>{m.grade}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </TableWrap>
          </Panel>

          {data.recentSales.length > 0 ? (
            <Panel title="Recent sales log" className="tc-earnings-panel-inner">
              <TableWrap>
                <DataTable>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Product</th>
                      <th>Quote</th>
                      <th>Amount</th>
                      <th>Incentive</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentSales.slice(0, 15).map((s) => (
                      <tr key={s.id}>
                        <td>{new Date(s.recordedAt).toLocaleDateString('en-IN')}</td>
                        <td>
                          {s.productTitle ?? '—'}
                          <div className="muted text-xs">
                            ×{s.qty}
                            {s.retailOrBulk ? ` · ${s.retailOrBulk}` : ''}
                          </div>
                        </td>
                        <td>{s.quoteNumber ?? '—'}</td>
                        <td>{formatInr(s.finalUnitPrice * s.qty)}</td>
                        <td>{formatInr(s.incentiveAmount)}</td>
                        <td>{s.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableWrap>
            </Panel>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
