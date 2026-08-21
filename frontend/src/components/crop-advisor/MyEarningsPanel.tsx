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

type AgronomistEvent = {
  id: string;
  event_type: string;
  amount_inr: number;
  km: number | null;
  status: string;
  created_at: string;
  notes: string | null;
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
  agronomist?: {
    visitBonus: number;
    recBonus: number;
    escalationBonus: number;
    retentionBonus: number;
    kmInr: number;
    kmTotal: number;
    bonusTotal: number;
  };
  agronomistEvents?: AgronomistEvent[];
  lastThreeMonths?: {
    dueNow: number;
    heldNow: number;
    months: Array<{ month: string; earned: number; held: number; due: number; paid: number }>;
  };
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

          {data.agronomist &&
          (data.profile.role.toLowerCase().includes('agro') ||
            data.agronomist.bonusTotal + data.agronomist.kmInr > 0 ||
            (data.agronomistEvents?.length ?? 0) > 0) ? (
            <div className="tc-earnings-kpis">
              <div className="tc-intel-kpi">
                <span className="tc-intel-kpi-label">Visit bonus</span>
                <strong>{formatInr(data.agronomist.visitBonus)}</strong>
              </div>
              <div className="tc-intel-kpi">
                <span className="tc-intel-kpi-label">Rec success</span>
                <strong>{formatInr(data.agronomist.recBonus)}</strong>
              </div>
              <div className="tc-intel-kpi">
                <span className="tc-intel-kpi-label">Escalations</span>
                <strong>{formatInr(data.agronomist.escalationBonus)}</strong>
              </div>
              <div className="tc-intel-kpi">
                <span className="tc-intel-kpi-label">Retention</span>
                <strong>{formatInr(data.agronomist.retentionBonus)}</strong>
              </div>
              <div className="tc-intel-kpi">
                <span className="tc-intel-kpi-label">KM allowance</span>
                <strong>{formatInr(data.agronomist.kmInr)}</strong>
                <span className="tc-intel-kpi-sub">{data.agronomist.kmTotal} km GPS</span>
              </div>
            </div>
          ) : null}

          {data.agronomistEvents && data.agronomistEvents.length > 0 ? (
            <Panel title="Agronomist work log" className="tc-earnings-panel-inner">
              <TableWrap>
                <DataTable>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Event</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.agronomistEvents.slice(0, 20).map((e) => (
                      <tr key={e.id}>
                        <td>{new Date(e.created_at).toLocaleDateString('en-IN')}</td>
                        <td>
                          {e.event_type.replace(/_/g, ' ')}
                          {e.km != null ? <div className="muted text-xs">{e.km} km GPS</div> : null}
                          {e.notes ? <div className="muted text-xs">{e.notes}</div> : null}
                        </td>
                        <td>{formatInr(e.amount_inr)}</td>
                        <td>{e.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableWrap>
            </Panel>
          ) : null}

          {data.lastThreeMonths ? (
            <Panel title="Last 3 months (due vs held vs paid)" className="tc-earnings-panel-inner">
              <p className="muted text-xs mb-2">
                Due now {formatInr(data.lastThreeMonths.dueNow)} · held {formatInr(data.lastThreeMonths.heldNow)}
              </p>
              <TableWrap>
                <DataTable>
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Earned</th>
                      <th>Held</th>
                      <th>Due</th>
                      <th>Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lastThreeMonths.months.map((m) => (
                      <tr key={m.month}>
                        <td>{formatMonth(m.month)}</td>
                        <td>{formatInr(m.earned)}</td>
                        <td>{formatInr(m.held)}</td>
                        <td>{formatInr(m.due)}</td>
                        <td>{formatInr(m.paid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </TableWrap>
            </Panel>
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
